// Reusable Ingredient Intelligence page templates (hub / category / ingredient).
// Pure functions: entity data in → static HTML out. No runtime dependencies.

const SITE = "https://regulyze.in";

// Auth gate — Supabase session lives under this key in localStorage (shared across regulyze.in).
// The hub page loads this helper so clicks on Search / Browse go to login when the user is logged out.
const SUPA_REF = "afttrokqchfcpjcekuyh";
const AUTH_GATE_SCRIPT = `<script>(function(){
  function _rgHas(){try{var r=localStorage.getItem('sb-${SUPA_REF}-auth-token');if(!r)return false;var s=JSON.parse(r);var t=s&&(s.access_token||(Array.isArray(s)&&s[0]&&s[0].access_token));var e=s&&(s.expires_at||(Array.isArray(s)&&s[0]&&s[0].expires_at));return !!(t&&(!e||Math.floor(Date.now()/1000)<e));}catch(e){return false;}}
  window.rgCheckAuth=function(dest){if(_rgHas()){window.location.href=dest;}else{window.location.href='/app/?auth=signin';}};
})()</script>`;

// Page-level redirect guard — placed immediately after <body> on gated pages.
const AUTH_GUARD_REDIRECT = `<script>(function(){try{var r=localStorage.getItem('sb-${SUPA_REF}-auth-token');var ok=false;if(r){var s=JSON.parse(r);var t=s&&(s.access_token||(Array.isArray(s)&&s[0]&&s[0].access_token));var e=s&&(s.expires_at||(Array.isArray(s)&&s[0]&&s[0].expires_at));ok=!!(t&&(!e||Math.floor(Date.now()/1000)<e));}if(!ok){window.location.replace('/app/?auth=signin');}}catch(e){window.location.replace('/app/?auth=signin');}})()</script>`;

export const CAT_PLURAL = {
  vitamin: "Vitamins", mineral: "Minerals", "amino-acid": "Amino Acids",
  nucleotide: "Nucleotides", botanical: "Botanicals", nutraceutical: "Nutraceuticals",
  probiotic: "Probiotics", prebiotic: "Prebiotics", additive: "Additives", other: "Other Ingredients",
};
const CAT_SINGULAR = {
  vitamin: "vitamin", mineral: "mineral", "amino-acid": "amino acid",
  nucleotide: "nucleotide", botanical: "botanical", nutraceutical: "nutraceutical",
  probiotic: "probiotic strain", prebiotic: "prebiotic", additive: "food additive", other: "ingredient",
};
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jeval = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

