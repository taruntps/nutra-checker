// Generate the human-review markdown report (the Phase 2.0 deliverable).
export function buildReport({ snapshot, normalized, validation }) {
  const { entities, anomalies, tabColumns } = normalized;
  const { metrics, issues } = validation;

  const byCat = {};
  for (const e of entities) byCat[e.category] = (byCat[e.category] || 0) + 1;

  const samples = entities
    .filter((e) => e.status.length)
    .slice(0, 10)
    .map((e) => "```json\n" + JSON.stringify(e, null, 2) + "\n```")
    .join("\n\n");

  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `| ${c} | ${n} |`).join("\n");

  const tabRows = Object.entries(tabColumns)
    .map(([t, m]) => `| ${t} | ${m.role} | ${m.detectedNameKey || "—"} | ${m.columns.join(", ")} |`)
    .join("\n");

  const anomalyRows = anomalies.slice(0, 40)
    .map((a) => `| ${a.tab || "—"} | ${a.issue} | ${a.name || (a.categories ? a.categories.join(" vs ") : "")} |`)
    .join("\n") || "| — | none | — |";

  return `# Regulyze — Ingredient Normalization Report (Phase 2.0)

_Generated: ${new Date().toISOString()} · DB rows fetched: ${snapshot.rowCount}_

> Review-only. **No ingredient pages have been generated.** Approve this dataset before Phase 2.1 rendering.

## 1. Entity counts
| Metric | Value |
|---|---|
| Total entities (deduped) | ${metrics.totalEntities} |
| Publish-eligible (passes quality gate) | ${metrics.publishEligible} |
| With primary-framework status | ${metrics.withStatus} |
| With a stated limit | ${metrics.withLimit} |
| With synonyms mapped | ${metrics.withSynonyms} |
| Marked prohibited | ${metrics.prohibitedCount} |
| Validation errors | ${metrics.errors} |
| Validation warnings | ${metrics.warnings} |

## 2. Category distribution
| Category | Entities |
|---|---|
${catRows}

## 3. Sample entities (first 10 with status)
${samples}

## 4. Source tab mapping & detected columns (governance)
| Tab | Role | Detected name column | Columns |
|---|---|---|---|
${tabRows}

## 5. Anomalies & gaps (first 40)
| Tab | Issue | Detail |
|---|---|---|
${anomalyRows}

## 6. Validation issues (first 30)
${issues.slice(0, 30).map((i) => `- **${i.level}** \`${i.slug || ""}\` — ${i.msg}`).join("\n") || "- none"}
`;
}
