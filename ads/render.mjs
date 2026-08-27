import { launch } from "puppeteer-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(process.argv[1] || "."));
const outDir = path.join(root, "out");
fs.mkdirSync(outDir, { recursive: true });

const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const jobs = [
  { file: "ad-feed-pain.html", out: "feed-pain.png", w: 1080, h: 1350 },
  { file: "ad-feed-tap.html", out: "feed-tap.png", w: 1080, h: 1350 },
  { file: "ad-feed-close.html", out: "feed-close.png", w: 1080, h: 1350 },
  { file: "ad-reels.html", out: "reels-hook.png", w: 1080, h: 1920 },
];

const browser = await launch({
  executablePath: chrome,
  headless: true,
  args: ["--hide-scrollbars", "--allow-file-access-from-files"],
});

for (const job of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
  const url = pathToFileURL(path.join(root, job.file)).href;
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 400));
  const dest = path.join(outDir, job.out);
  await page.screenshot({ path: dest, type: "png" });
  console.log("wrote", dest);
  await page.close();
}

await browser.close();
