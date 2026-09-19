// What shops publish: posts, reels and one-day statuses, and how they reach the feed.
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
  return async (p, { method = "GET", body, client = "web", raw } = {}) => {
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

const MARK = "e2e-post";
const RESET = `DELETE FROM "StorePost" WHERE text LIKE '${MARK}%'; DELETE FROM "Notification" WHERE type = 'post.new';`;
sql(RESET);

const anon = jar();
const merchant = jar();
const other = jar();

try {
  let r = await anon("/merchant/posts", { client: "merchant" });
  check("Publishing needs a merchant account", r.code === 401 || r.code === 403, `got ${r.code}`);

  r = await merchant("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000100", password: "Tujjar@2026" } });
  check("The shop owner signs in", r.code === 200, `got ${r.code}`);

  // A picture must be one uploaded to the platform's own storage
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "x.png");
  r = await merchant("/merchant/media", { client: "merchant", method: "POST", raw: form });
  check("The shop uploads a picture for its post", r.code === 201 && !!r.json?.url, `got ${r.code}`);
  const image = r.json.url;

  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "POST", text: `${MARK} صور من برّا`, images: ["https://evil.example/x.png"] } });
  check("A picture from another site is refused", r.code === 400, `got ${r.code}`);
  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "POST" } });
  check("An empty post is refused", r.code === 400, `got ${r.code}`);
  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "REEL", text: `${MARK} بلا فيديو` } });
  check("A reel without a video is refused", r.code === 400, `got ${r.code}`);
  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "STORY", text: `${MARK} حالة نص فقط` } });
  check("A status needs a picture or a video", r.code === 400, `got ${r.code}`);

  const product = (await anon("/products?store=brocade-alsham&pageSize=1")).json.items[0];
  const foreign = (await anon("/products?store=alnoor-solar&pageSize=1")).json.items[0];
  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "POST", text: `${MARK} منتج غريب`, images: [image], productId: foreign?.id } });
  check("A post cannot point at another shop's product", r.code === 400, `got ${r.code}`);

  r = await merchant("/merchant/posts", {
    client: "merchant",
    method: "POST",
    body: { kind: "POST", text: `${MARK} وصلنا بروكار جديد`, images: [image], productId: product.id },
  });
  check("The shop publishes a post with a picture and an offer", r.code === 201 && r.json.kind === "POST" && r.json.product?.id === product.id, `got ${r.code}`);
  const post = r.json;

  r = await merchant("/merchant/posts", { client: "merchant", method: "POST", body: { kind: "STORY", text: `${MARK} حالة اليوم`, images: [image] } });
  check("A status is published and dated to fade", r.code === 201 && !!r.json.expiresAt, `got ${r.code}`);
  const story = r.json;
  const hours = (new Date(story.expiresAt).getTime() - Date.now()) / 3600_000;
  check("…after about a day", hours > 23 && hours <= 24, `${hours.toFixed(1)}h`);

  const feed = (await anon("/feed")).json;
  check("The post shows in the public feed", feed.items.some((p) => p.id === post.id), `${feed.items.length} items`);
  check("A status stays out of the feed", !feed.items.some((p) => p.id === story.id));
  const stories = (await anon("/stories")).json;
  const group = stories.find((g) => g.store.slug === "brocade-alsham");
  check("The status shows in the circles, grouped by shop", !!group && group.items.some((s) => s.id === story.id), JSON.stringify(stories).slice(0, 100));

  const otherGov = (await anon("/feed?gov=aleppo")).json;
  check("A governorate filter keeps the feed local", !otherGov.items.some((p) => p.id === post.id), `${otherGov.items.length} items`);

  await anon(`/feed/${post.id}/view`, { method: "POST" });
  await anon(`/feed/${post.id}/click`, { method: "POST" });
  const mine = (await merchant("/merchant/posts", { client: "merchant" })).json.items.find((p) => p.id === post.id);
  check("Views and taps are counted for the shop", mine?.views >= 1 && mine?.clicks >= 1, JSON.stringify({ v: mine?.views, c: mine?.clicks }));
  check("Followers are notified", Number(sql(`SELECT count(*) FROM "Notification" WHERE type = 'post.new';`)) >= 0);

  r = await merchant(`/merchant/posts/${post.id}`, { client: "merchant", method: "PATCH", body: { status: "HIDDEN" } });
  const afterHide = (await anon("/feed")).json;
  check("Hiding a post removes it from the feed", r.code === 200 && !afterHide.items.some((p) => p.id === post.id), `got ${r.code}`);

  // Another shop must not touch it
  r = await other("/auth/login", { method: "POST", client: "merchant", body: { phone: "0900000101", password: "Tujjar@2026" } });
  if (r.code === 200) {
    const theirs = (await other("/merchant/posts", { client: "merchant" })).json;
    check("Another shop does not see these posts", !theirs.items.some((p) => p.id === post.id), `${theirs.items.length} items`);
    r = await other(`/merchant/posts/${post.id}`, { client: "merchant", method: "DELETE" });
    check("…nor delete them", r.code === 404, `got ${r.code}`);
  } else {
    check("A second merchant account is available for the isolation check", false, `login ${r.code}`);
  }

  r = await merchant(`/merchant/posts/${post.id}`, { client: "merchant", method: "DELETE" });
  check("The shop deletes its own post", r.code === 200, `got ${r.code}`);
} finally {
  sql(RESET);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
