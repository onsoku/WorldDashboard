import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'screenshots');

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Light mode - dashboard overview
  await page.screenshot({ path: path.join(outDir, 'light-overview.png'), fullPage: false });

  // Scroll to keyword map
  await page.evaluate(() => document.querySelector('main').scrollTop = 700);
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, 'light-keywords.png'), fullPage: false });

  // Dark mode
  await page.evaluate(() => {
    localStorage.setItem('world-dashboard-settings', JSON.stringify({ theme: 'dark', language: 'ja' }));
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.evaluate(() => document.querySelector('main').scrollTop = 0);
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, 'dark-overview.png'), fullPage: false });

  // Mono mode
  await page.evaluate(() => {
    localStorage.setItem('world-dashboard-settings', JSON.stringify({ theme: 'mono', language: 'ja' }));
    document.documentElement.setAttribute('data-theme', 'mono');
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, 'mono-overview.png'), fullPage: false });

  // Reset to light + English
  await page.evaluate(() => {
    localStorage.setItem('world-dashboard-settings', JSON.stringify({ theme: 'light', language: 'en' }));
    document.documentElement.setAttribute('data-theme', 'light');
    location.reload();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(outDir, 'light-english.png'), fullPage: false });

  await browser.close();
  console.log('Screenshots saved to docs/screenshots/');
}

capture().catch(e => { console.error(e); process.exit(1); });
