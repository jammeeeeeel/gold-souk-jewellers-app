/**
 * mmtcPampScraper.ts
 *
 * Fetches live gold and silver coin/bar prices directly from the MMTC-PAMP
 * website's internal Next.js data API.
 *
 * Strategy:
 *  1. Fetch the MMTC shop HTML to extract the current Next.js `buildId`
 *  2. Use that buildId to call `/_next/data/{buildId}/gold.json` (and silver.json)
 *  3. Parse `postTaxAmount` (price incl. GST) for each product
 *  4. Map products by weight (grams) → price
 *
 * Products are matched by slug keyword (e.g., "lotus-gold-bar-24k-10gm") and
 * fallback to any product at that weight.
 */

import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MmtcProduct = {
  slug: string;
  name: string;
  weightGrams: number;
  postTaxAmount: number;
  preTaxAmount: number;
};

export type MmtcRates = {
  gold: MmtcProduct[];
  silver: MmtcProduct[];
  buildId: string;
  fetchedAt: string;
};

// Weight → price lookup (keyed by weight in grams as string)
export type MmtcWeightPriceMap = Record<string, number>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHOP_URL = "https://www.mmtcpamp.com/shop";
const SHOP_SILVER_URL = "https://www.mmtcpamp.com/shop/silver";

// Proxy for web/CORS
const proxy = (url: string) =>
  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`;

// Known fallback build ID (refreshed periodically — will auto-update at runtime)
let _cachedBuildId: string | null = "6yQ5xv1xPTE4Xm_ejYZzz";
let _cacheTime = 0;
const BUILD_ID_TTL_MS = 30 * 60 * 1000; // re-fetch build ID every 30 min

// In-memory price cache to avoid re-fetching on navigation
const _priceCache: Record<string, { data: any; ts: number }> = {};
const PRICE_CACHE_TTL = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    let text = await res.text();
    // Unwrap allorigins JSON wrapper if present
    try {
      const j = JSON.parse(text);
      if (j.contents) text = j.contents;
    } catch {}
    return text;
  } catch {
    return null;
  }
}

/** Extract Next.js buildId from MMTC shop HTML */
async function getBuildId(): Promise<string | null> {
  const now = Date.now();
  if (_cachedBuildId && now - _cacheTime < BUILD_ID_TTL_MS) {
    return _cachedBuildId;
  }

  // Try direct fetch on native, then proxy
  const urls =
    Platform.OS === "web"
      ? [proxy(SHOP_URL)]
      : [SHOP_URL, proxy(SHOP_URL)];

  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) continue;
    const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (match) {
      _cachedBuildId = match[1];
      _cacheTime = now;
      return _cachedBuildId;
    }
  }

  // Return cached (possibly stale) value rather than failing entirely
  return _cachedBuildId;
}

/** Weight pattern matchers for gold products */
function parseGoldWeight(name: string, slug: string): number | null {
  const text = `${name} ${slug}`.toLowerCase();
  if (text.includes("0.5gm") || text.includes("0.5-gm") || text.includes(".500") || text.includes("0-5gm")) return 0.5;
  const m = text.match(/(\d+(?:\.\d+)?)\s*gm/);
  if (m) return parseFloat(m[1]);
  return null;
}

/** Weight pattern matcher for silver products */
function parseSilverWeight(name: string, slug: string): number | null {
  const text = `${name} ${slug}`.toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|g)\b/);
  if (m) return parseFloat(m[1]);
  return null;
}

/** Parse the Next.js pageProps JSON to extract product list */
function parseProducts(
  json: Record<string, unknown>,
  metal: "gold" | "silver"
): MmtcProduct[] {
  const products: MmtcProduct[] = [];

  // Navigate: pageProps.products or pageProps.data.products or pageProps.initialData.products
  const pageProps = (json as { pageProps?: Record<string, unknown> }).pageProps;
  if (!pageProps) return products;

  // The product array may live at different paths depending on MMTC's page structure
  const candidates: unknown[] = [];
  const tryPush = (val: unknown) => Array.isArray(val) && candidates.push(...val);
  tryPush((pageProps as Record<string, unknown>).products);
  tryPush(((pageProps as Record<string, unknown>).data as Record<string, unknown>)?.products);
  tryPush(
    ((pageProps as Record<string, unknown>).initialData as Record<string, unknown>)?.products
  );
  // Also scan full JSON string for product objects
  const raw = JSON.stringify(json);
  const productMatches = raw.matchAll(
    /"postTaxAmount"\s*:\s*([\d.]+)[^}]*?"slug"\s*:\s*"([^"]+)"/g
  );
  for (const m of productMatches) {
    candidates.push({ postTaxAmount: parseFloat(m[1]), slug: m[2] });
  }

  // Deduplicate by slug and create MmtcProduct entries
  const seen = new Set<string>();
  for (const raw of candidates) {
    const p = raw as Record<string, unknown>;
    const slug = String(p.slug || p.productUrl || "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const postTax = Number(p.postTaxAmount ?? p.totalAmount ?? 0);
    const preTax = Number(p.preTaxAmount ?? 0);
    const name = String(p.productName ?? p.name ?? slug);

    const weight =
      metal === "gold"
        ? parseGoldWeight(name, slug)
        : parseSilverWeight(name, slug);

    if (!weight || postTax <= 0) continue;

    products.push({ slug, name, weightGrams: weight, postTaxAmount: postTax, preTaxAmount: preTax });
  }

  return products;
}

/** Fetch MMTC gold or silver product list */
async function fetchMmtcProducts(
  metal: "gold" | "silver"
): Promise<MmtcProduct[]> {
  const buildId = await getBuildId();
  if (!buildId) return [];

  const dataUrl = `https://www.mmtcpamp.com/shop/_next/data/${buildId}/${metal}.json`;

  const urls =
    Platform.OS === "web"
      ? [proxy(dataUrl)]
      : [dataUrl, proxy(dataUrl)];

  for (const url of urls) {
    const text = await fetchText(url);
    if (!text) continue;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const products = parseProducts(json, metal);
      if (products.length > 0) return products;
    } catch {}
  }

  // Fallback: try scraping the HTML page for embedded __NEXT_DATA__
  const pageUrl = metal === "gold" ? SHOP_URL : SHOP_SILVER_URL;
  const pageUrls =
    Platform.OS === "web"
      ? [proxy(pageUrl)]
      : [pageUrl, proxy(pageUrl)];

  for (const url of pageUrls) {
    const html = await fetchText(url);
    if (!html) continue;
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!m) continue;
    try {
      const json = JSON.parse(m[1]) as Record<string, unknown>;
      const products = parseProducts(json, metal);
      if (products.length > 0) return products;
    } catch {}
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch live MMTC-PAMP gold coin/bar prices.
 * Returns a map of { "10": 164760, "1": 16710, ... } keyed by weight in grams.
 * When multiple products share the same weight, picks the lowest-priced (usually the bar).
 */
