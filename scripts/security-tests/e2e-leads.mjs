// Buyer requests that reach the shop's dashboard ("طلبات الزبائن").
// Needs the local API on :4000 and Docker Postgres.
import { execFileSync } from "node:child_process";

const API = process.env.API ?? "http://localhost:4000";
const sql = (q) => execFileSync("docker", ["exec", "-i", "tujjar_postgres", "psql", "-U", "tujjar", "-d", "tujjar_db", "-q", "-t", "-A"], { input: q }).toString().trim();

let passed = 0;
let failed = 0;
const check = (name, ok, info = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !info ? "" : `  (${info})`}`);
};

function jar() {
  const cookies = new Map();
  return async (p, { method = "GET", body, client = "web" } = {}) => {
    const headers = { "X-Client": client, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { code: res.status, json };
  };
}

const BUYER = { phone: "0900000200", password: "Buyer@2026", e164: "963900000200" };
const RESET = `DELETE FROM "Lead" WHERE "buyerId" IN (SELECT id FROM "User" WHERE phone = '963900000200');`;
sql(RESET);

const anon = jar();
const buyer = jar();
const merchant = jar();
const other = jar();

try {
  // The merchant seed account owns "brocade-alsham"
  const store = (await anon("/stores/brocade-alsham")).json;
  const product = (await anon("/products?store=brocade-alsham&pageSize=1")).json.items[0];
  const base = { storeSlug: store.slug, productId: product.id, quantity: 2, note: "بدي ياه لون غامق" };

  let r = await anon("/leads", { method: "POST", body: base });
  check("A visitor who is not signed in cannot send a request", r.code === 401 || r.code === 403, `got ${r.code}`);

  r = await buyer("/auth/login", { method: "POST", body: { phone: BUYER.phone, password: BUYER.password } });
  check("The buyer signs in", r.code === 200, `got ${r.code}`);
  const me = (await buyer("/auth/me")).json;

  r = await buyer("/leads", { method: "POST", body: { ...base, storeSlug: "no-such-store" } });
  check("A request to an unknown shop is refused", r.code === 404, `got ${r.code}`);
  r = await buyer("/leads", { method: "POST", body: { ...base, productId: "cmzzzzzzzzzzzzzzzzzzzzzz" } });
  check("A product from another shop is refused", r.code === 404, `got ${r.code}`);
  r = await buyer("/leads", { method: "POST", body: { ...base, name: "اسم مزيّف", phone: "0999999999" } });
  check("A name or number sent by hand is refused; the account decides", r.code === 400, `got ${r.code}`);

  r = await buyer("/leads", { method: "POST", body: base });
  check("The buyer sends a request", r.code === 201 && r.json?.ok, `got ${r.code}`);
  const first = r.json.id;
  r = await buyer("/leads", { method: "POST", body: base });
  check("Sending twice in a row does not duplicate it", r.code === 201 && r.json.id === first, `${first} vs ${r.json?.id}`);

  r = await merchant("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000100", password: "Tujjar@2026" } });
  check("The shop owner signs in", r.code === 200, `got ${r.code}`);
  let list = await merchant("/merchant/leads?status=NEW", { client: "merchant" });
  const mine = list.json.items.find((x) => x.id === first);
  check(
    "The request is waiting in the shop's dashboard with the account's own name and number",
    !!mine && mine.phone === BUYER.e164 && mine.name === me.name && mine.quantity === 2 && mine.product.id === product.id,
    JSON.stringify(mine)?.slice(0, 140),
  );
  const pending = (await merchant("/merchant/leads/pending", { client: "merchant" })).json;
  check("Unanswered requests are counted for the menu badge", pending.newLeads >= 1, JSON.stringify(pending));
  check("The merchant is notified", Number(sql(`SELECT count(*) FROM "Notification" WHERE type = 'lead.new';`)) >= 1);

  r = await merchant(`/merchant/leads/${first}`, { client: "merchant", method: "PATCH", body: { status: "CONTACTED" } });
  check("The merchant marks it as answered", r.code === 200 && r.json.status === "CONTACTED" && !!r.json.handledAt, `got ${r.code}`);
  r = await merchant(`/merchant/leads/${first}`, { client: "merchant", method: "PATCH", body: { status: "SOLD" } });
  check("An unknown status is refused", r.code === 400, `got ${r.code}`);

  // Another merchant must not see or touch it
  r = await other("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000101", password: "Tujjar@2026" } });
  if (r.code === 200) {
    const theirs = (await other("/merchant/leads", { client: "merchant" })).json;
    check("Another shop cannot read these requests", !theirs.items.some((x) => x.id === first), `${theirs.items.length} items`);
    r = await other(`/merchant/leads/${first}`, { client: "merchant", method: "PATCH", body: { status: "DONE" } });
    check("…nor change them", r.code === 404, `got ${r.code}`);
  } else {
    check("Another merchant account is available for the isolation check", false, `login ${r.code}`);
  }

  r = await anon("/merchant/leads", { client: "merchant" });
  check("Buyer numbers are not readable without signing in", r.code === 401 || r.code === 403, `got ${r.code}`);

  const contacts = sql(`SELECT count(*) FROM "StoreContact" c JOIN "User" u ON u.id = c."buyerId" WHERE u.phone = '${BUYER.e164}';`);
  check("The request counts as contacting the shop, so the buyer can review it", Number(contacts) >= 1, `rows=${contacts}`);
} finally {
  sql(RESET);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
