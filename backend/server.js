const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3001;

const BREW_CONFIGS = {
  'brewmarkets': 'https://www.brewmarkets.com',
  'cfobrew': 'https://www.cfobrew.com',
  'healthcare-brew': 'https://www.healthcare-brew.com',
  'hr-brew': 'https://www.hr-brew.com',
  'itbrew': 'https://www.itbrew.com',
  'marketingbrew': 'https://www.marketingbrew.com',
  'retailbrew': 'https://www.retailbrew.com',
  'emergingtechbrew': 'https://www.emergingbrew.com',
  'morningbrew': 'https://www.morningbrew.com',
};

app.use(cors());

app.get('/newsletter', async (req, res) => {
  const daysAgo = parseInt(req.query.daysAgo, 10);
  const brewType = req.query.brewType;

  console.log(`[Backend] Received request: daysAgo=${daysAgo}, brewType=${brewType}`);

  if (isNaN(daysAgo) || daysAgo < 0) {
    return res.status(400).json({ error: 'Invalid daysAgo parameter. Must be a non-negative number.' });
  }

  if (!brewType || !BREW_CONFIGS[brewType]) {
    return res.status(400).json({ error: 'Invalid or missing brewType parameter.' });
  }

  const baseUrl = BREW_CONFIGS[brewType];
  const archiveUrl = `${baseUrl}/archive`;

  try {
    // Step 1: Dynamically get BUILD_ID from the specific brew's archive page
    console.log(`[Backend] Fetching archive page for ${brewType}: ${archiveUrl}`);
    const archiveResponse = await axios.get(archiveUrl);
    const $ = cheerio.load(archiveResponse.data);
    const nextDataScript = $('script[type="application/json"]').html();

    if (!nextDataScript) {
      console.error(`[Backend] Error: Could not find __NEXT_DATA__ script on ${brewType} archive page.`);
      return res.status(500).json({ error: `Could not find __NEXT_DATA__ script on ${brewType} archive page.` });
    }

    const nextData = JSON.parse(nextDataScript);
    const buildId = nextData.buildId;

    if (!buildId) {
      console.error(`[Backend] Error: Could not extract buildId from ${brewType} archive page.`);
      return res.status(500).json({ error: `Could not extract buildId from ${brewType} archive page.` });
    }
    console.log(`[Backend] Found BUILD_ID for ${brewType}: ${buildId}`);

    // Calculate target date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);

    let foundNewsletterMeta = null;
    let page = 1;
    let allIssuesMeta = [];

    // Step 2: Paginate through archive to find the closest newsletter
    while (!foundNewsletterMeta) {
      const paginatedArchiveUrl = `${baseUrl}/_next/data/${buildId}/archive.json?page=${page}`;
      console.log(`[Backend] Fetching paginated archive for ${brewType}, page ${page}: ${paginatedArchiveUrl}`);
      const { data: paginatedData } = await axios.get(paginatedArchiveUrl);
      console.log(`[Backend] Raw paginated data for ${brewType}, page ${page}:`, JSON.stringify(paginatedData, null, 2));

      // THIS IS THE CRITICAL LINE TO INSPECT
      const issues = paginatedData.pageProps.initialApolloState.ROOT_QUERY[`allArchiveIssues:{\"query\":\"\",\"newsletter\":\"${brewType}\"}`];

      if (!issues || issues.length === 0) {
        console.log(`[Backend] No more issues found for ${brewType} on page ${page}.`);
        break; // No more issues to load
      }

      allIssuesMeta = [...allIssuesMeta, ...issues];

      let closestIssue = null;
      let minDiff = Infinity;

      for (const issue of allIssuesMeta) {
        const issueDate = new Date(issue.date);
        issueDate.setHours(0, 0, 0, 0);
        const diff = Math.abs(targetDate.getTime() - issueDate.getTime());

        if (diff < minDiff) {
          minDiff = diff;
          closestIssue = issue;
        }
      }

      if (closestIssue && minDiff === 0) { // Found exact match
        foundNewsletterMeta = closestIssue;
      } else if (page > 10) { // Limit pages to avoid excessive scraping if no exact match is found quickly
        foundNewsletterMeta = closestIssue; // Return the closest found so far
      }

      page++;
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
    }

    if (!foundNewsletterMeta) {
      console.error(`[Backend] Error: No newsletter found for ${brewType} with daysAgo=${daysAgo}.`);
      return res.status(404).json({ error: 'No newsletter found for the given daysAgo.' });
    }

    // Step 3: Fetch the HTML content for the found newsletter
    const newsletterContentUrl = `${baseUrl}/_next/data/${buildId}/issues/${foundNewsletterMeta.slug}.json?slug=${foundNewsletterMeta.slug}`;
    console.log(`[Backend] Fetching newsletter content for ${foundNewsletterMeta.slug}: ${newsletterContentUrl}`);
    const { data: newsletterContentData } = await axios.get(newsletterContentUrl);

    if (newsletterContentData.pageProps.issueData && newsletterContentData.pageProps.issueData.html) {
      console.log(`[Backend] Successfully scraped ${foundNewsletterMeta.slug} from ${brewType}.`);
      res.json({
        daysAgo: daysAgo,
        date: foundNewsletterMeta.date,
        html: newsletterContentData.pageProps.issueData.html,
        brewType: brewType,
      });
    } else {
      console.error(`[Backend] Error: Newsletter HTML content not found for ${foundNewsletterMeta.slug}.`);
      res.status(404).json({ error: 'Newsletter HTML content not found.' });
    }

  } catch (error) {
    console.error('[Backend] Error scraping newsletter:', error);
    res.status(500).json({ error: 'Failed to scrape newsletter.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});