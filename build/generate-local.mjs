// Local build: reads committed data/ingredients.json instead of fetching from
// Supabase (which is blocked in the CI container). Applies enrichBotanicals in
// memory, then renders all PUBLISH_CATEGORIES. Identical output to generate.mjs
// except step 1 (fetch) is replaced with a file read.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { enrichBotanicals } from "./lib/normalize.mjs";
import { validate } from "./lib/validate.mjs";
import { renderHub, renderCategory, renderIngredient, renderDirectory, renderSearch, displayLabel, searchTerms, CAT_PLURAL } from "./lib/render.mjs";
import { buildSitemap } from "./lib/sitemap.mjs";
import { PUBLISH_CATEGORIES } from "./config.mjs";

// Slugs known to be test/erroneous records in the source database. Filtered
// at build time so they never appear in published pages or sitemap, even if
// the upstream Supabase row is not yet deleted.
const EXCLUDED_SLUGS = new Set(["tarun-singh"]);

async function main() {
  console.log("[1/5] Loading data/ingredients.json…");
  const raw = JSON.parse(await readFile("data/ingredients.json", "utf8"));
  const entities = raw.entities.filter((e) => !EXCLUDED_SLUGS.has(e.slug));
  if (raw.entities.length !== entities.length)
    console.log(`      Excluded ${raw.entities.length - entities.length} denylist entity/entities: ${[...EXCLUDED_SLUGS].join(", ")}`);
  console.log(`      ${entities.length} entities loaded`);

  console.log("[2/5] Applying botanical enrichment…");
  enrichBotanicals(entities);
  const botCount = entities.filter((e) => e.category === "botanical").length;
  console.log(`      ${botCount} botanical entities enriched`);

  // Disambiguate cross-schedule duplicates: when two entities share the same display
  // name, qualify the Schedule_III_B (no-limit) variant's displayName so every page
  // gets a unique title. We do two passes so the first-seen entity doesn't block the
  // III-B candidate from being identified regardless of sort order.
  const displayNameToEntities = new Map();
  for (const e of entities) {
    const dn = e.displayName || e.name;
    (displayNameToEntities.get(dn) || displayNameToEntities.set(dn, []).get(dn)).push(e);
  }
  for (const [dn, group] of displayNameToEntities) {
    if (group.length < 2) continue;
    // Find the Schedule_III (A or B) variant and qualify it to make titles unique.
    // Schedule_II has the traditional/Ayurvedic name with full dosage context;
    // Schedule_III_A/B has the scientific-name-based regulatory entry.
    for (const e of group) {
      const isIII = e.provenance && e.provenance.source_tabs.every((t) => t.startsWith("Schedule_III"));
      if (!isIII) continue; // keep Schedule_II display name as-is
      const rn = e.name || "";
      const prepMatch = rn.match(/\b(Extract|Powder|Oil|Seed|Leaf|Bark|Root|Resin|Gum|Aerial|Fruit|Flower|Standardized|Dried|Spray\s+Dried|Pulp|Bulb|Whole|Nira|Malate|HCl|Citrate|Phosphate|Sulphate|Succinate|Fumarate|Tartrate)\b.*/i);
      const qualifier = prepMatch ? prepMatch[0].trim().replace(/\s+/g, " ").slice(0, 60) : null;
      e.displayName = qualifier ? `${dn} (${qualifier})` : rn.slice(0, 80);
    }
  }

  console.log("[3/5] Validating…");
  const validation = validate(entities);
  console.log(`      eligible ${validation.metrics.publishEligible}, errors ${validation.metrics.errors}, warnings ${validation.metrics.warnings}`);

  console.log("[4/5] Writing enriched data/ingredients.json…");
  await mkdir("data", { recursive: true });
  const meta = { ...raw.meta, enrichedAt: new Date().toISOString(), publishCategories: PUBLISH_CATEGORIES };
  await writeFile("data/ingredients.json", JSON.stringify({ meta, entities }, null, 2));

  if (validation.metrics.errors > 0) {
    console.error(`\n✖ ${validation.metrics.errors} validation error(s) — pages NOT rendered. Build failed.`);
    process.exit(1);
  }

  console.log(`[5/5] Rendering /ingredients/ for: ${PUBLISH_CATEGORIES.join(", ")}…`);
  const counts = {};
  for (const e of entities) if (PUBLISH_CATEGORIES.includes(e.category)) counts[e.category] = (counts[e.category] || 0) + 1;

  const nameOf = {};
  for (const e of entities) nameOf[e.slug] = displayLabel(e);

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
      await writeFile(`ingredients/${e.slug}/index.html`, renderIngredient(e, { nameOf }));
      urls.push({ loc: `/ingredients/${e.slug}/`, priority: "0.6", changefreq: "monthly" });
      pageCount++;
    }
    console.log(`      ${cat}: ${list.length} ingredient pages`);
  }

  const published = entities.filter((e) => PUBLISH_CATEGORIES.includes(e.category));
  await mkdir("ingredients/all", { recursive: true });
  await writeFile("ingredients/all/index.html", renderDirectory(published, {}));
  urls.push({ loc: "/ingredients/all/", priority: "0.7", changefreq: "weekly" });
  await mkdir("ingredients/search", { recursive: true });
  await writeFile("ingredients/search/index.html", renderSearch({}));
  urls.push({ loc: "/ingredients/search/", priority: "0.5", changefreq: "monthly" });
  await writeFile("ingredients/ingredients-index.json", JSON.stringify(
    published.map((e) => ({ slug: e.slug, n: displayLabel(e), c: CAT_PLURAL[e.category] || e.category, s: searchTerms(e) }))));
  console.log(`      directory + search + index (${published.length} entities)`);

  // Marketing pages (approximated — just ensure sitemap is complete)
  const MARKETING = ["/", "/terms/", "/privacy/"];
  for (const loc of MARKETING) urls.push({ loc, priority: "0.9", changefreq: "monthly" });

  await writeFile("sitemap.xml", buildSitemap(urls));
  console.log(`\n✓ Done. Rendered ${pageCount + 2} pages + sitemap (${urls.length} URLs).`);
}

main().catch((e) => { console.error("Local build failed:", e.message, e.stack); process.exit(1); });
