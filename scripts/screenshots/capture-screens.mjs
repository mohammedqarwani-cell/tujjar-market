// Captures every screen used in the profile document through the Chrome DevTools Protocol:
// public pages (desktop + true mobile emulation), then signed-in merchant, buyer and staff screens.
// Usage: node cdp-shots.mjs <outDir> <totpModulePath>
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [outDir, totpModule] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const totp = require(totpModule);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";
const API = "http://localhost:4000";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "tj-cdp-"))}`, "about:blank",
], { stdio: "ignore" });

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
  } else if (msg.method) {
    listeners.forEach((l) => l(msg));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.value;
}

async function viewport(width, height) {
  const mobile = width < 600;
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}

async function go(path, settleMs = 5000) {
  const loaded = new Promise((r) => {
    const l = (m) => m.method === "Page.loadEventFired" && (listeners.splice(listeners.indexOf(l), 1), r());
    listeners.push(l);
  });
  await send("Page.navigate", { url: WEB + path });
  await Promise.race([loaded, sleep(60000)]);
  await sleep(settleMs);
}

async function waitFor(expression, timeoutMs = 45000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await evaluate(`!!(${expression})`)) return true;
    await sleep(500);
  }
  console.warn(`  (timed out waiting for: ${expression.slice(0, 70)})`);
  return false;
}

async function shot(name, width, maxHeight) {
  // The Next.js dev-mode indicator isn't part of the product
  await evaluate("document.querySelectorAll('nextjs-portal').forEach(e => e.remove())");
  const height = Math.min(maxHeight, Math.max(700, await evaluate("document.documentElement.scrollHeight")));
  await viewport(width, height);
  await sleep(1500);
  await evaluate("document.querySelectorAll('nextjs-portal').forEach(e => e.remove())");
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`saved ${name}.png (${width}x${height})`);
}

async function capture(name, path, width, maxHeight, ready = "document.querySelector('main h1, main h2')") {
  await viewport(width, 900);
  await go(path);
  await waitFor(ready);
  await shot(name, width, maxHeight);
}

// Fills a React-controlled input by calling its own onChange handler
const FILL = `(sel, value) => { const el = document.querySelector(sel); const k = Object.keys(el).find(k => k.startsWith('__reactProps$')); el[k].onChange({ target: { value }, currentTarget: el }); }`;

async function login(path, phone, password) {
  await viewport(1280, 900);
  await go(path, 3000);
  await waitFor("document.querySelector('main input[type=password]')");
  await evaluate(`(${FILL})('main input[type=tel]', '${phone}')`);
  await evaluate(`(${FILL})('main input[type=password]', '${password}')`);
  await sleep(400);
  await evaluate("document.querySelector('main form button[type=submit]').click()");
  await sleep(9000);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");

  const solar = await (await fetch(`${API}/products?store=alnoor-solar&pageSize=1`)).json();
  const productPath = `/products/${solar.items[0].id}`;

  // Public pages
  await capture("home-desktop", "/", 1280, 2300, "document.querySelectorAll('main article').length > 4");
  await capture("home-mobile", "/", 390, 1700, "document.querySelectorAll('main article').length > 4");
  await capture("search", "/search?category=solar-energy", 1280, 1150, "document.querySelectorAll('main article').length > 0");
  await capture("markets", "/markets", 1280, 1250);
  await capture("market", "/markets/al-hamidiyah", 1280, 1150);
  await capture("store", "/stores/brocade-alsham", 1280, 1500, "document.querySelectorAll('main article').length > 0");
  await capture("product", productPath, 1280, 1350);
  await capture("product-mobile", productPath, 390, 1300);
  await capture("join", "/join", 1280, 1000);
  await capture("register", "/account/register", 1280, 900);
  await capture("admin-login", "/admin/login", 1280, 850);
  await capture("terms", "/terms", 1280, 1100);

  // Merchant
  await login("/login", "0900000100", "Tujjar@2026");
  await waitFor("location.pathname === '/dashboard' && document.querySelectorAll('main figure button').length > 0");
  await shot("merchant-dashboard", 1280, 1900);
  await go("/dashboard/products");
  await waitFor("document.querySelectorAll('main article').length > 0");
  await shot("merchant-products", 1280, 1150);
  await go("/dashboard/products/new");
  await waitFor("document.querySelectorAll('main select option').length > 1");
  await shot("merchant-product-form", 1280, 1900);
  await go("/dashboard/store");
  await waitFor("document.querySelector('main input[maxlength=\"60\"]')?.value");
  await shot("merchant-store-settings", 1280, 1900);

  // Buyer
  await login("/account/login", "0900000200", "Buyer@2026");
  await waitFor("location.pathname === '/account' && document.querySelector('main h1')");
  await shot("buyer-account", 1280, 900);

  // Staff: first sign-in forces two-factor setup, then the admin panel
  await login("/admin/login", "0900000001", "Admin@2026");
  await waitFor("document.body.innerText.includes('Authenticator')");
  await waitFor("document.querySelector('.select-all')?.textContent.length > 20");
  await shot("admin-2fa-setup", 1280, 1000);
  const secret = await evaluate("document.querySelector('.select-all').textContent.replace(/\\s/g, '')");
  const code = totp.hotp(totp.base32Decode(secret), totp.currentStep());
  await evaluate(`(${FILL})('main form input', '${code}')`);
  await sleep(400);
  await evaluate("document.querySelector('main form button[type=submit]').click()");
  await waitFor("document.querySelectorAll('main .text-3xl').length >= 4 && ![...document.querySelectorAll('main .text-3xl')].some(e => e.textContent === '—')");
  await sleep(2500);
  await shot("admin-panel", 1280, 1400);
  await evaluate("[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'المتاجر')?.click()");
  await waitFor("document.querySelectorAll('main article').length > 0");
  await sleep(1500);
  await shot("admin-stores", 1280, 1700);
  await evaluate("[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'سجل التدقيق')?.click()");
  await waitFor("document.querySelectorAll('main table tbody tr').length > 0");
  await sleep(1500);
  await shot("admin-audit-log", 1280, 1100);
} catch (e) {
  console.error("capture failed:", e.message);
  process.exitCode = 1;
} finally {
  ws.close();
  edge.kill();
}
