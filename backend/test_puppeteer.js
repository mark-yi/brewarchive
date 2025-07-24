const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('Attempting to launch Puppeteer...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('Puppeteer launched successfully.');
    const page = await browser.newPage();
    console.log('Navigating to example.com...');
    await page.goto('https://example.com');
    console.log('Successfully navigated to example.com.');
  } catch (error) {
    console.error('Error launching or using Puppeteer:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

testPuppeteer();
