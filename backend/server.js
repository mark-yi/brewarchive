const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3001;

const BREW_CONFIGS = {
  'brewmarkets': { baseUrl: 'https://www.brewmarkets.com', newsletterSlug: 'brew-markets' }, // Corrected newsletterSlug
  'cfobrew': { baseUrl: 'https://www.cfobrew.com', newsletterSlug: 'cfo' },
  'healthcare-brew': { baseUrl: 'https://www.healthcare-brew.com', newsletterSlug: 'healthcare' },
  'hr-brew': { baseUrl: 'https://www.hr-brew.com', newsletterSlug: 'hr' },
  'itbrew': { baseUrl: 'https://www.itbrew.com', newsletterSlug: 'it' },
  'marketingbrew': { baseUrl: 'https://www.marketingbrew.com', newsletterSlug: 'marketing' },
  'retailbrew': { baseUrl: 'https://www.retailbrew.com', newsletterSlug: 'retail' },
  'emergingtechbrew': { baseUrl: 'https://www.emergingtechbrew.com', newsletterSlug: 'emerging-tech' },
  'morningbrew': { baseUrl: 'https://www.morningbrew.com', newsletterSlug: 'daily' },
};

app.use(cors());

// Cache for BUILD_ID and allArchiveIssuesKey to avoid re-scraping on every request
const brewConfigCache = {};

async function getBrewConfig(brewType, baseUrl, newsletterSlug) {
  console.log(`[getBrewConfig] Attempting to get config for ${brewType}.`);
  if (brewConfigCache[brewType]) {
    console.log(`[getBrewConfig] Using cached config for ${brewType}.`);
    return brewConfigCache[brewType];
  }

  console.log(`[getBrewConfig] Launching browser for ${brewType}...`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    let buildId = null;
    let allArchiveIssuesKey = null;

    page.on('response', async (response) => {
      const requestUrl = response.url();
      if (requestUrl.includes('/_next/data/') && requestUrl.includes('/archive.json')) {
        console.log(`[getBrewConfig] Intercepted archive.json request: ${requestUrl}`);
        try {
          const urlParts = requestUrl.split('/');
          buildId = urlParts[urlParts.indexOf('_next') + 2];
          const jsonResponse = await response.json();
          // Find the exact key for allArchiveIssues within ROOT_QUERY
          if (jsonResponse.pageProps && jsonResponse.pageProps.initialApolloState && jsonResponse.pageProps.initialApolloState.ROOT_QUERY) {
            for (const key in jsonResponse.pageProps.initialApolloState.ROOT_QUERY) {
              if (key.startsWith('allArchiveIssues:')) {
                allArchiveIssuesKey = key;
                break;
              }
            }
          }
        } catch (e) {
          console.error(`[getBrewConfig] Error parsing JSON response for ${requestUrl}: ${e.message}`);
        }
      }
    });

    console.log(`[getBrewConfig] Navigating to ${baseUrl}/archive`);
    await page.goto(`${baseUrl}/archive`, { waitUntil: 'networkidle2' });

    // Give it some time to capture requests, especially if they are delayed
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (!buildId || !allArchiveIssuesKey) {
      console.log(`[getBrewConfig] BUILD_ID or allArchiveIssuesKey not found via interception. Trying fallback HTML parsing.`);
      // Fallback: try to extract from the initial HTML if not found by intercepting
      const content = await page.content();
      const $ = cheerio.load(content);
      const nextDataScript = $('script[type="application/json"]').html();
      if (nextDataScript) {
        try {
          const nextData = JSON.parse(nextDataScript);
          buildId = nextData.buildId;
          if (nextData.props && nextData.props.pageProps && nextData.props.pageProps.initialApolloState && nextData.props.pageProps.initialApolloState.ROOT_QUERY) {
            for (const key in nextData.props.pageProps.initialApolloState.ROOT_QUERY) {
              if (key.startsWith('allArchiveIssues:')) {
                allArchiveIssuesKey = key;
                break;
              }
            }
          }
        } catch (e) {
          console.error(`[getBrewConfig] Error parsing initial HTML script for ${brewType}: ${e.message}`);
        }
      }
    }

    if (!buildId || !allArchiveIssuesKey) {
      throw new Error(`Could not determine BUILD_ID or allArchiveIssuesKey for ${brewType}.`);
    }

    const config = { buildId, allArchiveIssuesKey };
    brewConfigCache[brewType] = config; // Cache the config
    console.log(`[getBrewConfig] Successfully obtained config for ${brewType}:`, config);
    return config;
  } catch (error) {
    console.error(`[getBrewConfig] Error in getBrewConfig for ${brewType}:`, error);
    throw error; // Re-throw to be caught by the main route handler
  } finally {
    if (browser) {
      await browser.close();
      console.log(`[getBrewConfig] Browser closed for ${brewType}.`);
    }
  }
}

