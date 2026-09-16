// Captures the full design set of all three interfaces (desktop and phone) through the Chrome DevTools
// Protocol against locally running production servers (web 3000, merchant 3001, admin 3002, API 4000).
// Usage: node scripts/screenshots/capture-designs.mjs <outDir> <totpModulePath>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [outDir, totpModule] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const require = createRequire(import.meta.url);
const totp = require(totpModule);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ORIGINS = { web: "http://localhost:3000", merchant: "http://localhost:3001", admin: "http://localhost:3002" };
const API = "http://localhost:4000";
const PORT = 9334;
const DESKTOP = 1440;
const PHONE = 390;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(
  EDGE,
  [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--lang=ar",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "tj-designs-"))}`, "about:blank",
  ],
  { stdio: "ignore" },
);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Edge DevTools endpoint not available");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;

async function viewport(width, height) {
  const mobile = width < 600;
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}

async function go(origin, path, settleMs = 2500) {
  const loaded = new Promise((r) => {
    const l = (m) => m.method === "Page.loadEventFired" && (listeners.splice(listeners.indexOf(l), 1), r());
    listeners.push(l);
  });
  await send("Page.navigate", { url: ORIGINS[origin] + path });
  await Promise.race([loaded, sleep(60000)]);
  await sleep(settleMs);
}

async function waitFor(expression, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await evaluate(`!!(${expression})`)) return true;
    await sleep(400);
  }
  console.warn(`  (timed out waiting for: ${expression.slice(0, 80)})`);
  return false;
}

const SETTLED = "document.querySelector('main') && !document.querySelector('main .animate-pulse, main [aria-busy=true]')";

/** Full-page capture (up to maxHeight CSS px), or just the viewport with `fold`. */
async function shot(name, width, { maxHeight = 2600, fold = 0 } = {}) {
  const height = fold || Math.min(maxHeight, Math.max(800, await evaluate("document.documentElement.scrollHeight")));
  await viewport(width, height);
  await sleep(1200);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`saved ${name}.png (${width}x${height})`);
}

async function page(name, origin, path, width, opts = {}) {
  try {
    await viewport(width, opts.fold || 900);
    await go(origin, path);
    await waitFor(opts.ready ?? SETTLED);
    if (opts.before) await evaluate(opts.before);
    await sleep(opts.extraMs ?? 800);
    await shot(name, width, opts);
  } catch (e) {
    console.warn(`  ${name} failed: ${e.message}`);
  }
}

const FILL = `(sel, value) => { const el = document.querySelector(sel); const k = Object.keys(el).find(k => k.startsWith('__reactProps$')); el[k].onChange({ target: { value }, currentTarget: el }); }`;

async function login(origin, path, phone, password) {
  await viewport(DESKTOP, 900);
  await go(origin, path, 2000);
  await waitFor("document.querySelector('main input[type=password]')");
  await evaluate(`(${FILL})('main input[type=tel]', '${phone}')`);
  await evaluate(`(${FILL})('main input[type=password]', '${password}')`);
  await sleep(300);
  await evaluate("document.querySelector('main form button[type=submit]').click()");
  await sleep(6000);
}

// Showcase state: no one-time notices, a chosen governorate, no browser permission prompts
const QUIET = `
  try {
    localStorage.setItem('tj_cookie_notice', '1');
    localStorage.setItem('tj_gov_decided', '1');
  } catch {}
  try { Object.defineProperty(Notification, 'permission', { get: () => 'denied' }); } catch {}
`;

