// Compact, bundled copy of CMS's Original Medicare assignment data
// (Doctors and Clinicians National Downloadable File, field `ind_assgn`).
// CMS's live API blocks requests from cloud hosts like Vercel and takes
// 5–10s when it works, so the site answers from this file instead.
// Build/refresh it with `npm run medicare:refresh` (see docs/DATA_PIPELINE.md).
//
// File layout (little-endian):
//   0  "MDCR"            magic
//   4  uint32            format version (1)
//   8  10 ASCII bytes    CMS release date, YYYY-MM-DD
//   18 2 bytes           padding
//   20 uint32            count of "Y" NPIs
//   24 uint32            count of "M" NPIs
//   28 uint32[countY]    sorted NPIs that accept assignment (Y)
//   .. uint32[countM]    sorted NPIs that may accept assignment (M)
// NPIs are 10 digits below 2^32, so each fits in a uint32.
import { readFileSync } from "node:fs";
import path from "node:path";

export const MEDICARE_LIST_PATH = path.join(process.cwd(), "data", "medicare", "assignment.bin");
const MAGIC = "MDCR";
const HEADER = 28;

export type MedicareList = { sourceDate: string; yes: Uint32Array; maybe: Uint32Array };

export function encodeMedicareList(sourceDate: string, yes: Iterable<number>, maybe: Iterable<number>): Buffer {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) throw new Error("sourceDate must be YYYY-MM-DD");
  const y = Uint32Array.from(yes).sort();
  const m = Uint32Array.from(maybe).sort();
  const buf = Buffer.alloc(HEADER + (y.length + m.length) * 4);
  buf.write(MAGIC, 0, "ascii");
  buf.writeUInt32LE(1, 4);
  buf.write(sourceDate, 8, "ascii");
  buf.writeUInt32LE(y.length, 20);
  buf.writeUInt32LE(m.length, 24);
  y.forEach((npi, i) => buf.writeUInt32LE(npi, HEADER + i * 4));
  m.forEach((npi, i) => buf.writeUInt32LE(npi, HEADER + (y.length + i) * 4));
  return buf;
}

export function decodeMedicareList(buf: Buffer): MedicareList {
  if (buf.length < HEADER || buf.toString("ascii", 0, 4) !== MAGIC || buf.readUInt32LE(4) !== 1) {
    throw new Error("Not a Medicare assignment list");
  }
  const sourceDate = buf.toString("ascii", 8, 18);
  const countY = buf.readUInt32LE(20);
  const countM = buf.readUInt32LE(24);
  if (buf.length !== HEADER + (countY + countM) * 4) throw new Error("Medicare assignment list is truncated");
  // Copy into aligned arrays (Buffer offsets aren't guaranteed 4-byte aligned).
  const yes = new Uint32Array(countY);
  const maybe = new Uint32Array(countM);
  for (let i = 0; i < countY; i++) yes[i] = buf.readUInt32LE(HEADER + i * 4);
  for (let i = 0; i < countM; i++) maybe[i] = buf.readUInt32LE(HEADER + (countY + i) * 4);
  return { sourceDate, yes, maybe };
}

function has(sorted: Uint32Array, value: number): boolean {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] === value) return true;
    if (sorted[mid] < value) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

export function lookupAssignment(list: MedicareList, npi: string): "Y" | "M" | null {
  if (!/^\d{10}$/.test(npi)) return null;
  const n = Number(npi);
  if (has(list.yes, n)) return "Y";
  if (has(list.maybe, n)) return "M";
  return null;
}

let loaded: MedicareList | null | undefined;

// Loads the bundled list once per server instance. Returns null when the
// file is missing or unreadable, so callers can fall back to the live API.
export function bundledMedicareList(): MedicareList | null {
  if (loaded !== undefined) return loaded;
  try { loaded = decodeMedicareList(readFileSync(MEDICARE_LIST_PATH)); }
  catch { loaded = null; }
  return loaded;
}
