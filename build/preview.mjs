// Preview-only runner: renders template SAMPLES (hub + Vitamins category + vitamin
// pages) into /preview/ingredients/ using a small fixture, so the page template
// can be reviewed before the real Vitamin slice is generated. noindex; not in sitemap.
import { mkdir, writeFile } from "node:fs/promises";
import { renderHub, renderCategory, renderIngredient } from "./lib/render.mjs";

const OPTS = { root: "/preview/ingredients", preview: true };
const SRC = { framework: "india-fssai", framework_label: "India — FSSAI", status: "permitted",
  limit: "", conditions: "", source_ref: "FSS (Health Supplements, Nutraceuticals…) Regulations 2022",
  last_reviewed: "2026-06-20", version: "db-2026-06-20" };

const V = (slug, name, synonyms, common) => ({
  slug, name, domain: "nutraceutical", category: "vitamin", categories: ["vitamin"],
  identity: common ? { common_name: common } : {}, synonyms, summary: "",
  status: [{ ...SRC }], related: [], faq: [],
  provenance: { source_tabs: ["Sched_I_Vitamins"], db_updated_at: "2026-06-20T11:39:46Z" },
});

const vitamins = [
  V("vitamin-c", "Vitamin C", ["Ascorbic acid", "Sodium ascorbate", "Calcium ascorbate"], "Ascorbic acid"),
  V("vitamin-a", "Vitamin A", ["Retinyl acetate", "Retinyl palmitate"]),
  V("vitamin-d", "Vitamin D", ["Cholecalciferol", "Ergocalciferol"]),
  V("vitamin-e", "Vitamin E", ["D-alpha-tocopherol", "DL-alpha-tocopheryl acetate"]),
  V("vitamin-b12", "Vitamin B12", ["Cyanocobalamin", "Methylcobalamin"]),
  V("folic-acid", "Folic acid", ["Vitamin B9", "Pteroylmonoglutamic acid"]),
  V("biotin", "Biotin", ["Vitamin B7", "D-biotin"]),
  V("niacin", "Niacin", ["Vitamin B3", "Nicotinamide", "Nicotinic acid"]),
];
// cross-link related (6 siblings each)
for (const e of vitamins) e.related = vitamins.filter((x) => x.slug !== e.slug).map((x) => x.slug).slice(0, 6);

const counts = { botanical: 671, additive: 304, "amino-acid": 53, probiotic: 31, vitamin: 16, mineral: 15, prebiotic: 14, nucleotide: 7 };

await mkdir("preview/ingredients/category/vitamin", { recursive: true });
await writeFile("preview/ingredients/index.html", renderHub(counts, OPTS));
await writeFile("preview/ingredients/category/vitamin/index.html", renderCategory("vitamin", vitamins, OPTS));
for (const e of vitamins) {
  await mkdir(`preview/ingredients/${e.slug}`, { recursive: true });
  await writeFile(`preview/ingredients/${e.slug}/index.html`, renderIngredient(e, OPTS));
}
console.log(`Preview written: hub + Vitamins category + ${vitamins.length} ingredient pages → /preview/ingredients/`);
