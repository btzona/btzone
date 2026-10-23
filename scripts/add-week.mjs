#!/usr/bin/env node
/**
 * Add one Extreme Metal Release Report week and rebuild the static site.
 *
 *   node scripts/add-week.mjs digests/2026-10-23.txt \
 *     --slug 2026-10-23 \
 *     --title "Week of Oct 18–23, 2026" \
 *     --kind friday
 *
 *   node scripts/add-week.mjs --rebuild
 *
 * Digest format: genre stamps on their own line (`>> BLACK METAL <<`),
 * then one release per line:
 *
 *   Band - Album - MM/DD - genre - Country
 *   Band - Album <https://example.com/album> - MM/DD - genre - Country
 *   Band - Album - MM/DD - genre - Country | https://example.com/album
 *
 * A line that starts with `Sources:` is kept as the week's source note.
 * `--kind` is `friday`, `saturday`, or `midweek`.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "data", "catalog.json");

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      i++;
    }
  } else positional.push(arg);
}

function readCatalog() {
  try {
    return JSON.parse(readFileSync(catalogPath, "utf8"));
  } catch {
    return { weeks: [] };
  }
}

function cleanUrl(raw) {
  if (!raw) return null;
  let url = raw.trim().replace(/[>,.)]+$/, "");
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.google.com" && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("q");
      if (target) url = target;
    }
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function parseRelease(line) {
  let url = null;
  let work = line.trim();
  const angle = work.match(/<((?:https?:\/\/)[^>]+)>/);
  if (angle) {
    url = cleanUrl(angle[1]);
    work = work.replace(angle[0], " ").replace(/\s+/g, " ").trim();
  }
  const trail = work.match(/\s+\|\s+(https?:\/\/\S+)\s*$/);
  if (trail) {
    url = url || cleanUrl(trail[1]);
    work = work.slice(0, trail.index).trim();
  }
  const parts = work.split(" - ");
  if (parts.length < 4) return null;
  const place = parts.pop().trim();
  const genre = parts.pop().trim();
  const date = parts.pop().trim();
  if (!/^\d{1,2}\/\d{1,2}/.test(date)) return null;
  const band = parts.shift().trim();
  const album = parts.join(" - ").trim();
  if (!band || !album) return null;
  return { band, album, date, genre, place, url };
}

function parseDigest(text) {
  const sections = [];
  let current = null;
  const sources = [];
  let inSources = false;
  const warnings = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^[-–—]{3,}$/.test(line)) continue;
    if (/^sources:/i.test(line)) {
      inSources = true;
      sources.push(line.replace(/^sources:\s*/i, ""));
      continue;
    }
    if (inSources) {
      sources.push(line);
      continue;
    }
    const genre = line.match(/^>>\s*(.+?)\s*<<$/);
    if (genre) {
      current = { genre: genre[1].trim(), releases: [] };
      sections.push(current);
      continue;
    }
    const release = parseRelease(line);
    if (release) {
      if (!current) {
        current = { genre: "RELEASES", releases: [] };
        sections.push(current);
      }
      current.releases.push(release);
      continue;
    }
    if (/\d{1,2}\/\d{1,2}/.test(line) && line.includes(" - ")) {
      warnings.push(line.slice(0, 160));
    }
  }

  return {
    sections: sections.filter((section) => section.releases.length),
    sources: sources.join(" ").replace(/\s+/g, " ").trim(),
    warnings,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function placeLabel(place) {
  if (/^spotify\s+(yes|no)$/i.test(place)) {
    return `Spotify: ${place.split(/\s+/).pop().toLowerCase()}`;
  }
  return place;
}

function countReleases(week) {
  return week.sections.reduce((sum, section) => sum + section.releases.length, 0);
}

function kindLabel(kind) {
  if (kind === "saturday") return "Saturday catch-up";
  if (kind === "midweek") return "Mid-week";
  return "Friday";
}

function renderRelease(release) {
  const album = release.url
    ? `<a class="album" href="${escapeHtml(release.url)}" rel="noopener">${escapeHtml(release.album)}</a>`
    : `<span class="album">${escapeHtml(release.album)}</span>`;
  const text = [release.band, release.album, release.date, release.genre, release.place]
    .join(" ")
    .toLowerCase();
  return `<li class="rel" data-text="${escapeHtml(text)}"><span class="band">${escapeHtml(release.band)}</span><span class="sep"> - </span>${album}<span class="sep"> - </span><span class="date">${escapeHtml(release.date)}</span><span class="sep"> - </span><span class="style">${escapeHtml(release.genre)}</span><span class="sep"> - </span><span class="place">${escapeHtml(placeLabel(release.place))}</span></li>`;
}

function pageShell({ title, description, depth, body }) {
  const prefix = depth ? "../" : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#070708">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${prefix}css/style.css">
</head>
<body>
<a class="skip" href="#content">Skip to the releases</a>
${body}
<script src="${prefix}js/site.js"></script>
</body>
</html>
`;
}

const credit = `Schammasch at Eindhoven Metal Meeting, 2016. Photo by Grywnn, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, via <a href="https://commons.wikimedia.org/wiki/File:Schammasch_@_Eindhoven_Metal_Meeting_2016_054.jpg">Wikimedia Commons</a>. Site code is MIT. The photograph stays under CC BY-SA 4.0.`;

function renderIndex(weeks) {
  const cards = weeks
    .map((week) => {
      const count = countReleases(week);
      const genres = week.sections.map((section) => section.genre).join(" · ");
      return `<li>
        <a class="week-card" href="weeks/${escapeHtml(week.slug)}.html">
          <span class="kind">${escapeHtml(kindLabel(week.kind))}</span>
          <span class="when">${escapeHtml(week.title)}</span>
          <span class="count">${count} release${count === 1 ? "" : "s"}</span>
          <span class="genres">${escapeHtml(genres)}</span>
        </a>
      </li>`;
    })
    .join("\n");

  const body = `<header class="mast">
  <p class="kicker">Public archive</p>
  <h1>BT's Extreme Metal Release Report</h1>
  <p class="lede">Week-over-week digests of black metal, death metal, grind, crust, sludge, and doom. Newest week first. Album titles link out when the digest had a page.</p>
</header>
<figure class="banner">
  <img src="img/schammasch-eindhoven-2016.jpg" alt="Schammasch performing under red and blue stage lights at Eindhoven Metal Meeting, 2016" width="1280" height="1920">
  <figcaption>${credit}</figcaption>
</figure>
<main id="content">
  <h2>Weeks</h2>
  <ol class="weeks">
${cards}
  </ol>
</main>
<footer>
  <p>Reports compiled by Bryan Timmins. This page is a reading copy of those digests, not a label or a store.</p>
  <p>${credit}</p>
</footer>`;

  return pageShell({
    title: "BT's Extreme Metal Release Report",
    description:
      "Week-over-week extreme metal release digests: black, death, grind, crust, sludge, and doom.",
    depth: 0,
    body,
  });
}

function renderWeek(week, weeks) {
  const index = weeks.findIndex((item) => item.slug === week.slug);
  const newer = index > 0 ? weeks[index - 1] : null;
  const older = index < weeks.length - 1 ? weeks[index + 1] : null;
  const count = countReleases(week);
  const nav = `<p class="crumb"><a href="../index.html">All weeks</a></p>
<nav class="pager" aria-label="Other weeks">
  ${newer ? `<a href="${escapeHtml(newer.slug)}.html">Newer · ${escapeHtml(newer.title)}</a>` : "<span></span>"}
  ${older ? `<a href="${escapeHtml(older.slug)}.html">Older · ${escapeHtml(older.title)}</a>` : "<span></span>"}
</nav>`;

  const sections = week.sections
    .map((section) => {
      const items = section.releases.map(renderRelease).join("\n");
      return `<section class="genre">
  <h2>&gt;&gt; ${escapeHtml(section.genre)} &lt;&lt;</h2>
  <p class="section-count">${section.releases.length} release${section.releases.length === 1 ? "" : "s"}</p>
  <ul class="releases">
${items}
  </ul>
</section>`;
    })
    .join("\n");

  const sources = week.sources
    ? `<footer class="sources"><h2>Sources</h2><p>${escapeHtml(week.sources)}</p></footer>`
    : "";

  const body = `<header class="mast">
  <p class="kicker">${escapeHtml(kindLabel(week.kind))}</p>
  <h1>${escapeHtml(week.title)}</h1>
  <p class="lede">${count} releases. Each line is Band - Album - date - genre - country. Early notes that tracked Spotify instead of a country still say so.</p>
</header>
<main id="content">
  ${nav}
  <form class="finder" role="search">
    <label for="q">Find a band, album, or genre</label>
    <input id="q" name="q" type="search" placeholder="Casket Dweller, sludge, Finland" autocomplete="off">
  </form>
  ${sections}
  ${sources}
  ${nav}
</main>
<footer>
  <p><a href="../index.html">All weeks</a></p>
  <p>${credit}</p>
</footer>`;

  return pageShell({
    title: `${week.title} · BT's Extreme Metal Release Report`,
    description: `${week.title}. ${count} extreme metal releases.`,
    depth: 1,
    body,
  });
}

