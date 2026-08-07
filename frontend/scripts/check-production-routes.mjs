import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { preview } from "vite";

const FRONTEND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST_INDEX_HTML = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const HOST = "127.0.0.1";
const FETCH_TIMEOUT_MS = 8000;
const FETCH_RETRY_DELAY_MS = 120;
const FETCH_RETRY_COUNT = 5;
const ROUTES = [
  { path: "/", label: "home" },
  { path: "/posts/42", label: "post detail" },
  { path: "/posts/42?subPost=7", label: "sub-post deep link" },
  { path: "/posts/42?subPost=8", label: "branch sub-post deep link" },
  { path: "/posts/42?subPost=bad-id", label: "invalid sub-post deep link" },
  { path: "/posts/42?subPost=404", label: "missing sub-post deep link" },
  { path: "/compose", label: "composer" },
  { path: "/?compose=1", label: "legacy compose query" },
  { path: "/?post=42", label: "legacy post query" },
  { path: "/?post=42&subPost=8", label: "legacy branch sub-post query" },
];

function fail(message) {
  throw new Error(message);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = address?.port;
      server.close(() => {
        if (!port) {
          reject(new Error("Unable to allocate a preview port."));
          return;
        }
        resolve(port);
      });
    });
  });
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryFetchError(error) {
  if (error?.name === "AbortError") {
    return false;
  }
  const message = String(error?.message || "");
  const causeCode = String(error?.cause?.code || "");
  return /fetch failed|ECONNREFUSED|ECONNRESET|socket|terminated/i.test(`${message} ${causeCode}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithRetry(url, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    try {
      return await fetchText(url, options);
    } catch (error) {
      lastError = error;
      if (!shouldRetryFetchError(error) || attempt >= FETCH_RETRY_COUNT) {
        throw error;
      }
      await delay(FETCH_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError || new Error(`Unable to fetch ${url}`);
}

async function waitForPreviewReady(baseUrl) {
  const deadline = Date.now() + 4000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const { response, body } = await fetchTextWithRetry(`${baseUrl}/`, {
        headers: {
          "User-Agent": "MemeSeeSyntheticBrowser/1.0",
          "Accept": "text/html",
        },
      });
      if (response.status === 200 && body.includes('<div id="root"></div>')) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(FETCH_RETRY_DELAY_MS);
  }
  throw new Error(`Preview server did not become ready: ${lastError?.message || "timed out"}`);
}

function extractAssetPaths(html) {
  return Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g))
    .map((match) => match[1])
    .filter((path, index, paths) => paths.indexOf(path) === index);
}

function assertAppShell(route, response, html, failures) {
  if (response.status !== 200) {
    failures.push(`${route.label}: expected HTTP 200, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    failures.push(`${route.label}: expected text/html, got "${contentType}"`);
  }
  if (!html.includes('<div id="root"></div>')) {
    failures.push(`${route.label}: missing React root`);
  }
  if (!html.includes('name="viewport"')) {
    failures.push(`${route.label}: missing responsive viewport meta`);
  }
  if (html.includes("/src/main.jsx")) {
    failures.push(`${route.label}: served development entry instead of production assets`);
  }
  if (!html.includes('property="og:title"') || !html.includes('name="twitter:card"')) {
    failures.push(`${route.label}: missing social preview metadata`);
  }
}

function assertNoExternalExecutableAssets(html, failures) {
  const externalScriptPattern = /<script\s+[^>]*src="https?:\/\//i;
  const externalExecutableLinkPattern =
    /<link\s+[^>]*rel="(?:stylesheet|preload|modulepreload)"[^>]*href="https?:\/\//i;
  if (externalScriptPattern.test(html) || externalExecutableLinkPattern.test(html)) {
    failures.push("index.html references external script/style assets");
  }
}

async function assertBuiltAssets(baseUrl, html, failures) {
  const assets = extractAssetPaths(html);
  if (assets.length === 0) {
    failures.push("index.html does not reference built /assets/*.js or /assets/*.css files");
    return [];
  }

  const reports = [];
  for (const path of assets) {
    const { response } = await fetchTextWithRetry(`${baseUrl}${path}`);
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== 200) {
      failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    }
    if (path.endsWith(".js") && !/javascript|ecmascript/i.test(contentType)) {
      failures.push(`${path}: expected JavaScript content type, got "${contentType}"`);
    }
    if (path.endsWith(".css") && !contentType.includes("text/css")) {
      failures.push(`${path}: expected CSS content type, got "${contentType}"`);
    }
    reports.push({
      path,
      status: response.status,
      contentType,
    });
  }
  return reports;
}

