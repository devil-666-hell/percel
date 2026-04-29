export const config = { runtime: "edge" };

const coreUrl = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
const syncRoute = "/api/v1/updates";

const dropKeys = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
]);

const renderApp = (req) => {
  const origin = req.headers.get("x-real-ip") || "Unknown";
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
            body { font-family: -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #161616; padding: 2rem; border-radius: 12px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 90%; max-width: 400px; }
            h1 { font-size: 1.1rem; color: #888; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 1px; }
            .stat { margin-bottom: 1.2rem; }
            .label { font-size: 0.75rem; color: #555; display: block; text-transform: uppercase; margin-bottom: 2px; }
            .value { font-size: 1.1rem; font-weight: 600; color: #00ff88; font-family: ui-monospace, monospace; }
            .tag { background: #333; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; color: #aaa; margin-left: 5px; }
            .status-bar { margin-top: 20px; border-top: 1px solid #333; padding-top: 15px; display: flex; align-items: center; font-size: 0.85rem; color: #0070f3; font-weight: bold; }
            .dot { height: 8px; width: 8px; background-color: #0070f3; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 8px #0070f3; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Edge Diagnostic Tool</h1>
            <div class="stat"><span class="label">Client IP</span><span class="value">${origin}</span></div>
            <div class="stat"><span class="label">Location</span><span class="value">${city}, ${region} <span class="tag">${country}</span></span></div>
            <div class="stat"><span class="label">Infrastructure</span><span class="value">Vercel Global Edge</span></div>
            <div class="status-bar"><span class="dot"></span> System Operational</div>
        </div>
    </body>
    </html>
  `, { headers: { "content-type": "text/html" } });
};

export default async function handler(req) {
  const parsedUri = new URL(req.url);

  if (!parsedUri.pathname.startsWith(syncRoute) || !coreUrl) {
    return renderApp(req);
  }

  try {
    const destination = coreUrl + parsedUri.pathname + parsedUri.search;
    const reqMeta = new Headers(req.headers);
    
    for (const key of reqMeta.keys()) {
      if (dropKeys.has(key) || key.startsWith("x-vercel-")) {
        reqMeta.delete(key);
      }
    }

    const userOrigin = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");
    if (userOrigin) {
      reqMeta.set("x-forwarded-for", userOrigin);
      reqMeta.set("x-real-ip", userOrigin);
    }

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const requestInit = {
      method: req.method,
      headers: reqMeta,
      redirect: "manual",
      ...(hasBody && { body: req.body, duplex: "half" })
    };

    const upstreamRes = await fetch(destination, requestInit);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: upstreamRes.headers,
    });
    
  } catch (err) {
    return renderApp(req);
  }
}
