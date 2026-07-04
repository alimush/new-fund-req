import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "docs", "assets", "dashboard-screenshot.png");

const BASE_URL = process.env.GUIDE_SCREENSHOT_URL || "http://localhost:3000/home";
const VIEWPORT_WIDTH = 1440;
const DEVICE_SCALE = 2;

async function main() {
  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: VIEWPORT_WIDTH,
      height: 1200,
      deviceScaleFactor: DEVICE_SCALE,
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1500));

    const url = page.url();
    if (url.includes("/login")) {
      console.warn("⚠️  Not logged in — open /home in browser, stay logged in, then re-run.");
      console.warn("   Or set GUIDE_SCREENSHOT_URL to a reachable /home page.");
      process.exit(1);
    }

    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: true,
      captureBeyondViewport: true,
    });

    console.log(`✅ Screenshot: ${outPath} (${VIEWPORT_WIDTH * DEVICE_SCALE}px wide capture)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