function fssaiOf(e) { return e.status.find((s) => s.framework === "india-fssai"); }
// Display name = curated/common English name when present (botanicals), else the
// regulatory name. The original regulatory name is always available as e.name.
function dispName(e) { return e.displayName || e.name; }
function sciName(e) { return e.botanical && e.botanical.scientificName ? e.botanical.scientificName : ""; }
// Public display label (slug listings, search index, related lookups).
export function displayLabel(e) { return dispName(e); }
// Search terms for the client-side index: display name + regulatory name +
// scientific name + alternate names (so FSSAI/transliterated names still match).
export function searchTerms(e) {
  const t = new Set();
  if (e.regulatoryName && e.regulatoryName !== dispName(e)) t.add(e.regulatoryName);
  const sci = sciName(e); if (sci) t.add(sci);
  for (const a of (e.altNames || e.synonyms || [])) t.add(a);
  t.delete(dispName(e));
  return [...t].filter(Boolean).slice(0, 6);
}
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
  const name = dispName(e);
  const sci = sciName(e);
  // Botanicals lead with the English/common name + scientific name in parentheses.
  const ident = sci
    ? (name.includes("(") ? `, ${esc(sci)},` : ` (${esc(sci)})`)
    : (e.synonyms.length ? ` (also known as ${e.synonyms.slice(0, 2).map(esc).join(", ")})` : "");
  const lim = f && f.limit ? `, with a permitted limit of ${esc(f.limit)}` : "";
  return `${esc(name)}${ident} is a ${cat} ${statusWord(f)} in nutraceuticals and health supplements under India's FSSAI framework${lim}. `
    + `Regulyze tracks its regulatory status, limits and label requirements across regulatory frameworks.`;
}
export function genFAQ(e) {
  const f = fssaiOf(e);
  const name = dispName(e);
  const sci = sciName(e);
  const reg = e.regulatoryName && e.regulatoryName !== name ? ` (listed in the regulation as “${esc(e.regulatoryName)}”)` : "";
  const cats = [CAT_PLURAL[e.category], ...((e.categories || []).filter((c) => c !== e.category).map((c) => CAT_PLURAL[c]))]
    .filter(Boolean).join(", ");
  const faq = [
    { q: `Is ${name} permitted in nutraceuticals under FSSAI (India)?`,
      a: `${esc(name)}${sci ? ` (${esc(sci)})` : ""}${reg} is currently ${statusWord(f)} in health supplements and nutraceuticals under India's FSSAI framework, per ${esc((f && f.source_ref) || "the applicable regulation")}. Always verify against the current official regulation for your product and market.` },
    { q: `What is the permitted dosage of ${name}?`,
      a: f && f.limit ? `The permitted level recorded for ${esc(name)} is ${esc(f.limit)}. Limits can vary by product type and market — confirm against the current regulation.`
        : `No single numeric limit is listed in the source for ${esc(name)}; permitted use is at GMP or as specified. Confirm against the current regulation.` },
    { q: `What product category does ${name} belong to?`, a: `${esc(name)} is classified under: ${esc(cats)}.` },
  ];
  if (sci) faq.push({ q: `What is the botanical (scientific) name of ${name}?`,
    a: `${esc(name)} corresponds to ${esc(sci)}${e.botanical && e.botanical.part ? `, with the ${esc(e.botanical.part.toLowerCase())} used in nutraceutical preparations` : ""}.` });
  if (e.rda && e.rda.groups && e.rda.groups.length) {
    const a = e.rda.groups.find((g) => /adult man/i.test(g.label)) || e.rda.groups[0];
    const u = e.rda.unit ? ` ${e.rda.unit}` : "";
    faq.push({ q: `What is the recommended daily allowance (RDA) of ${name} in India?`,
      a: `Per ICMR-NIN (2020), the RDA of ${esc(name)} for ${a.label.toLowerCase()} is ${esc(a.value)}${esc(u)}. RDA is a dietary reference intake and is distinct from the maximum permitted supplement limit.` });
  }
  return faq;
}
// Structured dosage table for botanicals with labelled forms (Root/Powder/Extract…).
// Only renders when there are 2+ labelled forms — a single flat limit stays in the
// regulatory status table to avoid duplication.
function dosageSection(e) {
  const rows = (e.dosageForms || []).filter((r) => r.form);
  if (rows.length < 2) return "";
  const body = rows.map((r) => `<tr><td><strong>${esc(r.form)}</strong></td><td>${esc(r.dose)}</td></tr>`).join("");
  return `<div class="section"><h2>Permitted dosage by form</h2>
    <table class="stbl"><thead><tr><th>Preparation / form</th><th>Permitted daily quantity</th></tr></thead><tbody>${body}</tbody></table>
    <p class="prov" style="border:0;margin-top:8px;padding-top:4px">Per India's FSSAI Schedule listing for ${esc(dispName(e))}. Quantities are per-day permitted ranges for the stated form — confirm against the current official regulation for your product.</p></div>`;
}
function rdaSection(e) {
  if (!e.rda || !e.rda.groups || !e.rda.groups.length) return "";
  const rows = e.rda.groups.map((g) => `<tr><td>${esc(g.label)}</td><td>${esc(g.value)}${e.rda.unit ? ` ${esc(e.rda.unit)}` : ""}</td></tr>`).join("");
  return `<div class="section"><h2>Recommended Dietary Allowance (ICMR-NIN 2020)</h2>
    <table class="stbl"><thead><tr><th>Group</th><th>RDA</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="prov" style="border:0;margin-top:8px;padding-top:4px">Source: ${esc(e.rda.source || "ICMR-NIN RDA 2020")}. RDA is a reference dietary intake — distinct from the maximum permitted supplement limit.</p></div>`;
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
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5EV0X8LPMN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-5EV0X8LPMN');</script>
<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","xadtpvu8h4");</script>
<script>(function(){function ev(n,p){if(typeof gtag==='function'){gtag('event',n,p||{});}}window.rgEvent=ev;document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('a,button');if(!el)return;var href=el.getAttribute('href')||'',txt=(el.textContent||'').trim().slice(0,40);if(href.indexOf('auth=signup')>-1||/check a formulation/i.test(txt))ev('cta_signup_click',{label:txt,location:location.pathname});else if(href.indexOf('mailto:')>-1)ev(/bug/i.test(href)?'bug_report_click':'contact_click',{label:txt});},true);document.addEventListener('input',function(e){if(e.target&&(e.target.id==='q'||e.target.type==='search')){clearTimeout(window.__rgst);window.__rgst=setTimeout(function(){if((e.target.value||'').length>2)ev('ingredient_search',{q:String(e.target.value).slice(0,60)});},900);}},true);})();</script>
</head><body>${preview ? '<div class="pvbar">PREVIEW · Ingredient-page template for approval · noindex (not the live tree)</div>' : ""}`;
}
function header(root) {
  return `<header class="ihead"><div class="ihead-in">
