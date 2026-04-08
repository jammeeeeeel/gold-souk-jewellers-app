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

const DIRECT_URL =
  "https://bcast.ornamentocean.co.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/ornamentocean";

// Primary for web: our own Vercel serverless proxy (server-side fetch, no CORS, ~300ms)
const getWebLiveUrl = () => `/api/rates/live?t=${Date.now()}`;
// Fallback CORS proxies (slow / unreliable — only used if our proxy is down)
const getProxyUrl = () => `https://api.allorigins.win/raw?url=${encodeURIComponent(DIRECT_URL)}&t=${Date.now()}`;
const getProxyUrl2 = () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(DIRECT_URL)}&t=${Date.now()}`;

function parseTSV(text: string): RatesData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const topBar: RateItem[] = [];
  const products: RateItem[] = [];

  for (const line of lines) {
    // Each line starts with \t, so split produces empty first element — filter it
    const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 6) continue;

    // Format: ID, LABEL, BUY/VALUE, SELL, HIGH, LOW
    const item: RateItem = {
      id: parts[0],
      label: parts[1],
      buy: parts[2],
      sell: parts[3],
      high: parts[4],
      low: parts[5],
    };

    if (item.label.includes("($)") || item.label.toUpperCase().includes("INR")) {
      topBar.push(item);
    } else {
      products.push(item);
    }
  }

  if (topBar.length === 0 && products.length === 0) return EMPTY;
  return { topBar, products, updated_at: new Date().toISOString() };
}

async function fetchUrl(url: string, ms = 5000): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    let txt = await r.text();
    try { const j = JSON.parse(txt); if (j.contents) txt = j.contents; } catch { }
    return txt;
  } catch { return null; }
}

function getStaleCached<T>(key: string): T | null {
  const entry = _cache[key];
  return entry ? (entry.data as T) : null;
}

/** Race multiple URLs — first successfully parsed payload wins */
async function raceValid<T>(
  urls: string[],
  parse: (txt: string) => T | null,
  ms = 5000
): Promise<T | null> {
  if (urls.length === 0) return null;
  try {
    return await new Promise<T | null>((resolve) => {
      let resolved = false;
      let pending = urls.length;
      for (const url of urls) {
        fetchUrl(url, ms).then((txt) => {
          if (!resolved && txt) {
            const parsed = parse(txt);
            if (parsed) {
              resolved = true;
              resolve(parsed);
              return;
            }
          }
          pending -= 1;
          if (!resolved && pending === 0) resolve(null);
        });
      }
    });
  } catch {
    return null;
  }
}

function parseCoinRatesTSV(txt: string): RateItem[] {
  const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const coins: RateItem[] = [];
  for (const line of lines) {
    const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;
    coins.push({
      id: parts[0],
      label: parts[1],
      buy: parts.length >= 3 ? parts[2] : "-",
      sell: parts.length >= 4 ? parts[3] : "-",
      high: parts.length >= 5 ? parts[4] : "-",
      low: parts.length >= 6 ? parts[5] : "-",
    });
  }
  return coins;
}

function parseSilverCoinRatesTSV(txt: string): RateItem[] {
  const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const coins: RateItem[] = [];
  for (const line of lines) {
    const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;
    const label = parts[1].toUpperCase();
    if (label.includes("INR") || label.includes("FUTURE")) continue;
    coins.push({
      id: parts[0],
      label: parts[1],
      buy: parts.length >= 3 ? parts[2] : "-",
      sell: parts.length >= 4 ? parts[3] : "-",
      high: parts.length >= 5 ? parts[4] : "-",
      low: parts.length >= 6 ? parts[5] : "-",
    });
  }
  return coins;
}

export async function fetchLiveRates(): Promise<RatesData> {
  // Return fresh cached data immediately (avoid redundant network calls)
  const cached = getCached<RatesData>("liveRates");
  if (cached) return cached;

  const stale = getStaleCached<RatesData>("liveRates");

  const parse = (txt: string): RatesData | null => {
    const parsed = parseTSV(txt);
    return parsed.topBar.length > 0 || parsed.products.length > 0 ? parsed : null;
  };

  // Stage 1: Try the FAST primary URL with a tight timeout
  const primaryUrl = Platform.OS === "web" ? getWebLiveUrl() : DIRECT_URL;
  const primaryTxt = await fetchUrl(primaryUrl, 2000);
  if (primaryTxt) {
    const result = parse(primaryTxt);
    if (result) {
      setCache("liveRates", result);
      return result;
    }
  }

  // Stage 2: Primary failed — race all fallbacks in parallel
  // Include direct URL for web too (works on some browsers/localhost, fails fast if blocked)
  const fallbackUrls = Platform.OS === "web"
    ? [DIRECT_URL, getProxyUrl(), getProxyUrl2()]
    : [getProxyUrl()];

  const result = await raceValid<RatesData>(fallbackUrls, parse, 3000);
  if (result) {
    setCache("liveRates", result);
    return result;
  }
  return stale || EMPTY;
}

