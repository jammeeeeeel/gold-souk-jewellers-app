// Vercel Serverless Function — proxies the goldrates.cloud live rates API
// This runs server-side, so no CORS issues. Responds in ~300ms.

export default async function handler(req, res) {
  // CORS headers for the web app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const url =
    "https://goldrates.cloud/apis/live/gold.php?api_key=77807971726-Test";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: "Upstream error", status: response.status });
    }

    const text = await response.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ error: "Failed to fetch rates", message: err.message });
  }
}
