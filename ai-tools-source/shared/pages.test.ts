import { afterEach, describe, expect, it, vi } from "vitest";
import { readCatalogUrl, readInitialCatalog, isCatalogSnapshot } from "../client/src/lib/catalogClient";
import { decoratePagesHtml, parsePagesArguments, PAGES_URL, SNAPSHOT_NOTICE } from "../scripts/export-pages";

const initialHtml = `<!doctype html><html><head><link rel="icon" href="/favicon.svg" /></head><body><div id="root"><main class="initial-catalog"><h1>Real catalog</h1></main></div><script src="/api/platform/config.js"></script><script id="catalog-data" type="application/json">{"tools":[],"verifiedDate":"2026-11-09"}</script></body></html>`;

function stubCatalogElement(url?: string) {
  vi.stubGlobal("document", {
    getElementById: () => ({
      getAttribute: (name: string) => name === "type" ? "application/json" : url ?? null,
      textContent: '{"tools":[],"verifiedDate":"2026-11-09"}',
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHub Pages compatibility", () => {
  it("keeps the original managed endpoint when no public endpoint is embedded", () => {
    expect(readCatalogUrl()).toBe("/api/tools");
    stubCatalogElement();
    expect(readCatalogUrl()).toBe("/api/tools");
    expect(isCatalogSnapshot()).toBe(false);
  });

  it("uses the embedded public API or the relative static snapshot without changing initial data", () => {
    stubCatalogElement("https://catalog.example.com/api/tools");
    expect(readCatalogUrl()).toBe("https://catalog.example.com/api/tools");
    expect(isCatalogSnapshot()).toBe(false);
    expect(readInitialCatalog()?.verifiedDate).toBe("2026-11-09");
    stubCatalogElement("./catalog.json");
    expect(readCatalogUrl()).toBe("./catalog.json");
    expect(isCatalogSnapshot()).toBe(true);
  });

  it("accepts only a credential-free HTTPS API argument", () => {
    expect(parsePagesArguments([])).toBeUndefined();
    expect(parsePagesArguments(["--api-url", "https://catalog.example.com/api/tools"])).toBe("https://catalog.example.com/api/tools");
    for (const url of ["http://example.com/api/tools", "https://user:secret@example.com/api/tools", "/api/tools", "https://example.com/api/tools?token=secret", "https://example.com/api/tools#secret"]) {
      expect(() => parsePagesArguments(["--api-url", url])).toThrow();
    }
    expect(() => parsePagesArguments(["--other"])).toThrow();
  });

  it("writes Pages metadata, removes platform config, and truthfully labels static exports", () => {
    const html = decoratePagesHtml(initialHtml, "./catalog.json");
    expect(html).toContain(`rel="canonical" href="${PAGES_URL}"`);
    expect(html).toContain(`property="og:url" content="${PAGES_URL}"`);
    expect(html).toContain('href="/ai-tools/favicon.svg"');
    expect(html).toContain('data-catalog-url="./catalog.json"');
    expect(html).toContain(SNAPSHOT_NOTICE);
    expect(html).toContain("Real catalog");
    expect(html).not.toContain("/api/platform/config.js");
  });

  it("preserves the meaningful initial snapshot when live API mode is selected", () => {
    const html = decoratePagesHtml(initialHtml, "https://catalog.example.com/api/tools");
    expect(html).toContain('data-catalog-url="https://catalog.example.com/api/tools"');
    expect(html).toContain("Real catalog");
    expect(html).toContain('"verifiedDate":"2026-11-09"');
    expect(html).not.toContain(SNAPSHOT_NOTICE);
    expect(() => decoratePagesHtml("<html></html>", "./catalog.json")).toThrow();
  });
});