function renderAll(catalog) {
  const weeks = [...catalog.weeks].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort < b.sort ? 1 : -1;
    return 0;
  });
  mkdirSync(join(root, "weeks"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(catalogPath, JSON.stringify({ weeks }, null, 2) + "\n");
  writeFileSync(join(root, "index.html"), renderIndex(weeks));
  for (const week of weeks) {
    writeFileSync(join(root, "weeks", `${week.slug}.html`), renderWeek(week, weeks));
  }
  console.log(
    `Rebuilt ${weeks.length} week pages, ${weeks.reduce((sum, week) => sum + countReleases(week), 0)} releases.`
  );
}

if (flags.rebuild) {
  renderAll(readCatalog());
} else {
  const digestPath = positional[0];
  if (!digestPath || !flags.slug || !flags.title) {
    console.error(
      "Usage: node scripts/add-week.mjs <digest.txt> --slug 2026-10-23 --title \"Week of Oct 18–23, 2026\" --kind friday [--blurb \"...\"] [--sort 2026-10-23]"
    );
    process.exit(1);
  }
  const kind = flags.kind || "friday";
  if (!["friday", "saturday", "midweek"].includes(kind)) {
    console.error("--kind must be friday, saturday, or midweek");
    process.exit(1);
  }
  const parsed = parseDigest(readFileSync(resolve(digestPath), "utf8"));
  if (!parsed.sections.length) {
    console.error(`No releases parsed from ${digestPath}`);
    process.exit(1);
  }
  for (const warning of parsed.warnings) console.error(`Skipped unparsed line: ${warning}`);
  const count = parsed.sections.reduce((sum, section) => sum + section.releases.length, 0);
  const blurb =
    flags.blurb ||
    `${count} releases · ${parsed.sections.map((section) => section.genre.toLowerCase()).join(", ")}`;
  const week = {
    slug: flags.slug,
    title: flags.title,
    kind,
    sort: flags.sort || flags.slug,
    blurb,
    sources: parsed.sources,
    sections: parsed.sections,
  };
  const catalog = readCatalog();
  const existing = catalog.weeks.findIndex((item) => item.slug === week.slug);
  if (existing >= 0) catalog.weeks[existing] = week;
  else catalog.weeks.push(week);
  console.log(
    `${week.slug}: ${count} releases in ${parsed.sections.length} genre${parsed.sections.length === 1 ? "" : "s"}`
  );
  renderAll(catalog);
}
