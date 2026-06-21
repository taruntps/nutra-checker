// Build sitemap.xml from the fixed marketing pages + dynamic ingredient URLs.
const BASE = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/sample-report/", priority: "0.8", changefreq: "monthly" },
  { loc: "/terms/", priority: "0.3", changefreq: "yearly" },
  { loc: "/privacy/", priority: "0.3", changefreq: "yearly" },
];

export function buildSitemap(extra = []) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...BASE, ...extra].map((u) =>
    `  <url>\n    <loc>https://regulyze.in${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
