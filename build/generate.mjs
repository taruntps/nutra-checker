// Phase 2.0/2.1 orchestrator: fetch → normalize → validate → write artifacts →
// render published categories into /ingredients/ + regenerate sitemap.xml.
// Writes:  data/ingredients.json, data/NORMALIZATION-REPORT.md
//          ingredients/** (only PUBLISH_CATEGORIES), sitemap.xml
import { mkdir, writeFile } from "node:fs/promises";
import { fetchRegulationData } from "./lib/fetch.mjs";
import { normalize } from "./lib/normalize.mjs";
import { validate } from "./lib/validate.mjs";
import { buildReport } from "./lib/report.mjs";
import { renderHub, renderCategory, renderIngredient } from "./lib/render.mjs";
import { buildSitemap } from "./lib/sitemap.mjs";
import { PUBLISH_CATEGORIES } from "./config.mjs";

async function main() {
  console.log("[1/5] Fetching regulation_data from Supabase…");
  const snapshot = await fetchRegulationData();
  console.log(`      ${snapshot.rowCount} rows / ${Object.keys(snapshot.tabs).length} tabs`);

  console.log("[2/5] Normalizing → entity model…");
  const normalized = normalize(snapshot);
  console.log(`      ${normalized.entities.length} entities`);

  console.log("[3/5] Validating…");
  const validation = validate(normalized.entities);
  console.log(`      eligible ${validation.metrics.publishEligible}, errors ${validation.metrics.errors}, warnings ${validation.metrics.warnings}`);

  console.log("[4/5] Writing data artifacts…");
  await mkdir("data", { recursive: true });
  await writeFile("data/ingredients.json", JSON.stringify({
    meta: { generatedAt: snapshot.fetchedAt, dbRowCount: snapshot.rowCount,
      entityCount: normalized.entities.length, publishEligible: validation.metrics.publishEligible,
      pipelineVersion: "2.1.0", publishCategories: PUBLISH_CATEGORIES },
    entities: normalized.entities,
  }, null, 2));
  await writeFile("data/NORMALIZATION-REPORT.md", buildReport({ snapshot, normalized, validation }));

  // Governance gate: never publish on hard errors.
  if (validation.metrics.errors > 0) {
    console.error(`\n✖ ${validation.metrics.errors} validation error(s) — pages NOT rendered. Build failed.`);
    process.exit(1);
  }

  console.log(`[5/5] Rendering /ingredients/ for: ${PUBLISH_CATEGORIES.join(", ")}…`);
  const entities = normalized.entities;
  const counts = {};
  for (const e of entities) if (PUBLISH_CATEGORIES.includes(e.category)) counts[e.category] = (counts[e.category] || 0) + 1;

  const urls = [];
  await mkdir("ingredients", { recursive: true });
  await writeFile("ingredients/index.html", renderHub(counts, {}));
  urls.push({ loc: "/ingredients/", priority: "0.8", changefreq: "weekly" });

  let pageCount = 1;
  for (const cat of PUBLISH_CATEGORIES) {
    const list = entities.filter((e) => e.category === cat);
    if (!list.length) { console.warn(`      (no entities for category '${cat}')`); continue; }
    await mkdir(`ingredients/category/${cat}`, { recursive: true });
    await writeFile(`ingredients/category/${cat}/index.html`, renderCategory(cat, entities, {}));
    urls.push({ loc: `/ingredients/category/${cat}/`, priority: "0.7", changefreq: "weekly" });
    pageCount++;
    for (const e of list) {
      await mkdir(`ingredients/${e.slug}`, { recursive: true });
      await writeFile(`ingredients/${e.slug}/index.html`, renderIngredient(e, {}));
      urls.push({ loc: `/ingredients/${e.slug}/`, priority: "0.6", changefreq: "monthly" });
      pageCount++;
    }
    console.log(`      ${cat}: ${list.length} ingredient pages`);
  }

  await writeFile("sitemap.xml", buildSitemap(urls));
  console.log(`\n✓ Done. Rendered ${pageCount} pages + sitemap (${urls.length + 4} URLs).`);
}

main().catch((e) => { console.error("Pipeline failed:", e.message); process.exit(1); });
