const proxy = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`;
async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    let text = await res.text();
    try {
      const j = JSON.parse(text);
      if (j.contents) text = j.contents;
    } catch {}
    return text;
  } catch {
    return null;
  }
}
async function getBuildId() {
  const html = await fetchText(proxy("https://www.mmtcpamp.com/shop"));
  if (!html) return null;
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}
function parseGoldWeight(name: string, slug: string): number | null {
  const text = `${name} ${slug}`.toLowerCase();
  if (text.includes("0.5gm") || text.includes("0.5-gm") || text.includes(".500") || text.includes("0-5gm")) return 0.5;
  const m = text.match(/(\d+(?:\.\d+)?)\s*gm/);
  if (m) return parseFloat(m[1]);
  return null;
}
function parseSilverWeight(name: string, slug: string): number | null {
  const text = `${name} ${slug}`.toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|g)\b/);
  if (m) return parseFloat(m[1]);
  return null;
}
function parseProducts(json: any, metal: "gold" | "silver") {
  const products: any[] = [];
  const candidates: any[] = [];
  const raw = JSON.stringify(json);
  const productMatches = raw.matchAll(/"postTaxAmount"\s*:\s*([\d.]+)[^}]*?"slug"\s*:\s*"([^"]+)"/g);
  for (const m of productMatches) {
    candidates.push({ postTaxAmount: parseFloat(m[1]), slug: m[2] });
  }
  const seen = new Set<string>();
  for (const p of candidates) {
    const slug = String(p.slug || "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const postTax = Number(p.postTaxAmount || 0);
    const weight = metal === "gold" ? parseGoldWeight("", slug) : parseSilverWeight("", slug);
    if (weight && postTax > 0) products.push({ slug, weightGrams: weight, postTaxAmount: postTax });
  }
  return products;
}
async function test() {
  const buildId = await getBuildId();
  console.log("Build ID:", buildId);
  const text = await fetchText(proxy(`https://www.mmtcpamp.com/shop/_next/data/${buildId}/gold.json`));
  const products = parseProducts(JSON.parse(text!), "gold");
  console.log("Found", products.length, "gold products");
  
  const map: any = {};
  for (const p of products) {
    const key = p.weightGrams.toString();
    if (!map[key] || p.postTaxAmount < map[key]) map[key] = p.postTaxAmount;
  }
  console.log("Gold Map:", map);
}
test().catch(console.error);

