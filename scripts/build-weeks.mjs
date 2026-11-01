#!/usr/bin/env node
/**
 * Assemble one page per digest week and rebuild the site.
 *
 * Saturday catch-ups fold into that week. A band + album is listed
 * once inside that week. Spotify yes/no fields are replaced from
 * data/countries.json. A band missing from that file, or recorded there
 * as null, is shown as Unknown.
 *
 *   node scripts/build-weeks.mjs
 *
 * The rebuild writes the weekly pages and then the side lists
 * (J-Rod Core, Lenny's Stoner Corner, and Deutschrap) from their own data files.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  return sections.filter((section) => section.releases.length);
}

function releaseKey(release) {
  return `${release.band} ${release.album}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function readDigest(name) {
  return parseDigest(readFileSync(join(root, "digests", name), "utf8"));
}

function isSpotify(place) {
  return /^spotify\s+(yes|no)$/i.test(place || "");
}

function normalizePlace(place) {
  return place.trim().replace(/\s*\/\s*/g, "/");
}

function loadCountries() {
  return JSON.parse(readFileSync(join(root, "data", "countries.json"), "utf8"));
}

function loadLinks() {
  try {
    return JSON.parse(readFileSync(join(root, "data", "links.json"), "utf8"));
  } catch {
    return {};
  }
}

function countryFor(band, table) {
  if (table[band]) return table[band];
  const folded = Object.keys(table).find((key) => key.toLowerCase() === band.toLowerCase());
  if (folded && table[folded]) return table[folded];
  const parts = band
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const countries = parts.map((part) => countryFor(part, table));
    if (countries.every((country) => country && country !== "Unknown")) return countries.join("/");
  }
  return "Unknown";
}

function applyPlace(release, table) {
  const place = normalizePlace(release.place);
  if (!isSpotify(place)) return place;
  return countryFor(release.band, table);
}

function storedRelease(release, table, links) {
  const key = releaseKey(release);
  const extra = Object.prototype.hasOwnProperty.call(links, key) ? links[key] : null;
  const stored = {
    band: release.band,
    album: release.album,
    date: release.date,
    genre: release.genre,
    place: applyPlace(release, table),
    spotify: extra ? extra.spotify || null : release.spotify || null,
    bandcamp: extra ? extra.bandcamp || null : release.bandcamp || null,
  };
  const youtube = extra && extra.youtube ? extra.youtube : release.youtube || null;
  if (youtube) stored.youtube = youtube;
  return stored;
}

function takeRelease(seen, release, table, links) {
  const key = releaseKey(release);
  const next = storedRelease(release, table, links);
  const existing = seen.get(key);
  if (!existing) {
    seen.set(key, next);
    return { release: next, duplicate: false };
  }
  if (!existing.spotify && next.spotify) existing.spotify = next.spotify;
  if (!existing.bandcamp && next.bandcamp) existing.bandcamp = next.bandcamp;
  if (!existing.youtube && next.youtube) existing.youtube = next.youtube;
  if (isSpotify(existing.place) && !isSpotify(next.place)) existing.place = next.place;
  return { release: existing, duplicate: true };
}

function assemble(primaryName, extraNames, table, links, dropKeys) {
  const primary = readDigest(primaryName);
  const sections = primary.map((section) => ({ genre: section.genre, releases: [] }));
  const seen = new Map();
  const drop = new Set(dropKeys || []);
  let duplicates = 0;

  const absorb = (parsed) => {
    for (const section of parsed) {
      let target = sections.find((item) => item.genre.toLowerCase() === section.genre.toLowerCase());
      if (!target) {
        target = { genre: section.genre, releases: [] };
        sections.push(target);
      }
      for (const release of section.releases) {
        if (drop.has(releaseKey(release))) continue;
        const taken = takeRelease(seen, release, table, links);
        if (taken.duplicate) {
          duplicates += 1;
          continue;
        }
        target.releases.push(taken.release);
      }
    }
  };

  absorb(primary);
  for (const name of extraNames) absorb(readDigest(name));
  return {
    sections: sections.filter((section) => section.releases.length),
    duplicates,
  };
}

