import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const DIST_ASSETS_DIR = fileURLToPath(new URL("../dist/assets/", import.meta.url));
const DIST_INDEX_HTML = fileURLToPath(new URL("../dist/index.html", import.meta.url));

const budgets = {
  entryJsBytes: 280 * 1024,
  entryJsGzipBytes: 95 * 1024,
  initialJsGzipBytes: 120 * 1024,
  totalJsGzipBytes: 190 * 1024,
  initialCssBytes: 70 * 1024,
  initialCssGzipBytes: 16 * 1024,
  cssBytes: 180 * 1024,
  cssGzipBytes: 32 * 1024,
};

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function assetMetric(filename) {
  const path = join(DIST_ASSETS_DIR, filename);
  const content = readFileSync(path);
  return {
    filename,
    bytes: statSync(path).size,
    gzipBytes: gzipSync(content).length,
  };
}

function assertBudget(label, actual, limit) {
  if (actual > limit) {
    failures.push(`${label}: ${formatBytes(actual)} > ${formatBytes(limit)}`);
  }
}

function assertLazyJsChunkContract({
  label,
  pattern,
  reason,
  maxGzipBytes = 0,
}) {
  const lazyAssets = jsAssets.filter((asset) => pattern.test(asset.filename));
  if (lazyAssets.length === 0) {
    failures.push(`${label} should remain a lazy JS chunk${reason ? `: ${reason}` : ""}`);
    return;
  }
  const initialAssets = lazyAssets
    .filter((asset) => initialJsFilenames.includes(asset.filename))
    .map((asset) => asset.filename);
  if (initialAssets.length > 0) {
    failures.push(`${label} is preloaded in index.html: ${initialAssets.join(", ")}`);
  }
  if (maxGzipBytes > 0) {
    const totalGzipBytes = lazyAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    assertBudget(`${label} lazy chunk gzip`, totalGzipBytes, maxGzipBytes);
  }
}

function assertLazyCssChunkContract({
  label,
  pattern,
  maxGzipBytes = 0,
}) {
  const lazyAssets = cssAssets.filter((asset) => pattern.test(asset.filename));
  if (lazyAssets.length === 0) {
    failures.push(`${label} should remain a lazy CSS chunk`);
    return;
  }
  const initialAssets = lazyAssets
    .filter((asset) => initialCssFilenames.includes(asset.filename))
    .map((asset) => asset.filename);
  if (initialAssets.length > 0) {
    failures.push(`${label} CSS is preloaded in index.html: ${initialAssets.join(", ")}`);
  }
  if (maxGzipBytes > 0) {
    const totalGzipBytes = lazyAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    assertBudget(`${label} lazy CSS gzip`, totalGzipBytes, maxGzipBytes);
  }
}

const failures = [];
const files = readdirSync(DIST_ASSETS_DIR);
const jsAssets = files.filter((file) => file.endsWith(".js")).map(assetMetric);
const cssAssets = files.filter((file) => file.endsWith(".css")).map(assetMetric);
const entryJs = jsAssets.find((asset) => /^index-[\w-]+\.js$/.test(asset.filename));
const totalJsGzipBytes = jsAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const largestCss = cssAssets.sort((a, b) => b.bytes - a.bytes)[0];
const indexHtml = readFileSync(DIST_INDEX_HTML, "utf8");
const initialJsFilenames = Array.from(indexHtml.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g))
  .map((match) => match[1]);
const initialCssFilenames = Array.from(indexHtml.matchAll(/href="\/assets\/([^"]+\.css)"/g))
  .map((match) => match[1]);
const initialJsGzipBytes = initialJsFilenames.reduce((sum, filename) => {
  const asset = jsAssets.find((candidate) => candidate.filename === filename);
  return sum + (asset?.gzipBytes || 0);
}, 0);
const initialCssBytes = initialCssFilenames.reduce((sum, filename) => {
  const asset = cssAssets.find((candidate) => candidate.filename === filename);
  return sum + (asset?.bytes || 0);
}, 0);
const initialCssGzipBytes = initialCssFilenames.reduce((sum, filename) => {
  const asset = cssAssets.find((candidate) => candidate.filename === filename);
  return sum + (asset?.gzipBytes || 0);
}, 0);

if (!entryJs) {
  failures.push("entry JS asset not found");
} else {
  assertBudget("entry JS raw", entryJs.bytes, budgets.entryJsBytes);
  assertBudget("entry JS gzip", entryJs.gzipBytes, budgets.entryJsGzipBytes);
}

if (!largestCss) {
  failures.push("CSS asset not found");
} else {
  assertBudget("largest CSS raw", largestCss.bytes, budgets.cssBytes);
  assertBudget("largest CSS gzip", largestCss.gzipBytes, budgets.cssGzipBytes);
}

assertBudget("total JS gzip", totalJsGzipBytes, budgets.totalJsGzipBytes);
assertBudget("initial JS gzip", initialJsGzipBytes, budgets.initialJsGzipBytes);
assertBudget("initial CSS raw", initialCssBytes, budgets.initialCssBytes);
assertBudget("initial CSS gzip", initialCssGzipBytes, budgets.initialCssGzipBytes);

const markdownInitialAssets = initialJsFilenames.filter((filename) => /markdown/i.test(filename));
if (markdownInitialAssets.length > 0) {
  failures.push(`markdown assets are preloaded in index.html: ${markdownInitialAssets.join(", ")}`);
}

