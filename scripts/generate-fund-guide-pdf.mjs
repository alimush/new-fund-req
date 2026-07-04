import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { PDFDocument } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(root, "docs", "fund-request-guide.html");
const outPath = join(root, "docs", "دليل-طلب-التمويل.pdf");
const tempPath = join(root, "docs", ".fund-guide-temp.pdf");

const SCREENSHOT_MARGIN = 18;
const SCREENSHOT_TITLE_HEIGHT = 38;
const SCREENSHOT_CAPTION_HEIGHT = 128;
const IMAGE_CAPTION_GAP = 14;

const EMBEDDED_SCREENSHOTS = [
  join(root, "docs", "assets", "dashboard-screenshot.jpg"),
  join(root, "docs", "assets", "requests-screenshot.jpg"),
  join(root, "docs", "assets", "workflow-screenshot.jpg"),
];

function getLandscapePageIndices(doc) {
  const indices = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    if (page.getWidth() > page.getHeight()) indices.push(i);
  }
  return indices;
}

async function renderHtmlPdf() {
  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1123,
      height: 794,
      deviceScaleFactor: 1,
    });

    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: ".app-screenshot { display: none !important; }",
    });
    await new Promise((r) => setTimeout(r, 200));

    await page.pdf({
      path: tempPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }
}

async function replaceScreenshotPagesWithNativeImages() {
  const guideBytes = readFileSync(tempPath);
  const guideDoc = await PDFDocument.load(guideBytes);
  const outDoc = await PDFDocument.create();
  const landscapeIndices = getLandscapePageIndices(guideDoc);

  if (landscapeIndices.length !== EMBEDDED_SCREENSHOTS.length) {
    throw new Error(
      `Expected ${EMBEDDED_SCREENSHOTS.length} landscape pages, found ${landscapeIndices.length}`
    );
  }

  const embeddedImages = await Promise.all(
    EMBEDDED_SCREENSHOTS.map(async (imagePath) => {
      const imageBytes = readFileSync(imagePath);
      return outDoc.embedJpg(imageBytes);
    })
  );

  const screenshotPageSet = new Set(landscapeIndices);
  const landscapeQueue = [...landscapeIndices];

  for (let i = 0; i < guideDoc.getPageCount(); i++) {
    const [copied] = await outDoc.copyPages(guideDoc, [i]);
    const page = outDoc.addPage(copied);

    if (!screenshotPageSet.has(i)) continue;

    const image = embeddedImages[landscapeQueue.indexOf(i)];
    const topArea = SCREENSHOT_MARGIN + SCREENSHOT_TITLE_HEIGHT;
    const bottomArea =
      SCREENSHOT_MARGIN + SCREENSHOT_CAPTION_HEIGHT + IMAGE_CAPTION_GAP;
    const maxW = page.getWidth() - SCREENSHOT_MARGIN * 2;
    const maxH = page.getHeight() - topArea - bottomArea;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;

    page.drawImage(image, {
      x: (page.getWidth() - w) / 2,
      y: bottomArea,
      width: w,
      height: h,
    });
  }

  writeFileSync(outPath, await outDoc.save());
}

async function main() {
  await renderHtmlPdf();
  await replaceScreenshotPagesWithNativeImages();
  console.log(`✅ PDF: ${outPath}`);
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