const weeks = [
  {
    slug: "2026-09-18",
    title: "Week of Sep 12–18, 2026",
    sort: "2026-09-18",
    primary: "2026-09-19-links.txt",
    extra: [],
    sources: "",
  },
  {
    slug: "2026-09-24",
    title: "Week of Sep 19–25, 2026",
    sort: "2026-09-24",
    primary: "2026-09-25.txt",
    extra: ["2026-09-24.txt", "2026-09-26.txt"],
    sources:
      "Roundups: Heavy Blog Is Heavy, Metal Collision, Nine Circles, Heavy Music HQ, VM-Underground, The Razor's Edge, Metal Connect, Toilet ov Hell, Metal War.",
  },
  {
    slug: "2026-10-02",
    title: "Week of Sep 26–Oct 2, 2026",
    sort: "2026-10-02",
    primary: "2026-10-02.txt",
    extra: ["2026-10-03.txt"],
    sources:
      "Roundups: Metal Collision Week 40, Nine Circles Initial Descent (Sep 28–Oct 4), Heavy Music HQ, Heavy Blog Is Heavy, Metal Connect, Ghost Cult, VM-Underground, Metal Injection, Metal War.",
  },
  {
    slug: "2026-10-09",
    title: "Week of Oct 3–9, 2026",
    sort: "2026-10-09",
    primary: "2026-10-09.txt",
    extra: ["2026-10-10.txt"],
    sources:
      "Roundups: Heavy Blog Is Heavy, Metal Injection, Metal Collision Week 41, Nine Circles Initial Descent (Oct 5–11), Heavy Music HQ, VM-Underground, Toilet ov Hell, Metal Connect, The Razor's Edge, Ghost Cult, Angry Metal Guy, Metal Archives, Cutting Edge Metal, Metal War.",
  },
  {
    slug: "2026-10-16",
    title: "Week of Oct 10–16, 2026",
    sort: "2026-10-16",
    primary: "2026-10-16.txt",
    extra: ["2026-10-17.txt"],
    drop: ["thronehammer slay | kill | erase"],
    sources:
      "Roundups: Heavy Blog Is Heavy, Metal Injection, Metal Collision Week 42, Nine Circles Initial Descent (Oct 12–18), Metal War, Heavy Music HQ, KaosMetal, The Razor's Edge, Metal Archives, Angry Metal Guy, Cutting Edge Metal.",
  },
  {
    slug: "2026-10-23",
    title: "Week of Oct 18–23, 2026",
    sort: "2026-10-23",
    primary: "2026-10-23.txt",
    extra: ["2026-10-24.txt"],
    sources:
      "Roundups: Heavy Blog Is Heavy, Metal Injection, Nine Circles Initial Descent (Oct 19–25), Heavy Music HQ, Metal Connect, The Razor's Edge, Metal Collision, Metal Archives, VM-Underground, Metal War, Cutting Edge Metal, Metal Lair, Angry Metal Guy, Invisible Oranges.",
  },
];

const table = loadCountries();
const links = loadLinks();
const catalog = {
  weeks: weeks.map((week) => {
    const built = assemble(week.primary, week.extra, table, links, week.drop);
    const count = built.sections.reduce((sum, section) => sum + section.releases.length, 0);
    console.log(
      `${week.slug}: ${count} releases, ${built.duplicates} duplicates folded`
    );
    return {
      slug: week.slug,
      title: week.title,
      kind: "friday",
      sort: week.sort,
      blurb: `${count} releases · ${built.sections.map((section) => section.genre.toLowerCase()).join(", ")}`,
      sources: week.sources,
      sections: built.sections,
    };
  }),
};

writeFileSync(join(root, "data", "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");

const rebuilt = spawnSync(process.execPath, ["scripts/add-week.mjs", "--rebuild"], {
  cwd: root,
  stdio: "inherit",
});
if (rebuilt.status !== 0) process.exit(rebuilt.status || 1);

const special = spawnSync(process.execPath, ["scripts/build-special.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (special.status !== 0) process.exit(special.status || 1);
