// Validation + data-quality framework. Surfaces issues; does not throw unless fatal.
import { QUALITY, PRIMARY_FRAMEWORK } from "../config.mjs";

export function validate(entities) {
  const issues = [];
  const seenSlugs = new Set();
  let withStatus = 0, withLimit = 0, withSynonyms = 0, prohibitedCount = 0;

  for (const e of entities) {
    if (seenSlugs.has(e.slug)) issues.push({ level: "error", slug: e.slug, msg: "duplicate slug" });
    seenSlugs.add(e.slug);

    if (!e.name || e.name.length < QUALITY.minNameLen) issues.push({ level: "error", slug: e.slug, msg: "name too short" });
    if (e.name && e.name.length > QUALITY.maxNameLen) issues.push({ level: "warn", slug: e.slug, msg: "name very long" });
    if (!e.category) issues.push({ level: "error", slug: e.slug, msg: "missing category" });

    const fssai = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
    if (!fssai) issues.push({ level: "warn", slug: e.slug, msg: "no primary-framework status" });
    else {
      withStatus++;
      if (fssai.limit) withLimit++;
      if (fssai.status === "prohibited") prohibitedCount++;
      if (!fssai.last_reviewed) issues.push({ level: "warn", slug: e.slug, msg: "no last_reviewed (governance)" });
      if (!fssai.source_ref) issues.push({ level: "warn", slug: e.slug, msg: "no source_ref (governance)" });
    }
    if (e.synonyms.length) withSynonyms++;
  }

  // Publish-eligibility (the data-quality gate for later page rendering)
  const eligible = entities.filter((e) =>
    e.name && e.category && (!QUALITY.requireStatus || e.status.length));

  const metrics = {
    totalEntities: entities.length,
    publishEligible: eligible.length,
    withStatus, withLimit, withSynonyms, prohibitedCount,
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warn").length,
  };
  return { issues, metrics, eligible };
}
