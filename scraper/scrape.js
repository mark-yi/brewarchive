
const axios = require('axios');
const fs = require('fs');

const BUILD_ID = 'ZhafR7vPVoOai8E9vNGId';

async function scrape() {
  try {
    // 1. Get all the slugs by paginating through the archive
    let allIssuesMeta = [];
    let page = 1;
    while (true) {
      console.log(`Fetching page ${page}...`);
      const url = `https://www.healthcare-brew.com/_next/data/${BUILD_ID}/archive.json?page=${page}`;
      const { data } = await axios.get(url);
      const issues = data.pageProps.initialApolloState.ROOT_QUERY[`allArchiveIssues:{"query":"","newsletter":"healthcare"}`];
      if (!issues || issues.length === 0) {
        break;
      }
      allIssuesMeta = [...allIssuesMeta, ...issues];
      page++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Fetch the content for each slug and combine with metadata
    const newsletters = [];
    for (const issueMeta of allIssuesMeta) {
      console.log(`Fetching ${issueMeta.slug}...`);
      const url = `https://www.healthcare-brew.com/_next/data/${BUILD_ID}/issues/${issueMeta.slug}.json?slug=${issueMeta.slug}`;
      const { data } = await axios.get(url);
      if (data.pageProps.issueData && data.pageProps.issueData.html) {
        newsletters.push({
          slug: issueMeta.slug,
          date: issueMeta.date,
          html: data.pageProps.issueData.html,
        });
      }
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Save the content to a file
    fs.writeFileSync('newsletters.json', JSON.stringify(newsletters, null, 2));
    console.log(`Successfully scraped and saved ${newsletters.length} newsletters to newsletters.json`);

  } catch (error) {
    console.error('Error scraping:', error);
  }
}

scrape();
