// Homepage content managed by the platform team: banners, section order, paid store showcase.
// Needs the local API on :4000 (built, so dist/src/auth/totp.js exists) and Docker Postgres.
// Temporarily enables admin TOTP and restores everything it changes at the end.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = process.env.API ?? "http://localhost:4000";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const totp = createRequire(import.meta.url)(path.join(root, "apps/api/dist/src/auth/totp.js"));

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
  return async (p, { method = "GET", body, client = "admin", raw } = {}) => {
    const headers = { "X-Client": client, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    let payload = raw;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${API}${p}`, { method, headers, body: payload });
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

const RESET = `DELETE FROM "StorePromotion" WHERE plan = 'باقة الواجهة'; DELETE FROM "HomeBanner" WHERE title LIKE 'e2e-home%'; DELETE FROM "AppSetting" WHERE key = 'home.layout'; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = '963900000001';`;
sql(RESET);

const anon = jar();
const admin = jar();
const buyer = jar();

try {
  // ---------- access ----------
  let r = await anon("/admin/home/banners", { method: "POST", body: {} });
  check("Anonymous visitors cannot manage banners", r.code === 401 || r.code === 403, `got ${r.code}`);
  r = await buyer("/auth/login", { method: "POST", client: "web", body: { phone: "0900000200", password: "Buyer@2026" } });
  r = await buyer("/admin/home/layout", { method: "PUT", client: "web", body: {} });
  check("A buyer session cannot change the homepage", r.code === 401 || r.code === 403, `got ${r.code}`);

  await admin("/auth/login", { method: "POST", body: { phone: "0900000001", password: "Admin@2026" } });
  const setup = (await admin("/auth/totp/setup", { method: "POST" })).json;
  r = await admin("/auth/totp/enable", { method: "POST", body: { code: totp.hotp(totp.base32Decode(setup.secret), totp.currentStep()) } });
  check("Admin signs in with two-factor", r.code === 200, `got ${r.code}`);

  // ---------- defaults ----------
  r = await anon("/home");
  check(
    "The homepage sends the default layout with every section",
    r.code === 200 && r.json.layout?.sections?.length === 11 && Array.isArray(r.json.showcase) && Array.isArray(r.json.banners),
    JSON.stringify(r.json?.layout)?.slice(0, 120),
  );

  // ---------- banner validation ----------
  const govs = (await anon("/governorates")).json;
  const damascus = govs.find((g) => g.slug === "damascus");
  const other = govs.find((g) => g.slug !== "damascus");
  const base = { eyebrow: "e2e", title: "e2e-home banner", cta: "Go", href: "/search?offers=1", tone: "brand" };
  r = await admin("/admin/home/banners", { method: "POST", body: { ...base, href: "https://evil.example" } });
  check("Banners cannot link to other websites", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/banners", { method: "POST", body: { ...base, href: "//evil.example" } });
  check("Protocol-relative links are refused", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/banners", { method: "POST", body: { ...base, imageUrl: "https://evil.example/x.png" } });
  check("Banner pictures must come from the platform's storage", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/banners", { method: "POST", body: { ...base, tone: "neon" } });
  check("Unknown colours are refused", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/banners", { method: "POST", body: { ...base, startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" } });
  check("A banner cannot end before it starts", r.code === 400, `got ${r.code}`);

  // ---------- targeting and scheduling ----------
  const a = (await admin("/admin/home/banners", { method: "POST", body: { ...base, title: "e2e-home damascus", governorateId: damascus.id } })).json;
  const b = (await admin("/admin/home/banners", { method: "POST", body: { ...base, title: "e2e-home everywhere" } })).json;
  const c = (await admin("/admin/home/banners", { method: "POST", body: { ...base, title: "e2e-home later", startsAt: new Date(Date.now() + 86400_000).toISOString() } })).json;
  const d = (await admin("/admin/home/banners", { method: "POST", body: { ...base, title: "e2e-home expired", endsAt: new Date(Date.now() - 60_000).toISOString() } })).json;
  const titles = async (gov) => (await anon(`/home${gov ? `?gov=${gov}` : ""}`)).json.banners.map((x) => x.title);
  let dam = await titles("damascus");
  const elsewhere = await titles(other.slug);
  check("A Damascus banner shows in Damascus", dam.includes("e2e-home damascus") && dam.includes("e2e-home everywhere"), dam.join(","));
  check("…and not in other governorates", !elsewhere.includes("e2e-home damascus") && elsewhere.includes("e2e-home everywhere"), elsewhere.join(","));
  check("Scheduled and expired banners stay hidden", !dam.includes("e2e-home later") && !dam.includes("e2e-home expired"), dam.join(","));
  check("Banners come in the team's order", dam.indexOf("e2e-home damascus") < dam.indexOf("e2e-home everywhere"), dam.join(","));

  r = await admin(`/admin/home/banners/${b.id}/move`, { method: "POST", body: { direction: -1 } });
  dam = await titles("damascus");
  check("Moving a banner up changes the order", r.code === 201 && dam.indexOf("e2e-home everywhere") < dam.indexOf("e2e-home damascus"), dam.join(","));

  r = await admin(`/admin/home/banners/${b.id}`, { method: "PATCH", body: { ...base, title: "e2e-home everywhere", isActive: false } });
  dam = await titles("damascus");
  check("Turning a banner off hides it", r.code === 200 && !dam.includes("e2e-home everywhere"), dam.join(","));

  await anon(`/home/banners/${a.id}/click`, { method: "POST", client: "web" });
  await anon(`/home/banners/${a.id}/click`, { method: "POST", client: "web" });
  const list = (await admin("/admin/home/banners")).json;
  check("Taps on a banner are counted", list.find((x) => x.id === a.id)?.clicks === 2, JSON.stringify(list.find((x) => x.id === a.id)));
  r = { code: (await fetch(`${API}/home/banners/${a.id}/click`, { method: "POST" })).status };
  check("Click counting still requires the X-Client header", r.code === 403, `got ${r.code}`);

  // ---------- layout ----------
  const sections = [{ id: "latest", enabled: false, title: "" }, { id: "offers", enabled: true, title: "عروض الجمعة" }, { id: "bogus", enabled: true }];
  r = await admin("/admin/home/layout", {
    method: "PUT",
    body: { sections, autoBanners: false, offers: { countdown: "until", until: "2030-01-01T10:00:00Z" }, quickSearches: ["  شاي ", "شاي", "قهوة"], greeting: false },
  });
  check("The team saves a layout", r.code === 200, `got ${r.code} ${JSON.stringify(r.json)?.slice(0, 120)}`);
  const home = (await anon("/home?gov=damascus")).json;
  const ids = home.layout.sections.map((s) => s.id);
  check(
    "Order, hiding and titles apply; unknown sections are dropped and missing ones kept",
    ids[0] === "latest" && ids[1] === "offers" && !ids.includes("bogus") && ids.length === 11 && home.layout.sections[0].enabled === false && home.layout.sections[1].title === "عروض الجمعة",
    ids.join(","),
  );
  check(
    "Countdown, greeting, automatic banners and quick searches apply",
    home.layout.offers.until === "2030-01-01T10:00:00.000Z" && home.layout.greeting === false && home.layout.autoBanners === false && home.layout.quickSearches.join("|") === "شاي|قهوة",
    JSON.stringify(home.layout).slice(0, 200),
  );
  r = await admin("/admin/home/layout", { method: "PUT", body: { offers: { countdown: "until" } } });
  check("A campaign countdown needs an end time", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/layout", { method: "PUT", body: { stories: { pinned: ["x"] } } });
  check("The removed stories settings are refused", r.code === 400, `got ${r.code}`);
  r = await admin("/admin/home/layout", { method: "PUT", body: { hacked: true } });
  check("Unknown layout fields are refused", r.code === 400, `got ${r.code}`);

  // ---------- media ----------
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "x.png");
  const cookieJar = admin;
  r = await cookieJar("/admin/media", { method: "POST", raw: form });
  check("The team uploads banner pictures", r.code === 201 && typeof r.json?.url === "string", `got ${r.code} ${JSON.stringify(r.json)}`);
  if (r.json?.url) {
    r = await admin(`/admin/home/banners/${a.id}`, { method: "PATCH", body: { ...base, title: "e2e-home damascus", governorateId: damascus.id, imageUrl: r.json.url } });
    check("…and uses them in a banner", r.code === 200 && r.json.imageUrl?.endsWith(".webp"), `got ${r.code}`);
  }

  // ---------- paid showcase ----------
  const stores = (await anon("/stores?pageSize=4&gov=damascus")).json.items;
  r = await admin("/admin/home/promotions", { method: "POST", body: { storeId: "nope0000000000", plan: "باقة الواجهة" } });
  check("A showcase needs a real store", r.code === 400, `got ${r.code}`);
  const p1 = (await admin("/admin/home/promotions", { method: "POST", body: { storeId: stores[0].id, plan: "باقة الواجهة" } })).json;
  const p2 = (await admin("/admin/home/promotions", { method: "POST", body: { storeId: stores[1].id, plan: "باقة الواجهة", endsAt: new Date(Date.now() - 60_000).toISOString() } })).json;
  const p3 = (await admin("/admin/home/promotions", { method: "POST", body: { storeId: stores[2].id, plan: "باقة الواجهة", startsAt: new Date(Date.now() + 86400_000).toISOString() } })).json;
  let show = (await anon("/home?gov=damascus")).json.showcase;
  check("Paid stores appear in the showcase by name", show.length === 1 && show[0].id === p1.id && show[0].store.name === stores[0].name, JSON.stringify(show).slice(0, 120));
  check("Expired and not-yet-started packages stay hidden", !show.some((x) => x.id === p2.id || x.id === p3.id));
  show = (await anon(`/home?gov=${other.slug}`)).json.showcase;
  check("…only in the store's own governorate", show.length === 0, `${show.length}`);
  show = (await anon("/home")).json.showcase;
  check("…and for visitors browsing all governorates", show.some((x) => x.id === p1.id));
  await anon(`/home/showcase/${p1.id}/click`, { method: "POST", client: "web" });
  const promos = (await admin("/admin/home/promotions")).json;
  check("Showcase visits are counted for the store's report", promos.find((x) => x.id === p1.id)?.clicks === 1);
  r = await admin(`/admin/home/promotions/${p1.id}`, { method: "PATCH", body: { storeId: stores[0].id, plan: "باقة الواجهة", isActive: false } });
  show = (await anon("/home?gov=damascus")).json.showcase;
  check("Stopping a package removes the store", r.code === 200 && show.length === 0, `got ${r.code} ${show.length}`);
  for (const p of [p1, p2, p3]) await admin(`/admin/home/promotions/${p.id}`, { method: "DELETE" });

  const audit = sql(`SELECT count(*) FROM "AuditLog" WHERE action LIKE 'home.%' AND "createdAt" > now() - interval '5 minutes';`);
  check("Every change is written to the audit log", Number(audit) >= 6, `rows=${audit}`);

  r = await admin(`/admin/home/banners/${c.id}`, { method: "DELETE" });
  check("Banners can be deleted", r.code === 200 && !(await admin("/admin/home/banners")).json.some((x) => x.id === c.id), `got ${r.code}`);
  void d;
} finally {
  sql(RESET);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
