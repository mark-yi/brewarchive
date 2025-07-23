const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3001;
const BUILD_ID = 'ZhafR7vPVoOai8E9vNGId'; // Hardcoded build ID

app.use(cors());

app.get('/newsletter', async (req, res) => {
  const daysAgo = parseInt(req.query.daysAgo, 10);
  if (isNaN(daysAgo) || daysAgo < 0) {
    return res.status(400).json({ error: 'Invalid daysAgo parameter. Must be a non-negative number.' });
  }

  try {
    // Calculate target date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);

    let foundNewsletter = null;
    let page = 1;
    let allIssuesMeta = [];

    // Fetch issues until we find a match or run out of issues
    while (!foundNewsletter) {
      const archiveUrl = `https://www.healthcare-brew.com/_next/data/${BUILD_ID}/archive.json?page=${page}`;
      const { data } = await axios.get(archiveUrl);
      const issues = data.pageProps.initialApolloState.ROOT_QUERY[`allArchiveIssues:{\"query\":\"\",\"newsletter\":\"healthcare\"}`];

      if (!issues || issues.length === 0) {
        break; // No more issues to load
      }

      allIssuesMeta = [...allIssuesMeta, ...issues];

      // Try to find the closest newsletter
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
        foundNewsletter = closestIssue;
      } else if (page > 5) { // Limit pages to avoid infinite loop if no exact match is found quickly
        foundNewsletter = closestIssue; // Return the closest found so far
      }

      page++;
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
    }

    if (!foundNewsletter) {
      return res.status(404).json({ error: 'No newsletter found for the given daysAgo.' });
    }

    // Fetch the HTML content for the found newsletter
    const newsletterUrl = `https://www.healthcare-brew.com/_next/data/${BUILD_ID}/issues/${foundNewsletter.slug}.json?slug=${foundNewsletter.slug}`;
    const { data: newsletterData } = await axios.get(newsletterUrl);

    if (newsletterData.pageProps.issueData && newsletterData.pageProps.issueData.html) {
      res.json({
        daysAgo: daysAgo,
        date: foundNewsletter.date,
        html: newsletterData.pageProps.issueData.html,
      });
    } else {
      res.status(404).json({ error: 'Newsletter HTML content not found.' });
    }

  } catch (error) {
    console.error('Error scraping newsletter:', error);
    res.status(500).json({ error: 'Failed to scrape newsletter.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});