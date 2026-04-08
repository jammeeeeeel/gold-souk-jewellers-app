import { Platform } from "react-native";

/**
 * Arihant Spot Live Rates Scraper
 * Fetches gold, silver, and coin rates from Arihant Spot broadcast server.
 * API returns tab-separated text with columns: ID | Label | Buy | Sell | High | Low
 */

/* ──── API ENDPOINTS ──── */
const BASE = "https://bcast.arihantspot.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID";
const GOLD_URL = `${BASE}/arihant`;
const SILVER_URL = `${BASE}/arihantsilver`;
const COINS_URL = `${BASE}/arihantcoins`;

/* ──── CORS proxies for web (multiple fallbacks) ──── */
const proxies = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&t=${Date.now()}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&t=${Date.now()}`,
];

/* ──── Types ──── */
export interface ArihantRateItem {
  id: string;
  label: string;
  buy: string;
  sell: string;
  high: string;
  low: string;
}

export interface ArihantRates {
  gold: ArihantRateItem[];
  silver: ArihantRateItem[];
  coins: ArihantRateItem[];
  fetchedAt: string;
}

/* ──── Parse tab-separated response ──── */
function parseRateResponse(text: string): ArihantRateItem[] {
  const items: ArihantRateItem[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Split by tab characters
    const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 5) {
      items.push({
        id: parts[0],
        label: parts[1],
        buy: parts[2],
        sell: parts[3],
        high: parts[4],
        low: parts[5] || parts[4], // fallback if low is missing
      });
    }
  }
  return items;
}

/* ──── Fetch with timeout ──── */
async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/plain, */*",
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* ──── Fetch helper with fallback ──── */
async function fetchEndpoint(url: string): Promise<ArihantRateItem[]> {
  // On native platforms try the direct URL first
  const urls: string[] = [];
  if (Platform.OS !== "web") {
    urls.push(url + `?_=${Date.now()}`);
  }
  // Add all proxy URLs
  for (const mkProxy of proxies) {
    urls.push(mkProxy(url));
  }

  for (const u of urls) {
    try {
      const res = await fetchWithTimeout(u);
      if (!res.ok) continue;
      const text = await res.text();
      const items = parseRateResponse(text);
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  return [];
}

/* ──── Public API ──── */
export async function fetchArihantGoldRates(): Promise<ArihantRateItem[]> {
  return fetchEndpoint(GOLD_URL);
}

export async function fetchArihantSilverRates(): Promise<ArihantRateItem[]> {
  return fetchEndpoint(SILVER_URL);
}

export async function fetchArihantCoinRates(): Promise<ArihantRateItem[]> {
  return fetchEndpoint(COINS_URL);
}

export async function fetchAllArihantRates(): Promise<ArihantRates> {
  const [gold, silver, coins] = await Promise.all([
    fetchArihantGoldRates(),
    fetchArihantSilverRates(),
    fetchArihantCoinRates(),
  ]);
  return {
    gold,
    silver,
    coins,
    fetchedAt: new Date().toISOString(),
  };
}
