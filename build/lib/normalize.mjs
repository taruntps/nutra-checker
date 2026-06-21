// Normalize raw tab data → ingredient entity model.
// Evergreen, framework-extensible, data-driven. No page rendering here.
import {
  TAB_ROLES, NAME_KEY_PATTERNS, FRAMEWORKS, PRIMARY_FRAMEWORK, QUALITY,
} from "../config.mjs";

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
const norm = (s) => String(s == null ? "" : s).trim();

// Pick the most likely "name" column from a row's keys.
export function detectNameKey(keys) {
  for (const pat of NAME_KEY_PATTERNS) {
    const hit = keys.find((k) => pat.test(k));
    if (hit) return hit;
  }
  // fallback: first key that isn't an obvious serial/number column
  return keys.find((k) => !/^s[_\s]?no$|^sr|^#|^id$/i.test(k)) || keys[0];
}

// Build a synonym → canonical-name map from Trade_Name_Mapper + conversion tabs.
function buildSynonymIndex(tabs) {
  const synonyms = {}; // canonicalNameLower -> Set(synonyms)
  const add = (canonical, syn) => {
    const c = norm(canonical); const s = norm(syn);
    if (!c || !s || c.toLowerCase() === s.toLowerCase()) return;
    (synonyms[c.toLowerCase()] ||= new Set()).add(s);
  };
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (meta.role === "synonym") {
      for (const r of rows) {
        const generic = r.Generic_Name || r.generic || "";
        const brand = r.Trade_Brand_Name || r.trade_name || "";
        const extra = (r.Synonyms || "").split(";").map((x) => x.trim()).filter(Boolean);
        if (generic) { add(generic, brand); extra.forEach((e) => add(generic, e)); }
      }
    }
    if (meta.role === "enrichment" && meta.kind === "conversion") {
      for (const r of rows) {
        const parent = r.Parent_Nutrient || "";
        const salt = r.Salt_Form_As_In_Schedule || r.Salt_Form_Or_Source || r.Salt_Form || "";
        if (parent && salt) add(parent, salt);
      }
    }
  }
  return synonyms;
}

// Build a prohibited-name set from status tabs.
function buildProhibited(tabs) {
  const set = new Map(); // nameLower -> {note, tab}
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    if (meta.role !== "status") continue;
    for (const r of (tabs[tab]?.rows || [])) {
      const keys = Object.keys(r);
      const nameKey = detectNameKey(keys);
      const name = norm(r[nameKey]);
      if (name) set.set(name.toLowerCase(), { note: meta.note || null, tab });
    }
  }
  return set;
}

export function normalize(snapshot) {
  const { tabs } = snapshot;
  const synonymIndex = buildSynonymIndex(tabs);
  const prohibited = buildProhibited(tabs);

  const entities = new Map(); // slug -> entity
  const anomalies = [];
  const tabColumns = {}; // governance: detected columns per tab

  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (rows.length) tabColumns[tab] = { columns: Object.keys(rows[0]), role: meta.role, detectedNameKey: detectNameKey(Object.keys(rows[0])) };
    if (meta.role !== "entity") continue;

    const updatedAt = tabs[tab]?.updated_at || null;
    for (const r of rows) {
      const keys = Object.keys(r);
      const nameKey = detectNameKey(keys);
      const name = norm(r[nameKey]);
      if (!name || name.length < QUALITY.minNameLen) {
        anomalies.push({ tab, issue: "missing/short name", row: r });
        continue;
      }
      const slug = slugify(name);
      if (!slug) { anomalies.push({ tab, issue: "empty slug", name }); continue; }

      let e = entities.get(slug);
      if (!e) {
        e = {
          slug, name, domain: "nutraceutical", category: meta.category,
          identity: {}, synonyms: [],
          summary: "", // intentionally empty in 2.0 — generated at render time in 2.1
          status: [], related: [], faq: [],
          provenance: { source_tabs: [], db_updated_at: updatedAt },
        };
        entities.set(slug, e);
      } else if (e.category !== meta.category) {
        // same name in two categories → flag, keep first, record both
        anomalies.push({ tab, issue: "category conflict", name, categories: [e.category, meta.category] });
      }
      if (!e.provenance.source_tabs.includes(tab)) e.provenance.source_tabs.push(tab);

      // India FSSAI status (permitted, since it appears in a schedule/permitted tab)
      if (!e.status.find((s) => s.framework === PRIMARY_FRAMEWORK)) {
        e.status.push({
          framework: PRIMARY_FRAMEWORK,
          framework_label: FRAMEWORKS[PRIMARY_FRAMEWORK].label,
          status: "permitted",
          limit: norm(r.Max_Limit || r.Limit || r.Daily_Limit || r.Permitted_Limit || ""),
          conditions: norm(r.Conditions || r.Form || r.Notes || ""),
          source_ref: FRAMEWORKS[PRIMARY_FRAMEWORK].source_default,
          last_reviewed: updatedAt ? updatedAt.slice(0, 10) : null,
          version: updatedAt ? `db-${updatedAt.slice(0, 10)}` : "db-unknown",
        });
      }
      // attach synonyms
      const syn = synonymIndex[name.toLowerCase()];
      if (syn) for (const s of syn) if (!e.synonyms.includes(s)) e.synonyms.push(s);
    }
  }

  // Apply prohibited overrides
  for (const e of entities.values()) {
    const p = prohibited.get(e.name.toLowerCase());
    if (p) {
      const fssai = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (fssai) { fssai.status = "prohibited"; fssai.conditions = p.note || fssai.conditions; }
    }
  }

  // Related: up to 6 siblings in the same category
  const byCat = {};
  for (const e of entities.values()) (byCat[e.category] ||= []).push(e.slug);
  for (const e of entities.values()) {
    e.related = (byCat[e.category] || []).filter((s) => s !== e.slug).slice(0, 6);
  }

  return {
    entities: [...entities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    synonymIndex, prohibited: [...prohibited.keys()], anomalies, tabColumns,
  };
}
