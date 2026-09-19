// Purchase orders: a buyer fills one basket per shop, the shop confirms, both sides are kept in the loop.
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
const STORE = "brocade-alsham";
const RESET = `DELETE FROM "Order" WHERE "buyerId" IN (SELECT id FROM "User" WHERE phone = '${BUYER.e164}'); DELETE FROM "Notification" WHERE type LIKE 'order.%';`;
sql(RESET);

const anon = jar();
const buyer = jar();
const merchant = jar();
const other = jar();

try {
  const store = (await anon(`/stores/${STORE}`)).json;
  const catalogue = (await anon(`/products?store=${STORE}&pageSize=3`)).json.items;
  const product = catalogue[0];
  const second = catalogue[1];
  const governorates = (await anon("/governorates")).json.filter((g) => g.status === "ACTIVE");
  const damascus = governorates.find((g) => g.slug === "damascus") ?? governorates[0];
  const base = {
    items: [{ productId: product.id, quantity: 3 }],
    fulfillment: "DELIVERY",
    payment: "CASH_ON_DELIVERY",
    governorateId: damascus.id,
    address: "المزة، شارع الجلاء، بناء 12",
    note: "بعد العصر أفضل",
  };
  check("The shop in the test delivers", store.hasDelivery === true, `hasDelivery=${store.hasDelivery}`);

  let r = await anon("/orders", { method: "POST", body: base });
  check("A visitor who is not signed in cannot order", r.code === 401 || r.code === 403, `got ${r.code}`);

  r = await buyer("/auth/login", { method: "POST", body: { phone: BUYER.phone, password: BUYER.password } });
  check("The buyer signs in", r.code === 200, `got ${r.code}`);
  const me = (await buyer("/auth/me")).json;

  r = await buyer("/orders", { method: "POST", body: { ...base, items: [{ productId: product.id, quantity: 0 }] } });
  check("The quantity must be at least one", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, items: [] } });
  check("An empty basket is refused", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, address: "" } });
  check("Delivery needs an address", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, governorateId: undefined } });
  check("Delivery needs a governorate", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, payment: "CASH_AT_SHOP" } });
  check("Paying at the shop does not fit a delivery", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, fulfillment: "PICKUP", payment: "CASH_ON_DELIVERY" } });
  check("Paying the courier does not fit a pickup", r.code === 400, `got ${r.code}`);
  r = await buyer("/orders", { method: "POST", body: { ...base, items: [{ productId: "cmzzzzzzzzzzzzzzzzzzzzzz", quantity: 1 }] } });
  check("An unknown product is refused", r.code === 404, `got ${r.code}`);
  const otherShopProduct = (await anon("/products?store=alnoor-solar&pageSize=1")).json.items[0];
  if (otherShopProduct) {
    r = await buyer("/orders", {
      method: "POST",
      body: { ...base, items: [{ productId: product.id, quantity: 1 }, { productId: otherShopProduct.id, quantity: 1 }] },
    });
    check("A basket cannot mix two shops", r.code === 400, `got ${r.code}`);
  } else {
    check("A second shop is available for the mixed-basket check", false, "no product found");
  }
  r = await buyer("/orders", { method: "POST", body: { ...base, payment: "CARD" } });
  check("An unsupported payment method is refused", r.code === 400, `got ${r.code}`);

  r = await buyer("/orders", { method: "POST", body: base });
  check("The buyer places the order", r.code === 201 && !!r.json?.ref, `got ${r.code}`);
  const order = r.json;
  r = await buyer("/orders", { method: "POST", body: base });
  check("Tapping send twice makes one order", r.code === 201 && r.json.id === order.id, `${order.id} vs ${r.json?.id}`);

  const mine = (await buyer("/orders/mine")).json.items.find((o) => o.id === order.id);
  check(
    "The buyer follows the order with its lines, price, address and payment",
    !!mine &&
      mine.items.length === 1 &&
      mine.items[0].quantity === 3 &&
      mine.total === mine.items[0].unitPrice * 3 &&
      mine.address === base.address &&
      mine.payment === "CASH_ON_DELIVERY" &&
      mine.status === "NEW" &&
      mine.store.slug === STORE,
    JSON.stringify(mine)?.slice(0, 160),
  );

  r = await merchant("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000100", password: "Tujjar@2026" } });
  check("The shop owner signs in", r.code === 200, `got ${r.code}`);
  const theirs = (await merchant("/merchant/orders?status=NEW", { client: "merchant" })).json;
  const forShop = theirs.items.find((o) => o.id === order.id);
  check(
    "The shop sees the order with the buyer's own name, number and address",
    !!forShop && forShop.buyerPhone === BUYER.e164 && forShop.buyerName === me.name && forShop.address === base.address,
    JSON.stringify(forShop)?.slice(0, 160),
  );
  check("Waiting orders are counted for the menu badge", (await merchant("/merchant/orders/pending", { client: "merchant" })).json.newOrders >= 1);
  check("The shop was notified", Number(sql(`SELECT count(*) FROM "Notification" WHERE type = 'order.new';`)) >= 1);

  r = await merchant(`/merchant/orders/${order.id}`, {
    client: "merchant",
    method: "PATCH",
    body: { status: "CONFIRMED", deliveryFee: 15000, merchantNote: "جاهز بكرا قبل الظهر" },
  });
  check(
    "The shop confirms with a delivery fee and a note",
    r.code === 200 && r.json.status === "CONFIRMED" && r.json.deliveryFee === 15000 && !!r.json.confirmedAt,
    `got ${r.code}`,
  );
  check("The buyer is notified of the confirmation", Number(sql(`SELECT count(*) FROM "Notification" WHERE type = 'order.confirmed';`)) >= 1);

  const afterConfirm = (await buyer("/orders/mine")).json.items.find((o) => o.id === order.id);
  check("The buyer reads the shop's answer", afterConfirm.deliveryFee === 15000 && afterConfirm.merchantNote === "جاهز بكرا قبل الظهر");

  // Another shop must not see or touch it
  r = await other("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000101", password: "Tujjar@2026" } });
  if (r.code === 200) {
    const list = (await other("/merchant/orders", { client: "merchant" })).json;
    check("Another shop cannot read these orders", !list.items.some((o) => o.id === order.id), `${list.items.length} items`);
    r = await other(`/merchant/orders/${order.id}`, { client: "merchant", method: "PATCH", body: { status: "DONE" } });
    check("…nor change them", r.code === 404, `got ${r.code}`);
  } else {
    check("Another merchant account is available for the isolation check", false, `login ${r.code}`);
  }
  r = await anon("/merchant/orders", { client: "merchant" });
  check("Buyer addresses are not readable without signing in", r.code === 401 || r.code === 403, `got ${r.code}`);

  r = await buyer(`/orders/${order.id}/cancel`, { method: "PATCH", body: { reason: "غيّرت رأيي" } });
  check("The buyer can cancel before delivery", r.code === 200 && r.json.status === "CANCELLED" && r.json.cancelReason === "غيّرت رأيي", `got ${r.code}`);
  r = await merchant(`/merchant/orders/${order.id}`, { client: "merchant", method: "PATCH", body: { status: "DONE" } });
  check("A cancelled order cannot be reopened", r.code === 400, `got ${r.code}`);

  // A basket with two products from the same shop
  if (second) {
    r = await buyer("/orders", {
      method: "POST",
      body: { ...base, items: [{ productId: product.id, quantity: 2 }, { productId: second.id, quantity: 1 }] },
    });
    const basket = (await buyer("/orders/mine")).json.items.find((o) => o.id === r.json.id);
    const sum = basket?.items.reduce((t, i) => t + (i.lineTotal ?? 0), 0);
    check(
      "Several products from one shop become one order with one total",
      r.code === 201 && basket?.items.length === 2 && basket.total === sum,
      JSON.stringify(basket?.items)?.slice(0, 140),
    );
    await buyer(`/orders/${r.json.id}/cancel`, { method: "PATCH", body: {} });
  } else {
    check("A second product is available for the basket check", false, "no product found");
  }

  // A pickup order, paid at the shop
  r = await buyer("/orders", {
    method: "POST",
    body: { ...base, fulfillment: "PICKUP", payment: "CASH_AT_SHOP", address: undefined, governorateId: undefined, items: [{ productId: product.id, quantity: 1 }] },
  });
  check("A pickup order needs no address", r.code === 201, `got ${r.code} ${JSON.stringify(r.json)?.slice(0, 80)}`);
  const pickup = r.json;
  r = await merchant(`/merchant/orders/${pickup.id}`, { client: "merchant", method: "PATCH", body: { status: "CONFIRMED", deliveryFee: 5000 } });
  check("A pickup order takes no delivery fee", r.code === 400, `got ${r.code}`);
  r = await merchant(`/merchant/orders/${pickup.id}`, { client: "merchant", method: "PATCH", body: { status: "DONE" } });
  check("The shop marks it delivered", r.code === 200 && r.json.status === "DONE" && !!r.json.closedAt, `got ${r.code}`);

  const contacts = sql(`SELECT count(*) FROM "StoreContact" c JOIN "User" u ON u.id = c."buyerId" WHERE u.phone = '${BUYER.e164}';`);
  check("Ordering counts as contacting the shop, so the buyer can review it", Number(contacts) >= 1, `rows=${contacts}`);
} finally {
  sql(RESET);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
