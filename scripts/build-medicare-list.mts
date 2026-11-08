// Rebuilds data/medicare/assignment.bin from CMS's official
// "Doctors and Clinicians National Downloadable File" (dataset mj5m-pzi6).
//
//   npm run medicare:refresh              # download the latest release from CMS
//   npm run medicare:refresh -- file.csv YYYY-MM-DD   # use a file you downloaded
//
// The ~850 MB CSV is streamed, never saved. Only NPI and ind_assgn are kept.
// CMS updates the file monthly; re-run this, commit the .bin, and deploy.
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { parse } from "csv-parse";
import { encodeMedicareList, MEDICARE_LIST_PATH } from "../lib/medicareList";

const HEADERS = { "User-Agent": "Mozilla/5.0 InsureBased provider lookup (public data)", Accept: "application/json" };
const DATASET = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/mj5m-pzi6?show-reference-ids=false";

async function source(): Promise<{ stream: NodeJS.ReadableStream; sourceDate: string; label: string }> {
  const [file, date] = process.argv.slice(2);
  if (file) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Pass the CMS release date: npm run medicare:refresh -- file.csv YYYY-MM-DD");
    return { stream: createReadStream(file), sourceDate: date, label: file };
  }
  const meta = await (await fetch(DATASET, { headers: HEADERS })).json();
  const url: string | undefined = meta.distribution?.[0]?.downloadURL ?? meta.distribution?.[0]?.data?.downloadURL;
  const sourceDate: string = meta.released ?? meta.modified;
  if (!url || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate ?? "")) throw new Error("Could not find the CMS download link or release date");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok || !res.body) throw new Error(`CMS download failed: ${res.status}`);
  return { stream: Readable.fromWeb(res.body as never), sourceDate, label: url };
}

const { stream, sourceDate, label } = await source();
console.log(`Reading ${label} (CMS release ${sourceDate})…`);

// One NPI can have several rows (one per office); "Y" anywhere wins over "M",
// matching lib/medicare.ts. Anything else is left out (= unable to verify).
const best = new Map<number, "Y" | "M">();
let rows = 0;
const parser = stream.pipe(parse({ columns: true, bom: true, relax_column_count: true }));
for await (const row of parser as AsyncIterable<Record<string, string>>) {
  rows++;
  if (rows % 500000 === 0) console.log(`  ${rows.toLocaleString()} rows…`);
  const npi = (row.NPI ?? row.npi ?? "").trim();
  const value = (row.ind_assgn ?? "").trim().toUpperCase();
  if (!/^\d{10}$/.test(npi) || (value !== "Y" && value !== "M")) continue;
  const n = Number(npi);
  if (value === "Y" || !best.has(n)) best.set(n, value);
}
if (rows < 100000) throw new Error(`Only ${rows} rows read — refusing to replace the list with a partial file`);

const yes: number[] = [], maybe: number[] = [];
for (const [npi, value] of best) (value === "Y" ? yes : maybe).push(npi);
mkdirSync(path.dirname(MEDICARE_LIST_PATH), { recursive: true });
const buf = encodeMedicareList(sourceDate, yes, maybe);
writeFileSync(MEDICARE_LIST_PATH, buf);
console.log(`Done: ${rows.toLocaleString()} rows → ${yes.length.toLocaleString()} accept (Y), ${maybe.length.toLocaleString()} may accept (M).`);
console.log(`Wrote ${MEDICARE_LIST_PATH} (${(buf.length / 1048576).toFixed(1)} MB). Commit it and deploy.`);
