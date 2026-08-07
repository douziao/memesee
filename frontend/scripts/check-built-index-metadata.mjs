import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIST_INDEX_HTML = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const DIST_ROBOTS_TXT = fileURLToPath(new URL("../dist/robots.txt", import.meta.url));
const DIST_SITEMAP_XML = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));
const METADATA_SOURCE = fileURLToPath(new URL("../src/app/runtime/appDocumentMetadata.js", import.meta.url));
const PUBLIC_OG_IMAGE = fileURLToPath(new URL("../public/og-image.png", import.meta.url));
const PUBLIC_ROBOTS_TXT = fileURLToPath(new URL("../public/robots.txt", import.meta.url));
const PUBLIC_SITEMAP_XML = fileURLToPath(new URL("../public/sitemap.xml", import.meta.url));
const PRODUCTION_ORIGIN = "https://memesee.world";

function readSourceConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*"([^"]*)"`));
  if (!match) {
    throw new Error(`Unable to find metadata constant: ${name}`);
  }
  return match[1];
}

function readRuntimeHomeMetadataDefaults() {
  const source = readFileSync(METADATA_SOURCE, "utf8");
  return {
    siteName: readSourceConstant(source, "SITE_NAME"),
    title: readSourceConstant(source, "DEFAULT_TITLE"),
    description: readSourceConstant(source, "DEFAULT_DESCRIPTION"),
    imageUrl: `${PRODUCTION_ORIGIN}${readSourceConstant(source, "DEFAULT_IMAGE")}`,
    imageAlt: readSourceConstant(source, "DEFAULT_IMAGE_ALT"),
    imageWidth: readSourceConstant(source, "DEFAULT_IMAGE_WIDTH"),
    imageHeight: readSourceConstant(source, "DEFAULT_IMAGE_HEIGHT"),
    canonicalUrl: `${PRODUCTION_ORIGIN}/`,
    type: "website",
  };
}

function readHtmlTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
}

function readMetaContent(html, selectorName, selectorValue) {
  const selector = `${selectorName}="${selectorValue}"`;
  const pattern = new RegExp(`<meta\\s+[^>]*${selector}[^>]*content="([^"]*)"[^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function readLinkHref(html, rel) {
  const pattern = new RegExp(`<link\\s+[^>]*rel="${rel}"[^>]*href="([^"]*)"[^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function assertEqual(label, actual, expected, failures) {
  if (actual !== expected) {
    failures.push(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(label, body, expectedText, failures) {
  if (!body.includes(expectedText)) {
    failures.push(`${label}: missing "${expectedText}"`);
  }
}

function readRequiredTextAsset(path, label, failures) {
  if (!existsSync(path)) {
    failures.push(`${label}: missing ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function assertNoDevelopmentOrigins(label, body, failures) {
  if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(body)) {
    failures.push(`${label}: must not include local development origins`);
  }
}

function assertRobotsTxt(body, label, failures) {
  assertIncludes(label, body, "User-agent: *", failures);
  assertIncludes(label, body, "Allow: /", failures);
  assertIncludes(label, body, `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`, failures);
  assertNoDevelopmentOrigins(label, body, failures);
}

function assertSitemapXml(body, label, failures) {
  assertIncludes(label, body, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', failures);
  assertIncludes(label, body, `<loc>${PRODUCTION_ORIGIN}/</loc>`, failures);
  assertNoDevelopmentOrigins(label, body, failures);
}

function readPngDimensions(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing default OG image: ${path}`);
  }
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`Default OG image is not a PNG: ${path}`);
  }
  return {
    width: String(buffer.readUInt32BE(16)),
    height: String(buffer.readUInt32BE(20)),
  };
}

const html = readFileSync(DIST_INDEX_HTML, "utf8");
const metadata = readRuntimeHomeMetadataDefaults();
const failures = [];
const ogImageDimensions = readPngDimensions(PUBLIC_OG_IMAGE);
const publicRobotsTxt = readRequiredTextAsset(PUBLIC_ROBOTS_TXT, "public robots.txt", failures);
const publicSitemapXml = readRequiredTextAsset(PUBLIC_SITEMAP_XML, "public sitemap.xml", failures);
const distRobotsTxt = readRequiredTextAsset(DIST_ROBOTS_TXT, "dist robots.txt", failures);
const distSitemapXml = readRequiredTextAsset(DIST_SITEMAP_XML, "dist sitemap.xml", failures);

assertEqual("title", readHtmlTitle(html), metadata.title, failures);
assertEqual("meta description", readMetaContent(html, "name", "description"), metadata.description, failures);
assertEqual("canonical", readLinkHref(html, "canonical"), metadata.canonicalUrl, failures);
assertEqual("og:site_name", readMetaContent(html, "property", "og:site_name"), "MemeSee", failures);
assertEqual("og:title", readMetaContent(html, "property", "og:title"), metadata.title, failures);
assertEqual("og:description", readMetaContent(html, "property", "og:description"), metadata.description, failures);
assertEqual("og:type", readMetaContent(html, "property", "og:type"), metadata.type, failures);
assertEqual("og:url", readMetaContent(html, "property", "og:url"), metadata.canonicalUrl, failures);
assertEqual("og:image", readMetaContent(html, "property", "og:image"), metadata.imageUrl, failures);
assertEqual("og:image:alt", readMetaContent(html, "property", "og:image:alt"), metadata.imageAlt, failures);
assertEqual("og:image:width", readMetaContent(html, "property", "og:image:width"), metadata.imageWidth, failures);
assertEqual("og:image:height", readMetaContent(html, "property", "og:image:height"), metadata.imageHeight, failures);
assertEqual("twitter:card", readMetaContent(html, "name", "twitter:card"), "summary_large_image", failures);
assertEqual("twitter:title", readMetaContent(html, "name", "twitter:title"), metadata.title, failures);
assertEqual("twitter:description", readMetaContent(html, "name", "twitter:description"), metadata.description, failures);
assertEqual("twitter:image", readMetaContent(html, "name", "twitter:image"), metadata.imageUrl, failures);
assertEqual("twitter:image:alt", readMetaContent(html, "name", "twitter:image:alt"), metadata.imageAlt, failures);
assertEqual("default OG image width", ogImageDimensions.width, metadata.imageWidth, failures);
assertEqual("default OG image height", ogImageDimensions.height, metadata.imageHeight, failures);
assertRobotsTxt(publicRobotsTxt, "public robots.txt", failures);
assertRobotsTxt(distRobotsTxt, "dist robots.txt", failures);
assertSitemapXml(publicSitemapXml, "public sitemap.xml", failures);
assertSitemapXml(distSitemapXml, "dist sitemap.xml", failures);
assertEqual("built robots.txt", distRobotsTxt, publicRobotsTxt, failures);
assertEqual("built sitemap.xml", distSitemapXml, publicSitemapXml, failures);

console.log("Built index metadata report");
console.log(`title: ${metadata.title}`);
console.log(`canonical: ${metadata.canonicalUrl}`);
console.log(`image: ${metadata.imageUrl}`);
console.log(`imageAlt: ${metadata.imageAlt}`);
console.log(`imageSize: ${metadata.imageWidth}x${metadata.imageHeight}`);
console.log(`robots: ${PRODUCTION_ORIGIN}/robots.txt`);
console.log(`sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`);

if (failures.length > 0) {
  console.error("\nBuilt index metadata mismatch:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
