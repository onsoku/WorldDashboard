import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'docs', 'screenshots');

const TARGET_TOPIC = 'Webアプリケーションアーキテクチャ';

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Helper to set theme and language, select target topic, then screenshot
  async function capture(theme, language, filename, { scrollTop = 0, selectTopic = true } = {}) {
    // Set preferences before navigating
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.evaluate((t, l) => {
      const s = JSON.parse(localStorage.getItem('world-dashboard-settings') || '{}');
      s.theme = t;
      s.language = l;
      localStorage.setItem('world-dashboard-settings', JSON.stringify(s));
    }, theme, language);
    await page.reload({ waitUntil: 'networkidle2' });

    // Select the target topic
    if (selectTopic) {
      await page.evaluate((topicName) => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.includes(topicName)) {
            btn.click();
            break;
          }
        }
      }, TARGET_TOPIC);
      // Wait for content to load
      await new Promise(r => setTimeout(r, 2000));
    }

    // Wait for markdown content
    await page.waitForSelector('.markdown-content', { timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 500));

    if (scrollTop > 0) {
      await page.evaluate(st => {
        const m = document.querySelector('main');
        if (m) m.scrollTop = st;
      }, scrollTop);
      await new Promise(r => setTimeout(r, 500));
    }
    await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: false });
    console.log(`Saved: ${filename}`);
  }

  // Light theme - overview
  await capture('light', 'ja', 'light-overview.png');

  // Dark theme - overview
  await capture('dark', 'ja', 'dark-overview.png');

  // Mono theme - overview
  await capture('mono', 'ja', 'mono-overview.png');

  // Light theme - keywords (scroll down)
  await capture('light', 'ja', 'light-keywords.png', { scrollTop: 3500 });

  // Light theme - extensions with SVG diagram (scroll further)
  await capture('light', 'ja', 'light-extensions.png', { scrollTop: 5500 });

  // Light theme - English UI
  await capture('light', 'en', 'light-english.png');

  await browser.close();
  console.log('All screenshots taken!');
}

main().catch(e => { console.error(e); process.exit(1); });
