// Fetch regulation_data from Supabase (paginated). Read-only, anon key.
// Returns: { tabs: { [tabName]: { rows: object[], updated_at: string|null } }, fetchedAt }
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.mjs";

const PAGE = 1000;

export async function fetchRegulationData() {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${SUPABASE_URL}/rest/v1/regulation_data` +
      `?select=tab_name,row_index,data,updated_at` +
      `&order=tab_name.asc,row_index.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Supabase fetch failed: HTTP ${res.status} — ${await res.text()}`);
    }
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < PAGE) break;
  }

  const tabs = {};
  for (const r of all) {
    const t = (tabs[r.tab_name] ||= { rows: [], updated_at: null });
    t.rows.push(r.data);
    if (!t.updated_at || r.updated_at > t.updated_at) t.updated_at = r.updated_at;
  }
  return { tabs, rowCount: all.length, fetchedAt: new Date().toISOString() };
}