export async function fetchMmtcGoldPrices(): Promise<MmtcWeightPriceMap> {
  const cached = _priceCache["mmtcGold"];
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) return cached.data;

  const products = await fetchMmtcProducts("gold");
  const map: MmtcWeightPriceMap = {};
  for (const p of products) {
    const key = p.weightGrams.toString();
    // Keep lowest price at each weight (bars cheaper than commemorative coins)
    if (!map[key] || p.postTaxAmount < map[key]) {
      map[key] = p.postTaxAmount;
    }
  }
  if (Object.keys(map).length > 0) _priceCache["mmtcGold"] = { data: map, ts: Date.now() };
  return map;
}

/**
 * Fetch live MMTC-PAMP silver coin/bar prices.
 * Returns a map keyed by weight in grams.
 */
export async function fetchMmtcSilverPrices(): Promise<MmtcWeightPriceMap> {
  const cached = _priceCache["mmtcSilver"];
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) return cached.data;

  const products = await fetchMmtcProducts("silver");
  const map: MmtcWeightPriceMap = {};
  for (const p of products) {
    const key = p.weightGrams.toString();
    if (!map[key] || p.postTaxAmount < map[key]) {
      map[key] = p.postTaxAmount;
    }
  }
  if (Object.keys(map).length > 0) _priceCache["mmtcSilver"] = { data: map, ts: Date.now() };
  return map;
}

/**
 * Fetch both gold and silver prices in parallel.
 */
export async function fetchMmtcAllPrices(): Promise<{
  gold: MmtcWeightPriceMap;
  silver: MmtcWeightPriceMap;
  fetchedAt: string;
}> {
  const [gold, silver] = await Promise.all([
    fetchMmtcGoldPrices(),
    fetchMmtcSilverPrices(),
  ]);
  return { gold, silver, fetchedAt: new Date().toISOString() };
}
