const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ── Dev proxy: handle /api/rates/live server-side (no CORS) ──
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith("/api/rates/live")) {
        const https = require("https");
        const targetUrl =
          "https://bcast.ornamentocean.co.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/ornamentocean";

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-cache, no-store");

        const request = https.get(
          targetUrl,
          { rejectUnauthorized: false, timeout: 4000 },
          (proxyRes) => {
            let data = "";
            proxyRes.on("data", (chunk) => (data += chunk));
            proxyRes.on("end", () => {
              res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
              res.end(data);
            });
          }
        );
        request.on("error", (err) => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        });
        request.on("timeout", () => {
          request.destroy();
          res.writeHead(504, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Upstream timeout" }));
        });
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
