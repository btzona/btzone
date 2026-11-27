#!/usr/bin/env node
/**
 * Replace the Jamaica Top 40 snapshot and rebuild the chart page.
 *
 *   node scripts/update-jamaica-top40.mjs path/to/jamaica-top40.json
 *
 * The JSON file is one chart: as_of (YYYY-MM-DD), updated_label (shown on
 * the page), source (kept in the data file), and tracks. Each track has
 * rank, artist, title, subgenre, spotify (a track or album URL or null),
 * and youtube (a video URL or null). This replaces
 * data/special-jamaica-top40.json. It does not merge into older weeks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHARTS, replaceChart, writeSpecialPages } from "./special.mjs";

const file = process.argv[2];
if (!file || file.startsWith("--")) {
  console.error("Usage: node scripts/update-jamaica-top40.mjs <json-file>");
  process.exit(1);
}

const chart = CHARTS.find((item) => item.id === "jamaica");
if (!chart) {
  console.error("Jamaica Top 40 is not configured");
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
  const saved = replaceChart(chart, payload);
  console.log(
    `${chart.title}: ${saved.tracks.length} track${saved.tracks.length === 1 ? "" : "s"} as of ${saved.updated_label} (${saved.as_of})`
  );
  writeSpecialPages();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
