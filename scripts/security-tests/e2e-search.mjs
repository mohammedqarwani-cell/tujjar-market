// End-to-end checks for the smart search (dev environment with the demo seed).
// Usage: node scripts/security-tests/e2e-search.mjs [apiBase]
const API = process.argv[2] ?? "http://localhost:4000";
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` | ${detail}` : ""}`);

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { "X-Client": "web" } });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}
const products = (q, extra = "") => get(`/products?pageSize=24&q=${encodeURIComponent(q)}${extra}`);
const titles = (r) => (r.body?.items ?? []).map((p) => p.title);

try {
  let r = await products("خليوي");
  const phones = titles(r).filter((t) => /Samsung|Xiaomi|iPhone/.test(t));
  check("Dialect synonym: «خليوي» finds phones", r.status === 200 && phones.length >= 3, `${phones.length} phones`);
  check("The search explains the words it added", (r.body?.search?.alsoSearched ?? []).includes("موبايل"), (r.body?.search?.alsoSearched ?? []).join("،"));

  r = await products("صباط رجالي");
  check("Dialect: «صباط رجالي» finds men's shoes first", /حذاء رجالي/.test(titles(r)[0] ?? ""), titles(r)[0]);

  r = await products("موبيل");
  check("Typo: «موبيل» is corrected to «موبايل»", r.body?.search?.correctedQuery === "موبايل" && r.body.total > 0, `fix=${r.body?.search?.correctedQuery}`);

  r = await products("شي يشحن الموبايل بلا كهربا");
  check("Described need: charging a phone without power ranks a power bank or charger first", /باور بانك|شاحن/.test(titles(r)[0] ?? ""), titles(r).slice(0, 2).join(" / "));

  r = await products("لابتوب مستعمل");
  check("Brands count as the product: «لابتوب» finds EliteBook and IdeaPad", titles(r).some((t) => /EliteBook/.test(t)) && titles(r).some((t) => /IdeaPad/.test(t)), titles(r).join(" / "));
  check("«مستعمل» ranks used items first", /مستعمل/.test(titles(r)[0] ?? ""), titles(r)[0]);

  r = await products("عروض");
  check("«عروض» returns discounted products only", r.body.total > 0 && r.body.items.every((p) => p.oldPrice), `${r.body.total} results`);

  r = await products("بطارية", "&category=auto-parts");
  check("Filters still apply to smart results", r.body.total >= 1 && r.body.items.every((p) => p.category.slug === "auto-parts"), titles(r).join(" / "));

  r = await products("بطارية", "&sort=price_asc");
  const prices = r.body.items.map((p) => p.price ?? Infinity);
  check("Sorting by price applies to smart results", prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.join(","));

  const all = await products("بطارية");
  const p1 = await get(`/products?pageSize=3&page=1&q=${encodeURIComponent("بطارية")}`);
  const p2 = await get(`/products?pageSize=3&page=2&q=${encodeURIComponent("بطارية")}`);
  const ids = [...p1.body.items, ...p2.body.items].map((p) => p.id);
  check("Pagination is stable and consistent with the total", p1.body.total === all.body.total && new Set(ids).size === ids.length && p1.body.pages === Math.ceil(all.body.total / 3), `total=${all.body.total}`);

  r = await products("سماعات لاسلكية أصلية بسعر الجملة");
  check("Listings under review never appear in search", !titles(r).includes("سماعات لاسلكية أصلية بسعر الجملة"), `${r.body.total} results`);

  r = await get(`/stores?q=${encodeURIComponent("جوالات")}`);
  check("Store search understands synonyms too", (r.body?.items ?? []).some((s) => s.slug === "bahsa-mobile"), (r.body?.items ?? []).map((s) => s.slug).join(","));

  r = await get(`/search/suggest?q=${encodeURIComponent("بروك")}`);
  check("Suggestions return products and the matching store", r.status === 200 && r.body.products.length > 0 && r.body.stores.some((s) => s.slug === "brocade-alsham"), `${r.body?.products?.length} products`);
  check("Suggestions expose no internal fields", r.status === 200 && r.body.products.every((p) => Object.keys(p).sort().join() === "icon,id,image,title"), Object.keys(r.body?.products?.[0] ?? {}).join(","));

  r = await products("زززززززز");
  check("Nonsense returns nothing, without errors", r.status === 200 && r.body.total === 0, `status ${r.status}`);

  r = await products("ب".repeat(5000));
  check("Very long queries are handled safely", [200, 400, 414, 431].includes(r.status), `status ${r.status}`);

  r = await get(`/search/suggest?q=${encodeURIComponent("'; DROP TABLE \"Product\"; --")}`);
  const still = await products("بطارية");
  check("Injection-shaped input is harmless", r.status === 200 && still.body.total > 0, `status ${r.status}`);
} catch (e) {
  check("Search checks ran", false, e.message);
}

console.log(`\n${results.join("\n")}\n`);
console.log(`${results.filter((l) => l.startsWith("PASS")).length} passed, ${results.filter((l) => l.startsWith("FAIL")).length} failed`);
