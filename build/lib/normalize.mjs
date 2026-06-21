// Normalize raw tab data → ingredient entity model.
// Evergreen, framework-extensible, data-driven, EXPLICIT field mapping.
import {
  TAB_ROLES, FIELD_MAP, ENRICH_MAP, NAME_KEY_PATTERNS, SERIAL_PATTERNS,
  FRAMEWORKS, PRIMARY_FRAMEWORK, QUALITY,
} from "../config.mjs";

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
const norm = (s) => String(s == null ? "" : s).trim();
const isNumeric = (s) => /^[\d.]+$/.test(norm(s));

// Primary-category priority: actives outrank additives when an ingredient
// legitimately appears in multiple categories (multi-category tagging).
const CATEGORY_PRIORITY = [
  "vitamin", "mineral", "amino-acid", "nucleotide",
  "botanical", "probiotic", "prebiotic", "additive", "other",
];
const pickPrimary = (cats) =>
  [...cats].sort((a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b))[0];

// INS food-additive numbers are bare numerics in source — present as "INS 950".
const fmtSynonym = (v) => (/^\d{3,4}[a-z]?$/i.test(norm(v)) ? `INS ${norm(v)}` : norm(v));

// Fallback name detection (only if a tab has no explicit FIELD_MAP entry).
export function detectNameKey(keys) {
  const usable = keys.filter((k) => k && !SERIAL_PATTERNS.some((p) => p.test(k)));
  for (const pat of NAME_KEY_PATTERNS) {
    const hit = usable.find((k) => pat.test(k));
    if (hit) return hit;
  }
  return usable[0] || keys[0];
}
function nameKeyFor(tab, keys) {
  return FIELD_MAP[tab]?.name && keys.includes(FIELD_MAP[tab].name)
    ? FIELD_MAP[tab].name : detectNameKey(keys);
}

function splitList(v) {
  return norm(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

// Synonym index: canonicalNameLower -> Set(synonyms), from conversions + Trade_Name_Mapper.
function buildSynonymIndex(tabs) {
  const syn = {};
  const add = (canonical, s) => {
    const c = norm(canonical), v = norm(s);
    if (!c || !v || c.toLowerCase() === v.toLowerCase()) return;
    (syn[c.toLowerCase()] ||= new Set()).add(v);
  };
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (meta.role === "synonym") {
      for (const r of rows) {
        const g = r.Generic_Name || "";
        if (!g) continue;
        if (r.Trade_Brand_Name) add(g, r.Trade_Brand_Name);
        splitList(r.Synonyms).forEach((e) => add(g, e));
      }
    }
    if (meta.role === "enrichment" && meta.kind === "conversion") {
      const m = ENRICH_MAP.conversion;
      for (const r of rows) if (r[m.parent] && r[m.salt]) add(r[m.parent], r[m.salt]);
    }
  }
  return syn;
}

// Prohibited names from Not_Permitted_Ingredients.
function buildProhibited(tabs) {
  const set = new Map();
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    if (meta.role !== "status") continue;
    for (const r of (tabs[tab]?.rows || [])) {
      const name = norm(r.Ingredient_Name || r[detectNameKey(Object.keys(r))]);
      if (name && !isNumeric(name)) set.set(name.toLowerCase(), { tab, reason: norm(r.Reason || "") });
    }
  }
  return set;
}

// FSSR_Permitted enrichment: limit / conditions / synonyms by ingredient name.
function buildPermittedEnrichment(tabs) {
  const map = new Map(); // nameLower -> {limit, conditions, synonyms[]}
  const m = ENRICH_MAP.permitted;
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    if (!(meta.role === "enrichment" && meta.kind === "permitted")) continue;
    for (const r of (tabs[tab]?.rows || [])) {
      const name = norm(r[m.name]);
      if (!name) continue;
      map.set(name.toLowerCase(), {
        limit: norm(r[m.limit]), conditions: norm(r[m.conditions]),
        synonyms: splitList(r[m.synonyms]),
      });
    }
  }
  return map;
}

