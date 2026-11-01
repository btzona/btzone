#!/usr/bin/env node
/** Print the deduped week releases as JSON. Used by the link lookup. */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRelease } from "./release-line.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseDigest(text) {
  const sections = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^[-–—]{3,}$/.test(line) || /^sources:/i.test(line)) continue;
    const genre = line.match(/^>>\s*(.+?)\s*<<$/);
    if (genre) {
      current = { genre: genre[1].trim(), releases: [] };
      sections.push(current);
      continue;
    }
    const release = parseRelease(line);
    if (!release) continue;
    delete release.spotifyConflict;
    delete release.bandcampConflict;
    delete release.youtubeConflict;
    if (!release.youtube) delete release.youtube;
    if (!current) {
      current = { genre: "RELEASES", releases: [] };
      sections.push(current);
    }
    current.releases.push(release);
  }
  return sections;
}

function keyOf(release) {
  return `${release.band} ${release.album}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function absorb(seen, sections, drop) {
  for (const section of sections) {
    for (const release of section.releases) {
      const key = keyOf(release);
      if (drop.has(key)) continue;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, {
          key,
          band: release.band,
          album: release.album,
          spotify: release.spotify,
          bandcamp: release.bandcamp,
        });
        continue;
      }
      if (!existing.spotify && release.spotify) existing.spotify = release.spotify;
      if (!existing.bandcamp && release.bandcamp) existing.bandcamp = release.bandcamp;
    }
  }
}

const plans = [
  ["2026-09-19-links.txt"],
  ["2026-09-25.txt", "2026-09-24.txt", "2026-09-26.txt"],
  ["2026-10-02.txt", "2026-10-03.txt"],
  ["2026-10-09.txt", "2026-10-10.txt"],
  ["2026-10-16.txt", "2026-10-17.txt"],
  ["2026-10-23.txt"],
];
const drop = new Set(["thronehammer slay | kill | erase"]);
const seen = new Map();
for (const names of plans) {
  for (const name of names) {
    absorb(seen, parseDigest(readFileSync(join(root, "digests", name), "utf8")), drop);
  }
}
process.stdout.write(JSON.stringify([...seen.values()], null, 2) + "\n");
