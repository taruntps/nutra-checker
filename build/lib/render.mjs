// Reusable Ingredient Intelligence page templates (hub / category / ingredient).
// Pure functions: entity data in → static HTML out. No runtime dependencies.

const SITE = "https://regulyze.in";
export const CAT_PLURAL = {
  vitamin: "Vitamins", mineral: "Minerals", "amino-acid": "Amino Acids",
  nucleotide: "Nucleotides", botanical: "Botanicals", probiotic: "Probiotics",
  prebiotic: "Prebiotics", additive: "Additives", other: "Other Ingredients",
};
const CAT_SINGULAR = {
  vitamin: "vitamin", mineral: "mineral", "amino-acid": "amino acid",
  nucleotide: "nucleotide", botanical: "botanical", probiotic: "probiotic strain",
  prebiotic: "prebiotic", additive: "food additive", other: "ingredient",
};
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jeval = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

function fssaiOf(e) { return e.status.find((s) => s.framework === "india-fssai"); }
function statusWord(s) {
  if (!s) return "tracked";
  return s.status === "permitted" ? "permitted for use"
    : s.status === "prohibited" ? "not permitted"
    : s.status === "restricted" ? "permitted with restrictions" : "under review";
}
function badge(status) {
  const m = { permitted: ["b-ok", "Permitted"], prohibited: ["b-fail", "Not permitted"],
    restricted: ["b-warn", "Restricted"], "not-assessed": ["b-na", "Not yet assessed"] };
  const [cls, label] = m[status] || ["b-na", status || "—"];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

// ── Generated, data-driven copy (evergreen, framework-neutral) ───────────────
export function genSummary(e) {
  const f = fssaiOf(e);
  const cat = CAT_SINGULAR[e.category] || "ingredient";
  const syn = e.synonyms.length ? ` (also known as ${e.synonyms.slice(0, 2).map(esc).join(", ")})` : "";
  const lim = f && f.limit ? `, with a permitted limit of ${esc(f.limit)}` : "";
  return `${esc(e.name)}${syn} is a ${cat} ${statusWord(f)} in nutraceuticals and health supplements under India's FSSAI framework${lim}. `
    + `Regulyze tracks its regulatory status, limits and label requirements across regulatory frameworks.`;
}
export function genFAQ(e) {
  const f = fssaiOf(e);
  const cats = [CAT_PLURAL[e.category], ...((e.categories || []).filter((c) => c !== e.category).map((c) => CAT_PLURAL[c]))]
    .filter(Boolean).join(", ");
  return [
    { q: `Is ${e.name} permitted in nutraceuticals under FSSAI (India)?`,
      a: `${e.name} is currently ${statusWord(f)} in health supplements and nutraceuticals under India's FSSAI framework, per ${esc((f && f.source_ref) || "the applicable regulation")}. Always verify against the current official regulation for your product and market.` },
    { q: `What is the permitted limit of ${e.name}?`,
      a: f && f.limit ? `The permitted limit recorded for ${e.name} is ${esc(f.limit)}. Limits can vary by product type and market — confirm against the current regulation.`
        : `No single numeric limit is listed in the source for ${e.name}; permitted use is at GMP or as specified. Confirm against the current regulation.` },
    { q: `What product category does ${e.name} belong to?`, a: `${e.name} is classified under: ${esc(cats)}.` },
  ];
}

// ── Shared chrome ────────────────────────────────────────────────────────────
function head({ title, desc, canonical, jsonld, preview }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${preview ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${canonical}"/>\n<meta name="robots" content="index,follow,max-image-preview:large">`}
<link rel="icon" type="image/png" href="/design-system/assets/logo-mark.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/design-system/assets/ingredients.css">
${jsonld ? `<script type="application/ld+json">${jeval(jsonld)}</script>` : ""}
</head><body>${preview ? '<div class="pvbar">PREVIEW · Ingredient-page template for approval · noindex (not the live tree)</div>' : ""}`;
}
function header(root) {
  return `<header class="ihead"><div class="ihead-in">
<a class="brand" href="/"><img src="/design-system/assets/logo-mark.png" alt="Regulyze"> Regulyze</a>
<nav class="inav"><a href="/#features">Platform</a><a href="${root}/">Ingredients</a><a href="/#how">How it works</a></nav>
<a class="ibtn" href="/app/?auth=signup">Check a formulation</a>
</div></header>`;
}
function footer() {
  return `<footer class="ifoot"><div class="ifoot-in">
<span>© 2026 TPS Xperts Group · regulyze.in · Indicative only — not a substitute for legal/regulatory advice.</span>
<span><a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span>
</div></footer></body></html>`;
}
const crumb = (parts) => `<div class="wrap"><nav class="crumb">${parts.map((p, i) =>
  p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`)
  .join(" › ")}</nav></div>`;

// ── Ingredient page ──────────────────────────────────────────────────────────
export function renderIngredient(e, { root = "/ingredients", preview = false } = {}) {
  const url = `${SITE}${root}/${e.slug}/`;
  const f = fssaiOf(e);
  const summary = genSummary(e);
  const faq = genFAQ(e);
  const catLabel = CAT_PLURAL[e.category] || "Ingredients";
  const secondary = (e.categories || []).filter((c) => c !== e.category);

  const statusRows = e.status.map((s) => `<tr>
    <td><strong>${esc(s.framework_label)}</strong></td>
    <td>${badge(s.status)}</td>
    <td>${esc(s.limit || "As specified / GMP")}</td>
    <td>${esc(s.source_ref || "—")}</td>
    <td>${esc(s.last_reviewed || "—")}</td></tr>`).join("");

  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "DefinedTerm", "@id": url + "#term", name: e.name, url,
      description: summary.replace(/<[^>]+>/g, ""), termCode: e.slug,
      inDefinedTermSet: `${SITE}${root}/#set` },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: `${SITE}${root}/` },
      { "@type": "ListItem", position: 3, name: catLabel, item: `${SITE}${root}/category/${e.category}/` },
      { "@type": "ListItem", position: 4, name: e.name, item: url } ] },
    { "@type": "FAQPage", mainEntity: faq.map((q) => ({ "@type": "Question", name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.a.replace(/<[^>]+>/g, "") } })) },
  ] };

  const title = `${e.name} — Regulatory status, limits & compliance | Regulyze`;
  const desc = summary.replace(/<[^>]+>/g, "").slice(0, 155);

  return head({ title, desc, canonical: url, jsonld, preview }) + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients", href: `${root}/` },
      { label: catLabel, href: `${root}/category/${e.category}/` }, { label: e.name }]) +
  `<main class="wrap"><span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">${esc(e.name)}</h1>
   <p class="answer">${summary}</p>
   <div class="tags"><span class="tag primary">${esc(catLabel)}</span>${secondary.map((c) => `<span class="tag">${esc(CAT_PLURAL[c] || c)}</span>`).join("")}</div>
   <div class="cols">
    <div class="main">
      <div class="section"><h2>Regulatory status</h2>
        <table class="stbl"><thead><tr><th>Framework</th><th>Status</th><th>Limit</th><th>Source</th><th>Last reviewed</th></tr></thead>
        <tbody>${statusRows}</tbody></table>
        <p class="prov" style="border:0;margin-top:10px;padding-top:6px">Coverage for the USA (FDA), EU (EFSA), UK, GCC and ASEAN is being added — this page updates automatically as frameworks are assessed.</p>
      </div>
      <div class="section"><h2>About ${esc(e.name)}</h2>
        <p>${esc(e.name)} is tracked in the Regulyze Ingredient Intelligence database as a ${esc(CAT_SINGULAR[e.category] || "ingredient")}${e.identity.common_name ? `, also referred to as ${esc(e.identity.common_name)}` : ""}. The regulatory details on this page are generated from Regulyze's structured regulatory dataset and are reviewed against the cited source.</p>
      </div>
      <div class="section faq"><h2>Frequently asked questions</h2>
        ${faq.map((q) => `<details><summary>${esc(q.q)}</summary><p>${q.a}</p></details>`).join("")}
      </div>
    </div>
    <aside class="aside">
      <div class="card"><h3>Identity</h3>
        <div class="kv"><span class="k">Primary category</span><span class="v">${esc(catLabel)}</span></div>
        ${e.identity.common_name ? `<div class="kv"><span class="k">Common name</span><span class="v">${esc(e.identity.common_name)}</span></div>` : ""}
        ${e.synonyms.length ? `<div class="kv"><span class="k">Also known as</span><span class="v">${esc(e.synonyms.slice(0, 4).join(", "))}</span></div>` : ""}
        <div class="kv"><span class="k">Regulatory source</span><span class="v">${esc((f && f.source_ref) || "—")}</span></div>
      </div>
      ${e.related && e.related.length ? `<div class="card rel"><h3>Related ingredients</h3>${e.related.map((s) => `<a href="${root}/${s}/">${esc(s.replace(/-/g, " "))}</a>`).join("")}</div>` : ""}
      <div class="cta-card"><h3>Using ${esc(e.name)} in a product?</h3><p>Check your full formulation against regulatory requirements in seconds — free.</p><a class="ibtn" href="/app/?auth=signup">Check a formulation free</a></div>
    </aside>
   </div>
   <p class="prov wrap" style="max-width:none;padding:0">Source: ${esc((f && f.source_ref) || "—")} · Last reviewed: ${esc((f && f.last_reviewed) || "—")} · Data version: ${esc((f && f.version) || "—")}. Indicative only — verify against the current official regulation before use.</p>
   </main>` + footer();
}

