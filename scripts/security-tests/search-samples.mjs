// Prints what the smart search returns for typical Syrian queries (dialect, synonyms, typos, needs).
// Usage: node scripts/security-tests/search-samples.mjs [apiBase]
const API = process.argv[2] ?? "http://localhost:4000";

const QUERIES = [
  "خليوي",
  "بدي جوال سامسونغ",
  "شي يشحن الموبايل بلا كهربا",
  "بطاريات",
  "بقلاوه",
  "موبيل",
  "صباط رجالي",
  "عروض",
  "هدية للمغتربين",
  "لابتوب مستعمل",
  "صابون حلبي",
  "الواح شمسيه",
];

for (const q of QUERIES) {
  const res = await fetch(`${API}/products?pageSize=5&q=${encodeURIComponent(q)}`);
  const d = await res.json();
  const s = d.search ?? {};
  console.log(`\n«${q}» → ${d.total} نتيجة${s.correctedQuery ? ` | هل تقصد: ${s.correctedQuery}` : ""}${s.alsoSearched?.length ? ` | أيضاً: ${s.alsoSearched.join("، ")}` : ""}${s.semantic ? " | بالمعنى" : ""}`);
  for (const p of d.items) console.log(`   - ${p.title}`);
}

const sug = await (await fetch(`${API}/search/suggest?q=${encodeURIComponent("بروك")}`)).json();
console.log("\nاقتراحات «بروك»:", sug.products.map((p) => p.title).join(" | "), "| متاجر:", sug.stores.map((s) => s.name).join(", "));
