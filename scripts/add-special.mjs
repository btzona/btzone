#!/usr/bin/env node
/**
 * Merge one week of side-list rows into J-Rod Core and Lenny's Stoner Corner,
 * then rebuild both pages.
 *
 *   node scripts/add-special.mjs 2026-10-23 digests/special-2026-10-23.json
 *
 * The JSON file is an object with `jrod` and `lenny` arrays. Each row has
 * band, album, date (MM/DD), genre, country, spotify (album URL or null),
 * and bandcamp (album URL or null). A `week` field is optional; rows tagged
 * with a different week are left for another run.
 *
 * A band + album already on that list is kept once. A null Spotify or
 * Bandcamp link is filled when the new row has one. Existing links are
 * not replaced. These rows are not added to data/catalog.json.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeSpecial, writeSpecialPages } from "./special.mjs";

const [slug, file] = process.argv.slice(2);
if (!slug || !file || slug.startsWith("--")) {
  console.error("Usage: node scripts/add-special.mjs <week-slug> <json-file>");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

try {
  const summary = mergeSpecial(slug, payload);
  for (const row of summary) {
    console.log(
      `${slug} ${row.list}: +${row.added} new, ${row.updated} link${row.updated === 1 ? "" : "s"} filled, ${row.unchanged} already listed, ${row.skipped} other-week row${row.skipped === 1 ? "" : "s"} skipped`
    );
  }
  writeSpecialPages();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
