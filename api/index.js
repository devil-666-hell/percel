export const config = { runtime: "edge" };

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
const XHTTP_PATH = "/api/v1/updates";

const ERR_MISCONFIGURED = new Response("Configuration Error", { status: 500 });
const ERR_BAD_GATEWAY = new Response("Gateway Error", { status: 502 });

const STRIP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
]);

export default async function handler(req) {
  const url = new URL(req.url);

  if (url.pathname === "/") {
    const clientIp = req.headers.get("x-real-ip") || "Unknown";
    const city = req.headers.get("x-vercel-ip-city") || "Unknown";
    const country = req.headers.get("x-vercel-ip-country") || "Unknown";
    const region = req.headers.get("x-vercel-ip-country-region") || "Unknown";

    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Edge Diagnostic Tool</title>
          <style>
              body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .card { background: #161616; padding: 2rem; border-radius: 12px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%; max-width: 400px; }
              h1 { font-size: 1.2rem; color: #888; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 1px; }
              .stat { margin-bottom: 1rem; }
              .label { font-size: 0.8rem; color: #555; display: block; }
              .value { font-size: 1.1rem; font-weight: 600; color: #00ff88; font-family: monospace; }
              .tag { background: #333; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; vertical-align: middle; margin-left: 5px; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>Edge Connection Info</h1>
              <div class="stat"><span class="label">IPv4/IPv6 Address</span><span class="value">${clientIp}</span></div>
              <div class="stat"><span class="label">Location</span><span class="value">${city}, ${region} <span class="tag">${country}</span></span></div>
              <div class="stat"><span class="label">Edge Node</span><span class="value">VERCEL_GLOBAL_EDGE</span></div>
              <div class="stat" style="margin-top:20px; border-top: 1px solid #333; padding-top:10px;">
                <span class="label">Status</span><span class="value" style="color:#0070f3;">● API Active</span>
              </div>
          </div>
      </body>
      </html>
    `, { headers: { "content-type": "text/html" } });
  }

  if (url.pathname !== XHTTP_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  if (!TARGET_BASE) return ERR_MISCONFIGURED;

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    const newHeaders = new Headers(req.headers);
    const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");
    
    for (const key of newHeaders.keys()) {
      if (STRIP_HEADERS.has(key) || key.startsWith("x-vercel-")) {
        newHeaders.delete(key);
      }
    }

    if (clientIp) newHeaders.set("x-forwarded-for", clientIp);

    return fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
    
  } catch (err) {
    return ERR_BAD_GATEWAY;
  }
}
