// Generate botanical SAMPLE pages for review (noindex /preview/ tree).
// Fetches live data → runs the NEW enrichment → renders the approved sample set,
// and prints SEO title / meta / schema / internal-linking for each.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { enrichBotanicals } from "./lib/normalize.mjs";
import { renderIngredient } from "./lib/render.mjs";

const SAMPLES = [
  "ashwagandha-asgandh-nagauri",
  "curcuma-longa-rhizome-powderextract-standardized", // Turmeric
  "amalaki-anwala-amla",                               // Amla (multi-form dosage)
  "ocimum-tenuiflorumsanctum-aerial-partsseed-extract", // Tulsi
  "brahmi",                                            // transliterated Ayurvedic
  "barbari-bhavari-tulsi",                             // multiple dosage forms
  "shatawar",                                          // Shatavari (transliterated)
  "boswellia-serrata-gum-resin-extract",              // standardized extract
];

async function main() {
  // Run the botanical enrichment on the committed dataset (the enrichment depends
  // only on fields already present there — name, synonyms, common_name, limit,
  // source_tabs — so sample review needs no live Supabase fetch).
  const data = JSON.parse(await readFile("data/ingredients.json", "utf8"));
  const entities = data.entities;
  enrichBotanicals(entities);
  const bySlug = Object.fromEntries(entities.map((e) => [e.slug, e]));
  const nameOf = Object.fromEntries(entities.map((e) => [e.slug, e.displayName || e.name]));

  await mkdir("preview/botanicals", { recursive: true });
  const report = [];
  for (const slug of SAMPLES) {
    const e = bySlug[slug];
    if (!e) { console.warn("MISSING SAMPLE:", slug); continue; }
    const html = renderIngredient(e, { root: "/preview/botanicals", preview: true, nameOf });
    await mkdir(`preview/botanicals/${slug}`, { recursive: true });
    await writeFile(`preview/botanicals/${slug}/index.html`, html);

    // extract title/desc/schema from the rendered HTML for the review report
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
    report.push({ slug, e, title, desc });
  }

  // Print review report
  for (const { slug, e, title, desc } of report) {
    const b = e.botanical || {};
    console.log("\n========================================================");
    console.log("URL (preview):  https://regulyze.in/preview/botanicals/" + slug + "/");
    console.log("H1:             " + (e.displayName || e.name));
    console.log("Sci subtitle:   " + (b.scientificName || "(none)") + (b.part ? "  ·  " + b.part : ""));
    console.log("Regulatory name:" + e.name);
    console.log("Also known as:  " + (e.altNames || []).join(", "));
    console.log("Dosage forms:   " + JSON.stringify(e.dosageForms));
    console.log("Related:        " + e.related.map((s) => (e._n && e._n[s]) || s).join(", "));
    console.log("SEO title:      " + title);
    console.log("Meta desc:      " + desc);
  }
}
main().catch((err) => { console.error("sample gen failed:", err); process.exit(1); });
