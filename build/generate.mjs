// Phase 2.0 orchestrator: fetch → normalize → validate → write artifacts.
// Writes:  data/ingredients.json  (entity model, source of truth for pages)
//          data/NORMALIZATION-REPORT.md  (human review deliverable)
// Does NOT render or publish any ingredient page.
import { mkdir, writeFile } from "node:fs/promises";
import { fetchRegulationData } from "./lib/fetch.mjs";
import { normalize } from "./lib/normalize.mjs";
import { validate } from "./lib/validate.mjs";
import { buildReport } from "./lib/report.mjs";

async function main() {
  console.log("[1/4] Fetching regulation_data from Supabase…");
  const snapshot = await fetchRegulationData();
  console.log(`      fetched ${snapshot.rowCount} rows across ${Object.keys(snapshot.tabs).length} tabs`);

  console.log("[2/4] Normalizing → entity model…");
  const normalized = normalize(snapshot);
  console.log(`      ${normalized.entities.length} entities (deduped)`);

  console.log("[3/4] Validating…");
  const validation = validate(normalized.entities);
  console.log(`      eligible: ${validation.metrics.publishEligible}, errors: ${validation.metrics.errors}, warnings: ${validation.metrics.warnings}`);

  console.log("[4/4] Writing artifacts…");
  await mkdir("data", { recursive: true });
  const out = {
    meta: {
      generatedAt: snapshot.fetchedAt,
      dbRowCount: snapshot.rowCount,
      entityCount: normalized.entities.length,
      publishEligible: validation.metrics.publishEligible,
      pipelineVersion: "2.0.0",
    },
    entities: normalized.entities,
  };
  await writeFile("data/ingredients.json", JSON.stringify(out, null, 2));
  await writeFile("data/NORMALIZATION-REPORT.md", buildReport({ snapshot, normalized, validation }));

  // Fail the build on hard errors so bad data never reaches a PR (governance gate).
  if (validation.metrics.errors > 0) {
    console.error(`\n✖ ${validation.metrics.errors} validation error(s). Artifacts written for inspection; build marked failed.`);
    process.exit(1);
  }
  console.log("\n✓ Done. Review data/NORMALIZATION-REPORT.md and data/ingredients.json.");
}

main().catch((e) => { console.error("Pipeline failed:", e.message); process.exit(1); });