async function assertPublicTextAsset({ baseUrl, path, label, expectedContentTypePattern, assertBody }, failures) {
  const { response, body } = await fetchTextWithRetry(`${baseUrl}${path}`);
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200) {
    failures.push(`${label}: expected HTTP 200, got ${response.status}`);
  }
  if (!expectedContentTypePattern.test(contentType)) {
    failures.push(`${label}: unexpected content type "${contentType}"`);
  }
  assertBody?.(body, failures);
  return {
    path,
    status: response.status,
    contentType,
    bytes: Buffer.byteLength(body),
  };
}

function assertRobotsTxt(body, failures) {
  if (!/^User-agent:\s*\*/m.test(body)) {
    failures.push("robots.txt: missing wildcard User-agent rule");
  }
  if (!/^Allow:\s*\/\s*$/m.test(body)) {
    failures.push("robots.txt: missing Allow: / rule");
  }
  if (!/^Sitemap:\s*https:\/\/memesee\.world\/sitemap\.xml\s*$/m.test(body)) {
    failures.push("robots.txt: missing production sitemap URL");
  }
}

function assertSitemapXml(body, failures) {
  if (!body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    failures.push("sitemap.xml: missing sitemap urlset namespace");
  }
  if (!body.includes("<loc>https://memesee.world/</loc>")) {
    failures.push("sitemap.xml: missing production home URL");
  }
  if (body.includes("127.0.0.1") || body.includes("localhost")) {
    failures.push("sitemap.xml: must not include local development origins");
  }
}

async function main() {
  if (!existsSync(DIST_INDEX_HTML)) {
    fail("Missing dist/index.html. Run npm run build before verify:routes.");
  }

  const port = await findFreePort();
  const server = await preview({
    root: FRONTEND_ROOT,
    logLevel: "silent",
    preview: {
      host: HOST,
      port,
      strictPort: true,
    },
  });
  const baseUrl = `http://${HOST}:${port}`;
  const failures = [];
  const routeReports = [];
  let assetReports = [];

  try {
    await waitForPreviewReady(baseUrl);

    for (const route of ROUTES) {
      const { response, body } = await fetchTextWithRetry(`${baseUrl}${route.path}`, {
        headers: {
          "User-Agent": "MemeSeeSyntheticBrowser/1.0",
          "Accept": "text/html",
        },
      });
      assertAppShell(route, response, body, failures);
      assertNoExternalExecutableAssets(body, failures);
      routeReports.push({
        label: route.label,
        path: route.path,
        status: response.status,
        contentType: response.headers.get("content-type") || "",
        bytes: Buffer.byteLength(body),
      });

      if (route.path === "/") {
        assetReports = await assertBuiltAssets(baseUrl, body, failures);
      }
    }

    const { response: ogImageResponse } = await fetchTextWithRetry(`${baseUrl}/og-image.png`);
    if (ogImageResponse.status !== 200) {
      failures.push(`/og-image.png: expected HTTP 200, got ${ogImageResponse.status}`);
    }
    const ogImageContentType = ogImageResponse.headers.get("content-type") || "";
    if (!ogImageContentType.includes("image/png")) {
      failures.push(`/og-image.png: expected image/png, got "${ogImageContentType}"`);
    }
    const robotsReport = await assertPublicTextAsset({
      baseUrl,
      path: "/robots.txt",
      label: "robots.txt",
      expectedContentTypePattern: /text\/plain/i,
      assertBody: assertRobotsTxt,
    }, failures);
    const sitemapReport = await assertPublicTextAsset({
      baseUrl,
      path: "/sitemap.xml",
      label: "sitemap.xml",
      expectedContentTypePattern: /xml|text\/plain/i,
      assertBody: assertSitemapXml,
    }, failures);

    const report = {
      baseUrl,
      routes: routeReports,
      assets: assetReports,
      publicAssets: [
        {
          path: "/og-image.png",
          status: ogImageResponse.status,
          contentType: ogImageContentType,
        },
        robotsReport,
        sitemapReport,
      ],
    };

    console.log("Production route synthesis report");
    console.log(JSON.stringify(report, null, 2));

    if (failures.length > 0) {
      console.error("\nProduction route synthesis failed:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