// ── Category page ────────────────────────────────────────────────────────────
export function renderCategory(category, entities, { root = "/ingredients", preview = false } = {}) {
  const label = CAT_PLURAL[category] || category;
  const url = `${SITE}${root}/category/${category}/`;
  const list = entities.filter((e) => e.category === category).sort((a, b) => a.name.localeCompare(b.name));
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", "@id": url, name: `${label} — Ingredient Intelligence`, url },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: `${SITE}${root}/` },
      { "@type": "ListItem", position: 3, name: label, item: url } ] } ] };
  const title = `${label} — regulatory status & compliance | Regulyze`;
  const desc = `Browse ${list.length} ${label.toLowerCase()} tracked in the Regulyze Ingredient Intelligence database — regulatory status, permitted limits and compliance, starting with India (FSSAI).`;
  return head({ title, desc, canonical: url, jsonld, preview }) + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients", href: `${root}/` }, { label }]) +
  `<main class="wrap"><span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">${esc(label)}</h1>
   <p class="answer">${list.length} ${esc(label.toLowerCase())} tracked for nutraceutical &amp; supplement compliance — each with regulatory status, permitted limits and synonyms, starting with India (FSSAI) and expanding to other frameworks.</p>
   <div class="grid ilist">
   ${list.map((e) => { const f = fssaiOf(e); return `<a class="gcard" href="${root}/${e.slug}/"><span><span class="gname" style="font-size:16px">${esc(e.name)}</span><span class="gmeta">${esc(f && f.limit ? f.limit : "As specified / GMP")}</span></span>${badge(f && f.status)}</a>`; }).join("")}
   </div></main>` + footer();
}

