#!/usr/bin/env bun
/**
 * Data-only JSON backup of every table Supabase exposes through PostgREST.
 *
 * This is the human-readable half of the nightly backup (see
 * .github/workflows/db-backup.yml). The authoritative restore path is the
 * pg_dump SQL file; this export exists so a backup can be inspected, grepped,
 * or partially restored without standing up a Postgres instance first.
 *
 * Tables are discovered from the PostgREST OpenAPI spec rather than hardcoded,
 * so a table added by a future migration is picked up with no change here.
 *
 * Usage: bun scripts/export-json.ts [outDir]
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { mkdir, writeFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outDir = process.argv[2] ?? "backup-json";
const PAGE_SIZE = 1000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
    ...(!SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
  ];
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

type Table = { name: string; orderBy: string };

/**
 * PostgREST exposes tables and views side by side in `definitions`. A view is
 * read-only, so its path offers only `get` — that is what separates the two.
 * Views are skipped: they hold no data of their own.
 */
async function discoverTables(): Promise<Table[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
  if (!res.ok) {
    throw new Error(`OpenAPI discovery failed: ${res.status} ${await res.text()}`);
  }
  const spec = (await res.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
    paths?: Record<string, Record<string, unknown>>;
  };

  const tables: Table[] = [];
  for (const [name, def] of Object.entries(spec.definitions ?? {})) {
    const verbs = Object.keys(spec.paths?.[`/${name}`] ?? {});
    if (!verbs.includes("post")) continue; // read-only path => view

    const columns = Object.keys(def.properties ?? {});
    if (!columns.length) throw new Error(`Table ${name} reported no columns`);

    // Paging without a total order can repeat or skip rows between requests.
    // Not every table here has an `id` (admin_email_allowlist, email_templates,
    // dinner_note_votes), so order by every column: that is total for any table,
    // and rows that tie on all columns are interchangeable anyway.
    tables.push({ name, orderBy: columns.map((c) => `${c}.asc`).join(",") });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchTable(table: Table): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${SUPABASE_URL}/rest/v1/${table.name}?select=*&order=${encodeURIComponent(table.orderBy)}`;
    const res = await fetch(url, {
      headers: { ...headers, Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    });
    if (!res.ok) {
      throw new Error(`Reading ${table.name} failed: ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as unknown[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

await mkdir(outDir, { recursive: true });

const tables = await discoverTables();
if (!tables.length) throw new Error("Discovered no tables — refusing to write an empty backup");

const counts: Record<string, number> = {};
for (const table of tables) {
  const rows = await fetchTable(table);
  counts[table.name] = rows.length;
  await writeFile(`${outDir}/${table.name}.json`, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${table.name.padEnd(28)} ${rows.length} row(s)`);
}

const manifest = {
  generated_at: new Date().toISOString(),
  supabase_host: new URL(SUPABASE_URL).host,
  table_count: tables.length,
  total_rows: Object.values(counts).reduce((a, b) => a + b, 0),
  rows_by_table: counts,
};
await writeFile(`${outDir}/_manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${manifest.table_count} table(s), ${manifest.total_rows} row(s) -> ${outDir}/`);