try {
  await send("Page.enable");
  await send("Runtime.enable");

  // ---------- first visit (before quieting): location chooser and cookie notice ----------
  await send("Browser.setPermission", { permission: { name: "geolocation" }, setting: "denied" }).catch(() => {});
  await page("buyer-first-visit-mobile", "web", "/", PHONE, { fold: 844, ready: "document.querySelector('[role=dialog]')", extraMs: 1500 });

  await send("Page.addScriptToEvaluateOnNewDocument", { source: QUIET });
  await send("Network.enable");
  await send("Network.setCookie", { name: "tujjar_gov", value: "damascus", url: ORIGINS.web });

  const product = (await (await fetch(`${API}/products?store=brocade-alsham&pageSize=1`)).json()).items[0];
  const productPath = `/products/${product.id}`;

  // ---------- buyer: public ----------
  await page("buyer-home", "web", "/", DESKTOP, { maxHeight: 3200 });
  await page("buyer-home-mobile", "web", "/", PHONE, { maxHeight: 2600 });
  await page("buyer-search", "web", "/search?q=%D8%A8%D8%B1%D9%88%D9%83%D8%A7%D8%B1", DESKTOP, { maxHeight: 1600 });
  await page("buyer-search-mobile", "web", "/search?offers=1", PHONE, { maxHeight: 1800 });
  await page("buyer-markets", "web", "/markets", DESKTOP, { maxHeight: 2000 });
  await page("buyer-market", "web", "/markets/al-hamidiyah", DESKTOP, { maxHeight: 1800 });
  await page("buyer-store", "web", "/stores/brocade-alsham", DESKTOP, { maxHeight: 3000 });
  await page("buyer-store-mobile", "web", "/stores/brocade-alsham", PHONE, { maxHeight: 2800 });
  await page("buyer-product", "web", productPath, DESKTOP, { maxHeight: 2200 });
  await page("buyer-product-mobile", "web", productPath, PHONE, { maxHeight: 2200 });
  await page("buyer-verification", "web", "/verification", DESKTOP, { maxHeight: 1800 });
  await page("buyer-gov-menu", "web", "/", DESKTOP, {
    fold: 900,
    before: "document.querySelector('button[aria-haspopup=listbox]').click()",
  });
  await page("buyer-login-mobile", "web", "/account/login", PHONE, { fold: 844 });
  await page("buyer-register", "web", "/account/register", DESKTOP, { maxHeight: 1300 });

  // ---------- buyer: signed in ----------
  await login("web", "/account/login", "0900000200", "Buyer@2026");
  await page("buyer-account-mobile", "web", "/account", PHONE, { maxHeight: 1400 });
  await page("buyer-notifications-mobile", "web", "/notifications", PHONE, { maxHeight: 1500 });
  await page("buyer-notifications", "web", "/notifications", DESKTOP, { maxHeight: 1400 });
  await page("buyer-notification-settings", "web", "/notifications/settings", DESKTOP, { maxHeight: 1500 });
  await page("buyer-bell", "web", "/", DESKTOP, {
    fold: 900,
    ready: "document.querySelector('button[aria-label^=الإشعارات]')",
    before: "document.querySelector('button[aria-label^=الإشعارات]').click()",
    extraMs: 2500,
  });
  await page("buyer-following", "web", "/account/following", DESKTOP, { maxHeight: 1300 });
  await page("buyer-favorites-mobile", "web", "/favorites", PHONE, { maxHeight: 1800 });
  await page("buyer-store-signed-in", "web", "/stores/brocade-alsham", DESKTOP, { fold: 900 });

  // ---------- merchant ----------
  await page("merchant-join", "merchant", "/join", DESKTOP, { maxHeight: 2200 });
  await page("merchant-join-mobile", "merchant", "/join", PHONE, { maxHeight: 2400 });
  await page("merchant-login", "merchant", "/login", DESKTOP, { fold: 900 });
  await login("merchant", "/login", "0900000100", "Tujjar@2026");
  await page("merchant-dashboard", "merchant", "/dashboard", DESKTOP, { maxHeight: 2200, extraMs: 2500 });
  await page("merchant-dashboard-mobile", "merchant", "/dashboard", PHONE, { maxHeight: 2400, extraMs: 2500 });
  await page("merchant-products", "merchant", "/dashboard/products", DESKTOP, { maxHeight: 1700 });
  await page("merchant-product-form", "merchant", "/dashboard/products/new", DESKTOP, { maxHeight: 2400 });
  await page("merchant-verification", "merchant", "/dashboard/verification", DESKTOP, { maxHeight: 2400 });
  await page("merchant-reviews", "merchant", "/dashboard/reviews", DESKTOP, { maxHeight: 1900 });
  await page("merchant-store-settings", "merchant", "/dashboard/store", DESKTOP, { maxHeight: 2400 });
  await page("merchant-notifications-mobile", "merchant", "/notifications", PHONE, { maxHeight: 1400 });

  // ---------- admin ----------
  await page("admin-login", "admin", "/admin/login", DESKTOP, { fold: 900 });
  await login("admin", "/admin/login", "0900000001", "Admin@2026");
  await waitFor("document.querySelector('.select-all')?.textContent.length > 20");
  await shot("admin-2fa-setup", DESKTOP, { maxHeight: 1300 });
  const secret = await evaluate("document.querySelector('.select-all').textContent.replace(/\\s/g, '')");
  const code = totp.hotp(totp.base32Decode(secret), totp.currentStep());
  await evaluate(`(${FILL})('main form input', '${code}')`);
  await sleep(300);
  await evaluate("document.querySelector('main form button[type=submit]').click()");
  await sleep(5000);
  for (const [tab, name, maxHeight] of [
    ["verifications", "admin-verifications", 1800],
    ["products", "admin-products", 1800],
    ["stores", "admin-stores", 1900],
    ["reports", "admin-reports", 1600],
    ["reviews", "admin-reviews", 1800],
    ["markets", "admin-markets", 2200],
    ["categories", "admin-categories", 1900],
    ["campaigns", "admin-campaigns", 1600],
    ["audit", "admin-audit", 1600],
  ]) {
    await page(name, "admin", `/admin?tab=${tab}`, DESKTOP, { maxHeight, extraMs: 2500 });
  }
  await page("admin-mobile", "admin", "/admin?tab=reviews", PHONE, { maxHeight: 2000, extraMs: 2500 });
} catch (e) {
  console.error("capture failed:", e.message);
  process.exitCode = 1;
} finally {
  ws.close();
  edge.kill();
}