const lazyPageInitialCssAssets = initialCssFilenames.filter((filename) =>
  /(composer|profile|postdetail|imagelightbox)/i.test(filename)
);
if (lazyPageInitialCssAssets.length > 0) {
  failures.push(`lazy page CSS is preloaded in index.html: ${lazyPageInitialCssAssets.join(", ")}`);
}

const lazyJsChunkContracts = [
  {
    label: "AuthModal",
    pattern: /authmodal/i,
    reason: "login/register UI should load only when authentication is requested",
    maxGzipBytes: 3 * 1024,
  },
  {
    label: "FloatingActions",
    pattern: /floatingactions/i,
    reason: "scroll-only actions should load only after the scroll threshold",
    maxGzipBytes: 1536,
  },
  {
    label: "sharePostLink",
    pattern: /sharepostlink/i,
    reason: "post sharing should load only after an explicit share action",
    maxGzipBytes: 3 * 1024,
  },
  {
    label: "clipboard",
    pattern: /clipboard/i,
    reason: "clipboard fallback should load only after copy/share interactions",
    maxGzipBytes: 1536,
  },
  {
    label: "ComposerPage",
    pattern: /^ComposerPage-/i,
    reason: "composer route code should load only on compose/edit flows",
    maxGzipBytes: 9 * 1024,
  },
  {
    label: "ProfileCenter",
    pattern: /^ProfileCenter-/i,
    reason: "profile route code should load only when the personal space opens",
    maxGzipBytes: 9 * 1024,
  },
  {
    label: "PostDetailView",
    pattern: /^PostDetailView-/i,
    reason: "detail route code should load only when a post detail opens",
    maxGzipBytes: 13 * 1024,
  },
  {
    label: "MarkdownRenderer",
    pattern: /^MarkdownRenderer-/i,
    reason: "full markdown rendering should stay outside the initial feed shell",
    maxGzipBytes: 7 * 1024,
  },
  {
    label: "ImageLightbox",
    pattern: /^ImageLightbox-/i,
    reason: "image overlay code should load only after opening media",
    maxGzipBytes: 5 * 1024,
  },
  {
    label: "RichGallery",
    pattern: /^RichGallery-/i,
    reason: "rich-gallery interaction code should stay on rich media posts",
    maxGzipBytes: 5 * 1024,
  },
];
for (const contract of lazyJsChunkContracts) {
  assertLazyJsChunkContract(contract);
}

const lazyCssChunkContracts = [
  {
    label: "ComposerPage",
    pattern: /^ComposerPage-/i,
    maxGzipBytes: 8 * 1024,
  },
  {
    label: "ProfileCenter",
    pattern: /^ProfileCenter-/i,
    maxGzipBytes: 8 * 1024,
  },
  {
    label: "PostDetailView",
    pattern: /^PostDetailView-/i,
    maxGzipBytes: 12 * 1024,
  },
  {
    label: "ImageLightbox",
    pattern: /^ImageLightbox-/i,
    maxGzipBytes: 2 * 1024,
  },
];
for (const contract of lazyCssChunkContracts) {
  assertLazyCssChunkContract(contract);
}

const asyncConfirmDialogAssets = jsAssets
  .filter((asset) => /confirmdialog/i.test(asset.filename))
  .map((asset) => asset.filename);
if (asyncConfirmDialogAssets.length > 0) {
  failures.push(
    `ConfirmDialog must stay in the initial shell so confirm handlers are registered before destructive interactions: ${asyncConfirmDialogAssets.join(", ")}`
  );
}

const externalFontPattern = /fonts\.(?:googleapis|gstatic)\.com/i;
if (externalFontPattern.test(indexHtml)) {
  failures.push("index.html contains external Google font dependencies");
}
const cssAssetsWithExternalFonts = cssAssets
  .filter((asset) => externalFontPattern.test(readFileSync(join(DIST_ASSETS_DIR, asset.filename), "utf8")))
  .map((asset) => asset.filename);
if (cssAssetsWithExternalFonts.length > 0) {
  failures.push(`CSS assets contain external Google font dependencies: ${cssAssetsWithExternalFonts.join(", ")}`);
}

console.log("Bundle budget report");
if (entryJs) {
  console.log(`entry JS: ${entryJs.filename} ${formatBytes(entryJs.bytes)} raw / ${formatBytes(entryJs.gzipBytes)} gzip`);
}
if (largestCss) {
  console.log(`largest CSS: ${largestCss.filename} ${formatBytes(largestCss.bytes)} raw / ${formatBytes(largestCss.gzipBytes)} gzip`);
}
console.log(`total JS gzip: ${formatBytes(totalJsGzipBytes)}`);
console.log(`initial JS gzip: ${formatBytes(initialJsGzipBytes)}`);
console.log(`initial CSS: ${formatBytes(initialCssBytes)} raw / ${formatBytes(initialCssGzipBytes)} gzip`);
for (const contract of lazyJsChunkContracts) {
  const lazyAssets = jsAssets.filter((asset) => contract.pattern.test(asset.filename));
  if (lazyAssets.length > 0) {
    const totalGzipBytes = lazyAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    console.log(`${contract.label} lazy JS gzip: ${formatBytes(totalGzipBytes)}`);
  }
}
for (const contract of lazyCssChunkContracts) {
  const lazyAssets = cssAssets.filter((asset) => contract.pattern.test(asset.filename));
  if (lazyAssets.length > 0) {
    const totalGzipBytes = lazyAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    console.log(`${contract.label} lazy CSS gzip: ${formatBytes(totalGzipBytes)}`);
  }
}

if (failures.length > 0) {
  console.error("\nBundle budget exceeded:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
