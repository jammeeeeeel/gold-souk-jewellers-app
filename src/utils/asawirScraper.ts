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
const CACHE_TTL = 30_000; // 30 seconds
function getCached<T>(key: string): T | null {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}
function setCache(key: string, data: any) {
  _cache[key] = { data, ts: Date.now() };
}

const DIRECT_URL =
  "http://bcast.asawirjewellers.com:7767/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/asawir";
const getWebLiveUrl = () => `/api/rates/live?t=${Date.now()}`;
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
  const stale = getStaleCached<RatesData>("liveRates");
  const urls = Platform.OS === "web"
    ? [getWebLiveUrl(), getProxyUrl(), getProxyUrl2()]
    : [DIRECT_URL, getProxyUrl()];
  const result = await raceValid<RatesData>(
    urls,
    (txt) => {
      const parsed = parseTSV(txt);
      return parsed.topBar.length > 0 || parsed.products.length > 0 ? parsed : null;
    },
    5000
  );
  if (result) {
    setCache("liveRates", result);
    return result;
  }
  return stale || EMPTY;
}

/* ── COIN RATES (from asawircoins template) ── */

const COINS_DIRECT_URL =
  "http://bcast.asawirjewellers.com:7767/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/asawircoins";
const getWebCoinsUrl = () => `/api/rates/coins?t=${Date.now()}`;
const getCoinsProxyUrl = () => `https://api.allorigins.win/raw?url=${encodeURIComponent(COINS_DIRECT_URL)}&t=${Date.now()}`;
const getCoinsProxyUrl2 = () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(COINS_DIRECT_URL)}&t=${Date.now()}`;

export async function fetchCoinRates(): Promise<RateItem[]> {
  const cached = getCached<RateItem[]>("goldCoins");
  if (cached) return cached;
  const stale = getStaleCached<RateItem[]>("goldCoins");

  const urls = Platform.OS === "web"
    ? [getWebCoinsUrl(), getCoinsProxyUrl(), getCoinsProxyUrl2()]
    : [COINS_DIRECT_URL, getCoinsProxyUrl()];
  const coins = await raceValid<RateItem[]>(
    urls,
    (txt) => {
      const parsed = parseCoinRatesTSV(txt);
      return parsed.length > 0 ? parsed : null;
    }
  );
  if (coins && coins.length > 0) {
    setCache("goldCoins", coins);
    return coins;
  }
  return stale || [];
}

/* ── SILVER COIN RATES (from asawirsilver template) ── */

const SILVER_DIRECT_URL =
  "http://bcast.asawirjewellers.com:7767/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/asawirsilver";
const getWebSilverUrl = () => `/api/rates/silver?t=${Date.now()}`;
const getSilverProxyUrl = () => `https://api.allorigins.win/raw?url=${encodeURIComponent(SILVER_DIRECT_URL)}&t=${Date.now()}`;
const getSilverProxyUrl2 = () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(SILVER_DIRECT_URL)}&t=${Date.now()}`;

export async function fetchSilverCoinRates(): Promise<RateItem[]> {
  const cached = getCached<RateItem[]>("silverCoins");
  if (cached) return cached;
  const stale = getStaleCached<RateItem[]>("silverCoins");

  const urls = Platform.OS === "web"
    ? [getWebSilverUrl(), getSilverProxyUrl(), getSilverProxyUrl2()]
    : [SILVER_DIRECT_URL, getSilverProxyUrl()];
  const coins = await raceValid<RateItem[]>(
    urls,
    (txt) => {
      const parsed = parseSilverCoinRatesTSV(txt);
      return parsed.length > 0 ? parsed : null;
    }
  );
  if (coins && coins.length > 0) {
    setCache("silverCoins", coins);
    return coins;
  }
  return stale || [];
}

