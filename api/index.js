export const config = { runtime: "edge" };

// Pre-clean the target and pre-define static responses to save memory
const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
const ERR_MISCONFIGURED = new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
const ERR_BAD_GATEWAY = new Response("Bad Gateway: Tunnel Failed", { status: 502 });

// Headers we strictly want to ignore
const IGNORE_PREFIX = "x-vercel-";
const STRIP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", 
  "x-forwarded-proto", "x-forwarded-port"
]);

export default function handler(req) {
  if (!TARGET_BASE) return ERR_MISCONFIGURED;

  try {
    const { pathname, search } = new URL(req.url);
    const targetUrl = TARGET_BASE + pathname + search;

    // Use the incoming headers directly to initialize, then delete unwanted ones
    // This is often faster than iterating and building a new Headers object from scratch
    const newHeaders = new Headers(req.headers);
    
    // Efficiently handle IP forwarding
    const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");
    
    for (const key of newHeaders.keys()) {
      if (STRIP_HEADERS.has(key) || key.startsWith(IGNORE_PREFIX)) {
        newHeaders.delete(key);
      }
    }

    if (clientIp) {
      newHeaders.set("x-forwarded-for", clientIp);
    }

    // Return the promise directly without 'await' to save a microtask tick
    return fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
    
  } catch (err) {
    console.error("relay error:", err);
    return ERR_BAD_GATEWAY;
  }
}