<a class="brand" href="/"><img src="/design-system/assets/logo-mark.png" alt="Regulyze"> Regulyze</a>
<nav class="inav"><a href="/#features">Platform</a><a href="${root}/">Ingredients</a><a href="/#how">How it works</a></nav>
<a class="ibtn" href="/app/?auth=signup">Check a formulation</a>
</div></header>`;
}
function footer(root = "/ingredients") {
  return `<footer class="ifoot"><div class="ifoot-in">
<span>© 2026 TPS Xperts Group · regulyze.in · Indicative only — not a substitute for legal/regulatory advice.</span>
<span><a href="${root}/">Ingredients</a> · <a href="${root}/all/">Directory</a> · <a href="${root}/search/">Search</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="mailto:support@regulyze.in">Contact</a> · <a href="mailto:support@regulyze.in?subject=Bug%20Report%20-%20regulyze.in">Report a bug</a></span>
</div></footer></body></html>`;
}
const crumb = (parts) => `<div class="wrap"><nav class="crumb">${parts.map((p, i) =>
  p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`)
  .join(" › ")}</nav></div>`;
// Visible back button (in addition to the breadcrumb) — addresses "no way back" navigation.
const backBtn = (href, label) => `<a class="backlink" href="${href}"><span aria-hidden="true">←</span> ${esc(label)}</a>`;

// ── Ingredient page ──────────────────────────────────────────────────────────
export function renderIngredient(e, { root = "/ingredients", preview = false, nameOf = null } = {}) {
  const url = `${SITE}${root}/${e.slug}/`;
  const f = fssaiOf(e);
  const name = dispName(e);
  const sci = sciName(e);
  const part = e.botanical && e.botanical.part ? e.botanical.part : "";
  const isBot = e.category === "botanical";
  const regName = e.regulatoryName || e.name;
  const labelOf = (s) => (nameOf && nameOf[s]) || s.replace(/-/g, " ");
  const summary = genSummary(e);
  const faq = genFAQ(e);
  const catLabel = CAT_PLURAL[e.category] || "Ingredients";
  const secondary = (e.categories || []).filter((c) => c !== e.category);
  // "Also known as": botanicals use the curated/common alternate-name set; others
  // keep the synonym list.
  const aka = (isBot && e.altNames && e.altNames.length ? e.altNames : e.synonyms) || [];

  const statusRows = e.status.map((s) => `<tr>
    <td><strong>${esc(s.framework_label)}</strong></td>
    <td>${badge(s.status)}</td>
    <td>${esc(s.limit || "As specified / GMP")}</td>
    <td>${esc(s.source_ref || "—")}</td>
    <td>${esc(s.last_reviewed || "—")}</td></tr>`).join("");

  const definedTerm = { "@type": "DefinedTerm", "@id": url + "#term", name, url,
    description: summary.replace(/<[^>]+>/g, ""), termCode: e.slug,
    inDefinedTermSet: `${SITE}${root}/#set` };
  if (aka.length) definedTerm.alternateName = aka.slice(0, 8);
  const jsonld = { "@context": "https://schema.org", "@graph": [
    definedTerm,
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: `${SITE}${root}/` },
      { "@type": "ListItem", position: 3, name: catLabel, item: `${SITE}${root}/category/${e.category}/` },
      { "@type": "ListItem", position: 4, name, item: url } ] },
    { "@type": "FAQPage", mainEntity: faq.map((q) => ({ "@type": "Question", name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.a.replace(/<[^>]+>/g, "") } })) },
  ] };

  // SEO title/meta lead with the English/common name (+ scientific name for
  // botanicals), per the approved spec.
  const title = isBot && sci
    ? (name.includes("(")
        ? `${name} — ${sci}: FSSAI dosage & compliance | Regulyze`
        : `${name} (${sci}) — FSSAI status, dosage & compliance | Regulyze`)
    : `${name} — Regulatory status, limits & compliance | Regulyze`;
  const desc = summary.replace(/<[^>]+>/g, "").slice(0, 155);

  return head({ title, desc, canonical: url, jsonld, preview }) + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients", href: `${root}/` },
      { label: catLabel, href: `${root}/category/${e.category}/` }, { label: name }]) +
  `<main class="wrap">${backBtn(`${root}/category/${e.category}/`, `Back to ${catLabel}`)}<span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">${esc(name)}</h1>
   ${sci ? `<p class="sci-sub"><em>${esc(sci)}</em>${part ? ` · ${esc(part)}` : ""}</p>` : ""}
   <p class="answer">${summary}</p>
   <div class="tags"><span class="tag primary">${esc(catLabel)}</span>${secondary.map((c) => `<span class="tag">${esc(CAT_PLURAL[c] || c)}</span>`).join("")}</div>
   <div class="cols">
    <div class="main">
      <div class="section"><h2>Regulatory status</h2>
        <table class="stbl"><thead><tr><th>Framework</th><th>Status</th><th>Limit</th><th>Source</th><th>Last reviewed</th></tr></thead>
        <tbody>${statusRows}</tbody></table>
        <p class="prov" style="border:0;margin-top:10px;padding-top:6px">Coverage for the USA (FDA), EU (EFSA), UK, GCC and ASEAN is being added — this page updates automatically as frameworks are assessed.</p>
      </div>
      ${dosageSection(e)}
      ${rdaSection(e)}
      <div class="section"><h2>About ${esc(name)}</h2>
        <p>${esc(name)} is tracked in the Regulyze Ingredient Intelligence database as a ${esc(CAT_SINGULAR[e.category] || "ingredient")}${sci ? ` (<em>${esc(sci)}</em>)` : ""}${isBot && regName !== name ? `. It is listed in India's FSSAI schedules under the regulatory name <strong>${esc(regName)}</strong>` : ""}. The regulatory details on this page are generated from Regulyze's structured regulatory dataset and are reviewed against the cited source.</p>
      </div>
      <div class="section faq"><h2>Frequently asked questions</h2>
        ${faq.map((q) => `<details><summary>${esc(q.q)}</summary><p>${q.a}</p></details>`).join("")}
      </div>
    </div>
    <aside class="aside">
      <div class="card"><h3>Identity</h3>
        <div class="kv"><span class="k">Primary category</span><span class="v">${esc(catLabel)}</span></div>
        ${sci ? `<div class="kv"><span class="k">Scientific name</span><span class="v"><em>${esc(sci)}</em></span></div>` : ""}
        ${part ? `<div class="kv"><span class="k">Plant part</span><span class="v">${esc(part)}</span></div>` : ""}
        ${isBot && regName !== name ? `<div class="kv"><span class="k">Regulatory name</span><span class="v">${esc(regName)}</span></div>` : ""}
        ${!isBot && e.identity.common_name ? `<div class="kv"><span class="k">Common name</span><span class="v">${esc(e.identity.common_name)}</span></div>` : ""}
        ${aka.length ? `<div class="kv"><span class="k">Also known as</span><span class="v">${esc(aka.slice(0, 4).join(", "))}</span></div>` : ""}
        <div class="kv"><span class="k">Regulatory source</span><span class="v">${esc((f && f.source_ref) || "—")}</span></div>
      </div>
      ${e.related && e.related.length ? `<div class="card rel"><h3>Related ingredients</h3>${e.related.map((s) => `<a href="${root}/${s}/">${esc(labelOf(s))}</a>`).join("")}</div>` : ""}
      <div class="cta-card"><h3>Using ${esc(name)} in a product?</h3><p>Check your full formulation against regulatory requirements in seconds — free.</p><a class="ibtn" href="/app/?auth=signup">Check a formulation free</a></div>
    </aside>
   </div>
   <p class="prov wrap" style="max-width:none;padding:0">Source: ${esc((f && f.source_ref) || "—")} · Last reviewed: ${esc((f && f.last_reviewed) || "—")} · Data version: ${esc((f && f.version) || "—")}. Indicative only — verify against the current official regulation before use.</p>
   </main>` + footer(root);
}

// ── Category page ────────────────────────────────────────────────────────────
export function renderCategory(category, entities, { root = "/ingredients", preview = false } = {}) {
  const label = CAT_PLURAL[category] || category;
  const url = `${SITE}${root}/category/${category}/`;
  const list = entities.filter((e) => e.category === category).sort((a, b) => dispName(a).localeCompare(dispName(b)));
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
  `<main class="wrap">${backBtn(`${root}/`, "Back to Ingredients")}<span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">${esc(label)}</h1>
   <p class="answer">${list.length} ${esc(label.toLowerCase())} tracked for nutraceutical &amp; supplement compliance — each with regulatory status, permitted limits and synonyms, starting with India (FSSAI) and expanding to other frameworks.</p>
   <div class="grid ilist">
   ${list.map((e) => { const f = fssaiOf(e); return `<a class="gcard" href="${root}/${e.slug}/"><span class="gname">${esc(dispName(e))}</span>${badge(f && f.status)}</a>`; }).join("")}
   </div></main>` + footer(root);
}

// ── Hub page ─────────────────────────────────────────────────────────────────
export function renderHub(categoryCounts, { root = "/ingredients", preview = false } = {}) {
  const url = `${SITE}${root}/`;
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const order = ["botanical", "nutraceutical", "additive", "amino-acid", "probiotic", "vitamin", "mineral", "prebiotic", "nucleotide"];
  const cats = order.filter((c) => categoryCounts[c]);
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "DefinedTermSet", "@id": url + "#set", name: "Regulyze Ingredient Intelligence Database", url,
      description: `Structured regulatory intelligence on ${total}+ nutraceutical and supplement ingredients.` },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: url } ] } ] };
  const title = "Ingredient Intelligence Database — regulatory status & compliance | Regulyze";
  const desc = `Regulatory status, permitted limits and compliance for ${total}+ nutraceutical and supplement ingredients — India (FSSAI) today, with FDA, EFSA, UK, GCC and ASEAN expanding.`;
  return head({ title, desc, canonical: url, jsonld, preview }) + AUTH_GATE_SCRIPT + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients" }]) +
  `<main class="wrap"><span class="eyebrow">Regulatory intelligence</span>
   <h1 class="page-h1">Ingredient Intelligence Database</h1>
   <p class="answer">Regulatory status, permitted limits, synonyms and compliance for <strong>${total}+</strong> nutraceutical &amp; supplement ingredients — starting with India (FSSAI) and expanding to FDA, EFSA, UK, GCC and ASEAN.</p>
   <div class="util-links"><a class="ibtn" href="${root}/search/" onclick="if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();window.rgCheckAuth('${root}/search/');}">🔍 Search ingredients</a><a class="ibtn" style="background:var(--cream-2);color:var(--teal-d)" href="${root}/all/" onclick="if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();window.rgCheckAuth('${root}/all/');}">Browse A–Z directory</a></div>
   <div class="grid">
   ${cats.map((c) => `<a class="gcard" href="${root}/category/${c}/"><span class="gname">${esc(CAT_PLURAL[c])}</span><div class="gmeta"><span class="gcount">${categoryCounts[c]}</span> ingredients</div></a>`).join("")}
   </div></main>` + footer(root);
}

// ── Directory page (A–Z, all live ingredients) ───────────────────────────────
export function renderDirectory(entities, { root = "/ingredients", preview = false } = {}) {
  const url = `${SITE}${root}/all/`;
  const list = entities.slice().sort((a, b) => dispName(a).localeCompare(dispName(b)));
  const groups = {};
  for (const e of list) {
    let L = (dispName(e)[0] || "#").toUpperCase();
    if (!/[A-Z]/.test(L)) L = "#";
    (groups[L] ||= []).push(e);
  }
  const letters = Object.keys(groups).sort();
  const nav = letters.map((L) => `<a href="#L${L}">${L}</a>`).join("");
  const sections = letters.map((L) => `<section id="L${L}" class="dir-sec"><h2>${L}</h2><div class="dir-grid">${
    groups[L].map((e) => `<a href="${root}/${e.slug}/">${esc(dispName(e))} <span class="dir-cat">${esc(CAT_PLURAL[e.category] || e.category)}</span></a>`).join("")
  }</div></section>`).join("");
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", "@id": url, name: "Ingredient Directory — Regulyze", url },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: `${SITE}${root}/` },
      { "@type": "ListItem", position: 3, name: "Directory", item: url } ] } ] };
  const title = "Ingredient Directory (A–Z) — regulatory status & compliance | Regulyze";
  const desc = `Browse all ${list.length} ingredients in the Regulyze Ingredient Intelligence database alphabetically — regulatory status, limits and compliance.`;
  return head({ title, desc, canonical: url, jsonld, preview }) + AUTH_GUARD_REDIRECT + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients", href: `${root}/` }, { label: "Directory" }]) +
  `<main class="wrap">${backBtn(`${root}/`, "Back to Ingredients")}<span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">Ingredient Directory</h1>
   <p class="answer">All ${list.length} ingredients tracked across the live categories — alphabetical. Use <a href="${root}/search/">search</a> to find one fast.</p>
   <div class="dir-nav">${nav}</div>${sections}</main>` + footer(root);
}

// ── Search page (client-side, static JSON index — stays decoupled) ───────────
export function renderSearch({ root = "/ingredients", preview = false } = {}) {
  const url = `${SITE}${root}/search/`;
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": url, name: "Search Ingredients — Regulyze", url },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Ingredients", item: `${SITE}${root}/` },
      { "@type": "ListItem", position: 3, name: "Search", item: url } ] } ] };
  const title = "Search Ingredients — regulatory status & compliance | Regulyze";
  const desc = "Search the Regulyze Ingredient Intelligence database by name or synonym for regulatory status, limits and compliance.";
  return head({ title, desc, canonical: url, jsonld, preview }) + AUTH_GUARD_REDIRECT + header(root) +
    crumb([{ label: "Home", href: "/" }, { label: "Ingredients", href: `${root}/` }, { label: "Search" }]) +
  `<main class="wrap">${backBtn(`${root}/`, "Back to Ingredients")}<span class="eyebrow">Ingredient intelligence</span>
   <h1 class="page-h1">Search ingredients</h1>
   <input id="q" class="search-box" type="search" placeholder="Search by name or synonym — e.g. ascorbic acid, calcium, ashwagandha" autocomplete="off" autofocus>
   <div class="search-meta" id="meta">Loading index…</div>
   <div id="results"></div></main>
   <script>
   (function(){
     var q=document.getElementById('q'),res=document.getElementById('results'),meta=document.getElementById('meta'),idx=[];
     function draw(t){t=(t||'').trim().toLowerCase();
       var items = !t ? idx.slice(0,60) : idx.filter(function(x){return x.n.toLowerCase().indexOf(t)>=0 || (x.s||[]).some(function(s){return s.toLowerCase().indexOf(t)>=0;});}).slice(0,80);
       meta.textContent = idx.length ? (t? (items.length+' match'+(items.length===1?'':'es')) : (idx.length+' ingredients · type to filter')) : '';
       res.innerHTML = items.map(function(x){return '<a href="${root}/'+x.slug+'/">'+x.n+' <span>'+x.c+'</span></a>';}).join('') || '<p style="color:var(--muted)">No matches.</p>';
     }
     fetch('${root}/ingredients-index.json').then(function(r){return r.json();}).then(function(d){idx=d;var p=new URLSearchParams(location.search).get('q');if(p)q.value=p;draw(q.value);});
     q.addEventListener('input',function(){draw(q.value);});
   })();
   </script>` + footer(root);
}
