import { Platform } from "react-native";

export type RateItem = {
  id: string;
  label: string;
  buy: string;
  sell: string;
  high: string;
  low: string;
};

export type RatesData = {
  topBar: RateItem[];
  products: RateItem[];
  updated_at: string | null;
};

const EMPTY: RatesData = { topBar: [], products: [], updated_at: null };

/* ── In-memory cache to avoid re-fetching on screen navigation ── */
const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 1_500; // 1.5 seconds — keep below the 2s polling interval
function getCached<T>(key: string): T | null {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}
function setCache(key: string, data: any) {
  _cache[key] = { data, ts: Date.now() };
}

/* ── goldrates.cloud API ── */
const API_KEY = "77807971726-Test";
const GOLDRATES_API = `https://goldrates.cloud/apis/live/gold.php?api_key=${API_KEY}`;

// For web: use our own serverless proxy to avoid CORS
const getWebLiveUrl = () => `/api/rates/live?t=${Date.now()}`;

/**
 * Label mapping: goldrates.cloud symbols → labels the rest of the app expects.
 *
 * Critical mappings:
 *   "GOLD COSTING"   → "GOLD FUTURE"    (MCX Gold Futures rate per 10g)
 *   "SILVER COSTING"  → "SILVER FUTURE"  (MCX Silver Futures rate per kg)
 *
 * All downstream code (HomeScreen, CoinsScreen, B2BPortal, AdminPortal, Analytics)
 * searches for label.includes("GOLD") && label.includes("FUTURE") to extract
 * the base rate for MMTC coin calculations.
 */
const LABEL_MAP: Record<string, string> = {
  "GOLD COSTING":  "GOLD FUTURE",
  "SILVER COSTING": "SILVER FUTURE",
};

function mapLabel(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  return LABEL_MAP[upper] || symbol.trim();
}

/**
 * Parse the goldrates.cloud JSON response into our RatesData format.
 *
 * Top bar: items with ($) in symbol or INR → displayed in the top banner
 * Products: everything else → displayed in live rates tables
 */
function parseGoldRatesJson(json: any): RatesData {
  if (!json || json.status !== "success" || !Array.isArray(json.data)) {
    return EMPTY;
  }

  const topBar: RateItem[] = [];
  const products: RateItem[] = [];

  for (const item of json.data) {
    const symbol = (item.symbol || "").trim();
    // Skip items with all-dash values (no data)
    if (item.bid === "-" && item.ask === "-" && item.high === "-" && item.low === "-") {
      continue;
    }

    const mapped: RateItem = {
      id: String(item.id || ""),
      label: mapLabel(symbol),
      buy: item.bid || "-",
      sell: item.ask || "-",
      high: item.high || "-",
      low: item.low || "-",
    };

    // Route to topBar or products based on label content
    if (symbol.includes("($)") || symbol.toUpperCase() === "INR") {
      topBar.push(mapped);
    } else {
      products.push(mapped);
    }
  }

  if (topBar.length === 0 && products.length === 0) return EMPTY;
  return {
    topBar,
    products,
    updated_at: json.date ? new Date(json.date.replace(" ", "T") + "+05:30").toISOString() : new Date().toISOString(),
  };
}

async function fetchUrl(url: string, ms = 5000): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function getStaleCached<T>(key: string): T | null {
  const entry = _cache[key];
  return entry ? (entry.data as T) : null;
}

function tryParseJson(txt: string): RatesData | null {
  try {
    // The response might be raw JSON or wrapped in a proxy container
    let json = JSON.parse(txt);
    // If it's wrapped by allorigins or similar proxy
    if (json.contents) {
      json = JSON.parse(json.contents);
    }
    const parsed = parseGoldRatesJson(json);
    return parsed.topBar.length > 0 || parsed.products.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchLiveRates(): Promise<RatesData> {
  // Return fresh cached data immediately (avoid redundant network calls)
  const cached = getCached<RatesData>("liveRates");
  if (cached) return cached;

  const stale = getStaleCached<RatesData>("liveRates");

  // Stage 1: Try the FAST primary URL with a tight timeout
  // On web: use our proxy to avoid CORS. On native: call API directly.
  const primaryUrl = Platform.OS === "web" ? getWebLiveUrl() : GOLDRATES_API;
  const primaryTxt = await fetchUrl(primaryUrl, 3000);
  if (primaryTxt) {
    const result = tryParseJson(primaryTxt);
    if (result) {
      setCache("liveRates", result);
      return result;
    }
  }

  // Stage 2: Primary failed — try direct API (works on native, may work on some browsers)
  if (Platform.OS === "web") {
    const directTxt = await fetchUrl(GOLDRATES_API, 3000);
    if (directTxt) {
      const result = tryParseJson(directTxt);
      if (result) {
        setCache("liveRates", result);
        return result;
      }
    }
  }

  return stale || EMPTY;
}