app.get('/newsletter', async (req, res) => {
  const daysAgo = parseInt(req.query.daysAgo, 10);
  const brewType = req.query.brewType;

  console.log(`[Backend] Received request: daysAgo=${daysAgo}, brewType=${brewType}`);

  if (isNaN(daysAgo) || daysAgo < 0) {
    console.log(`[Backend] Invalid daysAgo: ${daysAgo}`);
    return res.status(400).json({ error: 'Invalid daysAgo parameter. Must be a non-negative number.' });
  }

  if (!brewType || !BREW_CONFIGS[brewType]) {
    console.log(`[Backend] Invalid brewType: ${brewType}`);
    return res.status(400).json({ error: 'Invalid or missing brewType parameter.' });
  }

  const { baseUrl, newsletterSlug } = BREW_CONFIGS[brewType];

  try {
    console.log(`[Backend] Calling getBrewConfig for ${brewType}...`);
    const { buildId, allArchiveIssuesKey } = await getBrewConfig(brewType, baseUrl, newsletterSlug);
    console.log(`[Backend] Received config: BUILD_ID=${buildId}, allArchiveIssuesKey=${allArchiveIssuesKey}`);

    // Calculate target date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    console.log(`[Backend] Target date: ${targetDate.toISOString().split('T')[0]}`);

    let foundNewsletterMeta = null;
    let page = 1;
    let allIssuesMeta = [];

    // Paginate through archive to find the closest newsletter
    while (!foundNewsletterMeta) {
      const paginatedArchiveUrl = `${baseUrl}/_next/data/${buildId}/archive.json?page=${page}`;
      console.log(`[Backend] Fetching paginated archive for ${brewType}, page ${page}: ${paginatedArchiveUrl}`);
      const { data: paginatedData } = await axios.get(paginatedArchiveUrl);

      // Log the raw paginated data to inspect its structure
      // console.log(`[Backend] Raw paginated data for ${brewType}, page ${page}:`, JSON.stringify(paginatedData, null, 2));

      // Use the dynamically determined allArchiveIssuesKey
      const issues = paginatedData.pageProps.initialApolloState.ROOT_QUERY[allArchiveIssuesKey];

      if (!issues || issues.length === 0) {
        console.log(`[Backend] No more issues found for ${brewType} on page ${page}. Breaking pagination loop.`);
        break; // No more issues to load
      }

      allIssuesMeta = [...allIssuesMeta, ...issues];

      let closestIssue = null;
      let minDiff = Infinity;

      for (const issue of issues) { // Only check issues from the current page to avoid re-processing allIssuesMeta
        const issueDate = new Date(issue.date);
        issueDate.setHours(0, 0, 0, 0);
        const diff = Math.abs(targetDate.getTime() - issueDate.getTime());

        if (diff < minDiff) {
          minDiff = diff;
          closestIssue = issue;
        }
      }

      // If we found an exact match on this page, or we've gone through enough pages,
      // or if the current page's issues contain the closest match so far, use it.
      if (closestIssue && minDiff === 0) { // Found exact match
        console.log(`[Backend] Found exact match for ${brewType} on page ${page}.`);
        foundNewsletterMeta = closestIssue;
      } else if (page > 5 && allIssuesMeta.length > 0) { // Limit pages to avoid infinite loop if no exact match is found quickly
        console.log(`[Backend] Paginated 5+ pages for ${brewType}, returning closest found so far.`);
        // Find the closest overall from all collected issues if we've paginated enough
        let overallClosest = null;
        let overallMinDiff = Infinity;
        for (const issue of allIssuesMeta) {
          const issueDate = new Date(issue.date);
          issueDate.setHours(0, 0, 0, 0);
          const diff = Math.abs(targetDate.getTime() - issueDate.getTime());
          if (diff < overallMinDiff) {
            overallMinDiff = diff;
            overallClosest = issue;
          }
        }
        foundNewsletterMeta = overallClosest;
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
    console.log(`[Backend] Fetching newsletter content for ${foundNewsletterMeta.slug} from ${brewType}: ${newsletterContentUrl}`);
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
    console.error('[Backend] Uncaught error in /newsletter route:', error);
    res.status(500).json({ error: 'Failed to scrape newsletter.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