// ── Hub page ─────────────────────────────────────────────────────────────────
export function renderHub(categoryCounts, { root = "/ingredients", preview = false } = {}) {
  const url = `${SITE}${root}/`;
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const order = ["botanical", "additive", "amino-acid", "probiotic", "vitamin", "mineral", "prebiotic", "nucleotide"];
  const cats = order.filter((c) => categoryCounts[c]);
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "DefinedTermSet", "@id": url + "#set", name: "Regulyze Ingredient Intelligence Database", url,
      description: `Structured regulatory intelligence on ${total}+ nutraceutical and supplement ingredients.` },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: url } ] } ] };
  const title = "Ingredient Intelligence Database — regulatory status & compliance | Regulyze";
  const desc = `Regulatory status, permitted limits and compliance for ${total}+ nutraceutical and supplement ingredients — India (FSSAI) today, with FDA, EFSA, UK, GCC and ASEAN expanding.`;
  return head({ title, desc, canonical: url, jsonld, preview }) + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients" }]) +
  `<main class="wrap"><span class="eyebrow">Regulatory intelligence</span>
   <h1 class="page-h1">Ingredient Intelligence Database</h1>
   <p class="answer">Regulatory status, permitted limits, synonyms and compliance for <strong>${total}+</strong> nutraceutical &amp; supplement ingredients — starting with India (FSSAI) and expanding to FDA, EFSA, UK, GCC and ASEAN.</p>
   <div class="grid">
   ${cats.map((c) => `<a class="gcard" href="${root}/category/${c}/"><span class="gname">${esc(CAT_PLURAL[c])}</span><div class="gmeta"><span class="gcount">${categoryCounts[c]}</span> ingredients</div></a>`).join("")}
   </div></main>` + footer();
}
