import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { closeCatalogPool, getTools, injectCatalog } from "../server/catalog";

export const PAGES_BASE = "/ai-tools/";
export const PAGES_URL = "https://tyhcch1234.github.io/ai-tools/";
export const SNAPSHOT_NOTICE =
  "GitHub Pages 版本使用資料庫匯出快照，更新需要重新發佈。";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "pages-dist");

export function parsePagesArguments(args: string[]): string | undefined {
  if (!args.length) return undefined;
  if (args.length !== 2 || args[0] !== "--api-url") {
    throw new Error("Usage: pnpm exec tsx scripts/export-pages.ts [--api-url https://host/api/tools]");
  }
  const value = args[1];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The catalog API URL must be an absolute HTTPS URL.");
  }
  // This URL is public browser metadata, never a place for private credentials.
  if (
    value !== value.trim() ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("The catalog API URL must use HTTPS without credentials, query parameters or a fragment.");
  }
  return url.href;
}

const escapeAttribute = (value: string) =>
  value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);

function removePlatformScript(html: string): string {
  return html.replace(
    /<script\b[^>]*\bsrc=["'][^"']*\/api\/platform\/config\.js["'][^>]*>\s*<\/script>/gi,
    ""
  );
}

export function decoratePagesHtml(html: string, catalogUrl: string): string {
  if (!html.includes('id="catalog-data"')) {
    throw new Error("The database-backed initial catalog was not injected.");
  }
  const cleaned = removePlatformScript(html)
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "")
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/gi, "");
  const metadata = [
    `<link rel="canonical" href="${PAGES_URL}" />`,
    `<meta property="og:url" content="${PAGES_URL}" />`,
    `<link rel="icon" href="${PAGES_BASE}favicon.svg" type="image/svg+xml" />`,
  ].join("\n    ");
  const result = cleaned
    .replace("</head>", `    ${metadata}\n  </head>`)
    .replace('id="catalog-data"', `id="catalog-data" data-catalog-url="${escapeAttribute(catalogUrl)}"`);
  return catalogUrl === "./catalog.json"
    ? result.replace('<main class="initial-catalog">', `<main class="initial-catalog"><p>${SNAPSHOT_NOTICE}</p>`)
    : result;
}

export async function exportPages(apiUrl?: string): Promise<void> {
  try {
    // Fail closed if the persistent database is absent; never use seed/demo data.
    const tools = await getTools();
    if (!tools.length) throw new Error("Catalog data not initialized");
    const clientRoot = path.join(projectRoot, "client");
    // Check the only public assets we intend to publish before starting the build.
    const hero = path.join(clientRoot, "public/assets/hero.webp");
    const favicon = path.join(clientRoot, "public/favicon.svg");
    await Promise.all([readFile(hero), readFile(favicon)]);
    const pagesHtml: Plugin = {
      name: "pages-only-html",
      transformIndexHtml: {
        order: "pre",
        handler: html => removePlatformScript(html).replace(
          /<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/gi,
          ""
        ),
      },
    };
    console.log(`Building GitHub Pages frontend at ${PAGES_BASE}…`);
    await build({
      // Do not load the managed Vite plugins, platform config or environment files.
      // This leaves the original Vite/default backend build completely unchanged.
      configFile: false,
      envDir: false,
      envPrefix: [],
      root: clientRoot,
      base: PAGES_BASE,
      publicDir: false,
      plugins: [pagesHtml, react(), tailwindcss()],
      resolve: {
        alias: {
          "@": path.join(clientRoot, "src"),
          "@shared": path.join(projectRoot, "shared"),
          "@assets": path.join(projectRoot, "attached_assets"),
        },
      },
      build: {
        outDir: outputDir,
        emptyOutDir: true,
        copyPublicDir: false,
        sourcemap: false,
      },
    });
    const htmlPath = path.join(outputDir, "index.html");
    const builtHtml = await readFile(htmlPath, "utf8");
    // injectCatalog reads the same database via its existing read-only helper.
    const initialHtml = await injectCatalog(builtHtml);
    // Use the injected payload for catalog.json too, keeping both snapshots identical
    // even if a maintainer changes the catalog between the two bounded SQL reads.
    const match = initialHtml.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error("The initial database snapshot is missing.");
    const snapshot: unknown = JSON.parse(match[1]);
    await mkdir(path.join(outputDir, "assets"), { recursive: true });
    await Promise.all([
      writeFile(htmlPath, decoratePagesHtml(initialHtml, apiUrl ?? "./catalog.json"), "utf8"),
      writeFile(path.join(outputDir, "catalog.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8"),
      writeFile(path.join(outputDir, "manus-routes.json"), `${JSON.stringify({ routes: [{ path: PAGES_BASE, title: "AI 精選指南" }] }, null, 2)}\n`, "utf8"),
      copyFile(hero, path.join(outputDir, "assets/hero.webp")),
      copyFile(favicon, path.join(outputDir, "favicon.svg")),
      writeFile(path.join(outputDir, ".nojekyll"), "", "utf8"),
    ]);
    console.log(`Pages export ready: ${outputDir}`);
    console.log(apiUrl ? "Catalog mode: public live API with embedded database snapshot fallback." : `Catalog mode: static database export. ${SNAPSHOT_NOTICE}`);
  } finally {
    await closeCatalogPool();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const apiUrl = parsePagesArguments(process.argv.slice(2));
    await exportPages(apiUrl);
  } catch {
    // Do not print connection strings or raw errors that could expose credentials.
    console.error("Pages export failed. Check the HTTPS API argument, database access and required public assets; no credentials were printed.");
    process.exitCode = 1;
  }
}