export function normalize(snapshot) {
  const { tabs } = snapshot;
  const synonymIndex = buildSynonymIndex(tabs);
  const prohibited = buildProhibited(tabs);
  const permitted = buildPermittedEnrichment(tabs);

  const entities = new Map();
  const anomalies = [];
  const tabColumns = {};

  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (rows.length) {
      const keys = Object.keys(rows[0]);
      tabColumns[tab] = { role: meta.role, nameKey: meta.role === "entity" ? nameKeyFor(tab, keys) : "—", columns: keys };
    }
    if (meta.role !== "entity") continue;

    const fmap = FIELD_MAP[tab] || {};
    const updatedAt = tabs[tab]?.updated_at || null;

    for (const r of rows) {
      const keys = Object.keys(r);
      const nameKey = nameKeyFor(tab, keys);
      const name = norm(r[nameKey]);
      if (!name || name.length < QUALITY.minNameLen) { anomalies.push({ tab, issue: "missing/short name" }); continue; }
      if (QUALITY.rejectNumericNames && isNumeric(name)) { anomalies.push({ tab, issue: "numeric name (mis-mapped column?)", name }); continue; }

      const slug = slugify(name);
      if (!slug) { anomalies.push({ tab, issue: "empty slug", name }); continue; }

      let e = entities.get(slug);
      if (!e) {
        e = {
          slug, name, domain: "nutraceutical",
          category: meta.category, _cats: new Set([meta.category]),
          identity: {}, synonyms: [], summary: "",
          status: [], related: [], faq: [],
          provenance: { source_tabs: [], db_updated_at: updatedAt },
        };
        entities.set(slug, e);
      } else if (!e._cats.has(meta.category)) {
        e._cats.add(meta.category); // multi-category tagging
        anomalies.push({ tab, issue: "multi-category", name, categories: [...e._cats] });
      }
      if (!e.provenance.source_tabs.includes(tab)) e.provenance.source_tabs.push(tab);

      // common name
      if (fmap.common && r[fmap.common] && !e.identity.common_name) e.identity.common_name = norm(r[fmap.common]);

      // primary-framework status
      let st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (!st) {
        st = {
          framework: PRIMARY_FRAMEWORK, framework_label: FRAMEWORKS[PRIMARY_FRAMEWORK].label,
          status: "permitted", limit: "", conditions: "",
          source_ref: FRAMEWORKS[PRIMARY_FRAMEWORK].source_default,
          last_reviewed: updatedAt ? updatedAt.slice(0, 10) : null,
          version: updatedAt ? `db-${updatedAt.slice(0, 10)}` : "db-unknown",
        };
        e.status.push(st);
      }
      if (fmap.limit && r[fmap.limit] && !st.limit) st.limit = norm(r[fmap.limit]);

      // synonyms from mapped columns (INS numbers formatted as "INS 950")
      for (const col of (fmap.synonyms || [])) {
        for (const v of splitList(r[col])) { const s = fmtSynonym(v); if (s && !e.synonyms.includes(s)) e.synonyms.push(s); }
      }
    }
  }

  // Cross-source enrichment: conversions/trade synonyms + FSSR_Permitted; prohibited overrides.
  for (const e of entities.values()) {
    const key = e.name.toLowerCase();
    const idx = synonymIndex[key];
    if (idx) for (const s of idx) if (!e.synonyms.includes(s)) e.synonyms.push(s);

    const pe = permitted.get(key);
    if (pe) {
      const st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (st) { if (!st.limit && pe.limit) st.limit = pe.limit; if (!st.conditions && pe.conditions) st.conditions = pe.conditions; }
      for (const s of pe.synonyms) if (s && !e.synonyms.includes(s)) e.synonyms.push(s);
    }

    const pr = prohibited.get(key);
    if (pr) {
      const st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (st) { st.status = "prohibited"; if (pr.reason) st.conditions = pr.reason; }
    }
  }

  // Resolve multi-category tagging → primary SEO category + categories[]
  for (const e of entities.values()) {
    e.categories = [...e._cats];
    e.category = pickPrimary(e._cats);
    delete e._cats;
  }

  // Related: up to 6 siblings in the same primary category
  const byCat = {};
  for (const e of entities.values()) (byCat[e.category] ||= []).push(e.slug);
  for (const e of entities.values())
    e.related = (byCat[e.category] || []).filter((s) => s !== e.slug).slice(0, 6);

  return {
    entities: [...entities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    synonymIndex, prohibited: [...prohibited.keys()], anomalies, tabColumns,
  };
}
