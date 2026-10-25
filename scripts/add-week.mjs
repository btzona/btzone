#!/usr/bin/env node
/**
 * Add one Extreme Metal Release Report week and rebuild the static site.
 *
 *   node scripts/add-week.mjs digests/2026-10-23.txt \
 *     --slug 2026-10-23 \
 *     --title "Week of Oct 18–23, 2026" \
 *     --kind friday
 *
 *   node scripts/add-week.mjs digests/2026-10-10.txt \
 *     --slug 2026-10-09 \
 *     --title "Week of Oct 4–10, 2026" \
 *     --kind saturday
 *
 *   node scripts/add-week.mjs --rebuild
 *
 * `--rebuild` rewrites the index, every week page, and the side lists
 * (J-Rod Core and Lenny's Stoner Corner). The side lists are not part of
 * data/catalog.json. Their header cluster is the same one used here.
 *
 * `--kind saturday` folds that digest into the Friday (or mid-week) slug in
 * `--slug`. It does not create a Saturday page. Repeat releases already on
 * that week are dropped. `--retire 2026-10-10` deletes an old sibling slug.
 *
 * Digest format: genre stamps on their own line (`>> BLACK METAL <<`),
 * then one release per line:
 *
 *   Band - Album - MM/DD - genre - Country
 *   Band - Album <https://artist.bandcamp.com/album/name> - MM/DD - genre - Country
 *   Band - Album - MM/DD - genre - Country | bandcamp: https://artist.bandcamp.com/album/name | spotify: https://open.spotify.com/album/id
 *
 * Album titles are plain text. A Spotify album URL and a Bandcamp album URL
 * are stored separately and rendered as gold labels at the end of the line.
 * Other URLs are ignored. A line that starts with `Sources:` is the week's note.
 * `--kind` is `friday`, `saturday`, or `midweek`.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRelease } from "./release-line.mjs";
import {
  attributions,
  escapeHtml,
  familiesFor,
  familiesIn,
  genreNav,
  navRow,
  pageShell,
  renderOutlinks,
  sectionId,
  unique,
} from "./chrome.mjs";
import { writeSpecialPages } from "./special.mjs";

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
      if (release.spotifyConflict) warnings.push(`Conflicting Spotify URLs: ${line.slice(0, 160)}`);
      if (release.bandcampConflict) warnings.push(`Conflicting Bandcamp URLs: ${line.slice(0, 160)}`);
      delete release.spotifyConflict;
      delete release.bandcampConflict;
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

function placeLabel(place) {
  if (/^spotify\s+(yes|no)$/i.test(place)) return "Unknown";
  return place;
}

function countReleases(week) {
  return week.sections.reduce((sum, section) => sum + section.releases.length, 0);
}

function releaseKey(release) {
  return `${release.band} ${release.album}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeSections(baseSections, incomingSections) {
  const sections = baseSections.map((section) => ({
    genre: section.genre,
    releases: section.releases.map((release) => ({ ...release })),
  }));
  const seen = new Map();
  for (const section of sections) {
    for (const release of section.releases) seen.set(releaseKey(release), release);
  }
  let added = 0;
  let dupes = 0;
  for (const incoming of incomingSections) {
    let target = sections.find((section) => section.genre.toLowerCase() === incoming.genre.toLowerCase());
    if (!target) {
      target = { genre: incoming.genre, releases: [] };
      sections.push(target);
    }
    for (const release of incoming.releases) {
      const key = releaseKey(release);
      const existing = seen.get(key);
      if (existing) {
        dupes += 1;
        if (!existing.spotify && release.spotify) existing.spotify = release.spotify;
        if (!existing.bandcamp && release.bandcamp) existing.bandcamp = release.bandcamp;
        continue;
      }
      const copy = { ...release };
      seen.set(key, copy);
      target.releases.push(copy);
      added += 1;
    }
  }
  return {
    sections: sections.filter((section) => section.releases.length),
    added,
    dupes,
  };
}

function autoBlurb(week) {
  const count = countReleases(week);
  return `${count} releases · ${week.sections.map((section) => section.genre.toLowerCase()).join(", ")}`;
}

function retireSlugs(catalog) {
  if (!flags.retire) return;
  const drop = new Set(
    String(flags.retire)
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean)
  );
  catalog.weeks = catalog.weeks.filter((week) => !drop.has(week.slug));
}

function annotateWeek(week) {
  const sections = week.sections.map((section) => {
    const releases = section.releases.map((release) => ({
      ...release,
      families: familiesFor(section.genre, release.genre),
    }));
    return {
      ...section,
      id: sectionId(section.genre),
      families: unique(releases.flatMap((release) => release.families)),
      releases,
    };
  });
  return {
    ...week,
    families: unique(sections.flatMap((section) => section.families)),
    sections,
  };
}

function renderRelease(release) {
  const album = `<span class="album">${escapeHtml(release.album)}</span>`;
  const text = [release.band, release.album, release.date, release.genre, release.place]
    .join(" ")
    .toLowerCase();
  const families = (release.families || []).join(" ");
  return `<li class="rel" data-families="${escapeHtml(families)}" data-text="${escapeHtml(text)}"><span class="band">${escapeHtml(release.band)}</span><span class="sep"> - </span>${album}<span class="sep"> - </span><span class="date">${escapeHtml(release.date)}</span><span class="sep"> - </span><span class="style">${escapeHtml(release.genre)}</span><span class="sep"> - </span><span class="place">${escapeHtml(placeLabel(release.place))}</span>${renderOutlinks(release)}</li>`;
}

function renderIndex(weeks, families) {
  const cards = weeks
    .map((week) => {
      const count = countReleases(week);
      const genres = week.sections.map((section) => section.genre).join(" · ");
      const href = `weeks/${week.slug}.html`;
      return `<li class="week-item" data-families="${escapeHtml(week.families.join(" "))}">
        <a class="week-card" data-base="${escapeHtml(href)}" href="${escapeHtml(href)}">
          <span class="when">${escapeHtml(week.title)}</span>
          <span class="count">${count} release${count === 1 ? "" : "s"}</span>
          <span class="genres">${escapeHtml(genres)}</span>
        </a>
      </li>`;
    })
    .join("\n");

  const hits = weeks
    .flatMap((week) =>
      week.sections.flatMap((section) =>
        section.releases.map((release) => {
          const album = `<span class="album">${escapeHtml(release.album)}</span>`;
          const base = `weeks/${week.slug}.html#${section.id}`;
          return `<li class="rel hit" data-families="${escapeHtml(release.families.join(" "))}"><a class="jump" data-base="${escapeHtml(base)}" href="${escapeHtml(base)}">${escapeHtml(week.title)}</a><span class="sep"> · </span><span class="band">${escapeHtml(release.band)}</span><span class="sep"> - </span>${album}<span class="sep"> - </span><span class="date">${escapeHtml(release.date)}</span><span class="sep"> - </span><span class="style">${escapeHtml(release.genre)}</span><span class="sep"> - </span><span class="place">${escapeHtml(placeLabel(release.place))}</span>${renderOutlinks(release)}</li>`;
        })
      )
    )
    .join("\n");

  const body = `<header class="mast">
  <h1><a class="wordmark" href="index.html">Extreme Metal Release Report</a></h1>
</header>
${navRow(genreNav("index.html", families), "", null)}
<p class="lede">Week-over-week digests of black metal, death metal, grind, crust, sludge, and doom.</p>
<figure class="banner">
  <img src="img/schammasch-eindhoven-2016.jpg" alt="Schammasch performing under red and blue stage lights at Eindhoven Metal Meeting, 2016" width="1280" height="1920">
  <figcaption><a href="#attributions">Photo: Schammasch @ EMM 2016</a></figcaption>
</figure>
<main id="content">
  <h2 id="weeks-title">Weeks</h2>
  <p class="empty weeks-empty" hidden>No weeks in this genre.</p>
  <ol class="weeks">
${cards}
  </ol>
  <section id="browse" hidden>
    <h2 id="browse-title">Releases</h2>
    <p class="empty browse-empty" hidden>No releases in this genre.</p>
    <ul class="releases">
${hits}
    </ul>
  </section>
</main>
${attributions("Reports compiled by Bryan Timmins.")}`;

  return pageShell({
    title: "BT's Extreme Metal Release Report",
    description:
      "Week-over-week extreme metal release digests: black, death, grind, crust, sludge, and doom.",
    depth: 0,
    catalog: true,
    body,
  });
}

function dropFriday(text) {
  return String(text || "")
    .replace(/\bFriday\s+list\b/g, "List")
    .replace(/\bFriday\b/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function publicSourceText(text) {
  const cleaned = dropFriday(text);
  if (!cleaned) return "";
  const internal =
    /catch-up|mid-week|already on the|listed once|restored from|band's origin|single metal-band|dates, countries|not scrapeable|\bblocked\b|\bskipped\b|\bexcluded\b|bot[- ]|cloudflare|\bresend\b|spotify availability|out of window|off-genre|tracklist|not yet posted|not usefully|cross-checked|retrospectives|checked and skipped/i;
  const kept = cleaned
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !internal.test(sentence) && !/^list for\b/i.test(sentence) && !/^releases from\b/i.test(sentence));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function renderWeek(week, weeks, families) {
  const index = weeks.findIndex((item) => item.slug === week.slug);
  const newer = index > 0 ? weeks[index - 1] : null;
  const older = index < weeks.length - 1 ? weeks[index + 1] : null;
  const count = countReleases(week);
  const pager = `<nav class="pager" aria-label="Other weeks">
  ${newer ? `<a href="${escapeHtml(newer.slug)}.html">Newer · ${escapeHtml(newer.title)}</a>` : "<span></span>"}
  ${older ? `<a href="${escapeHtml(older.slug)}.html">Older · ${escapeHtml(older.title)}</a>` : "<span></span>"}
</nav>`;

  const sections = week.sections
    .map((section) => {
      const items = section.releases.map(renderRelease).join("\n");
      const headingFamilies = familiesFor(section.genre).join(" ");
      return `<section class="genre" id="${escapeHtml(section.id)}" data-families="${escapeHtml(section.families.join(" "))}" data-heading="${escapeHtml(headingFamilies)}">
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
  <p class="home-row">
    <a class="wordmark" href="../index.html">Extreme Metal Release Report</a>
    <a class="back" href="../index.html">← All weeks</a>
  </p>
  <h1>${escapeHtml(week.title)}</h1>
</header>
${navRow(genreNav(`${week.slug}.html`, families), "../", null)}
<p class="lede">${count} releases.</p>
<main id="content">
  ${pager}
  <form class="finder" role="search">
    <label for="q">Find a band, album, or genre</label>
    <input id="q" name="q" type="search" placeholder="Casket Dweller, sludge, Finland" autocomplete="off">
  </form>
  <p class="empty" hidden>No releases in this genre on this page.</p>
  ${sections}
  ${sources}
  ${pager}
</main>
${attributions(`<a href="../index.html">All weeks</a>`)}`;

  return pageShell({
    title: `${week.title} · BT's Extreme Metal Release Report`,
    description: `${week.title}. ${count} extreme metal releases.`,
    depth: 1,
    catalog: true,
    body,
  });
}

function renderAll(catalog) {
  for (const week of catalog.weeks) {
    if (week.sources) week.sources = publicSourceText(week.sources);
  }
  const weeks = [...catalog.weeks]
    .sort((a, b) => {
      if (a.sort !== b.sort) return a.sort < b.sort ? 1 : -1;
      return 0;
    })
    .map(annotateWeek);
  const families = familiesIn(weeks);
  const stored = weeks.map(({ families: _families, sections, ...week }) => ({
    ...week,
    sections: sections.map(({ id: _id, families: _sectionFamilies, releases, ...section }) => ({
      ...section,
      releases: releases.map(({ families: _releaseFamilies, ...release }) => release),
    })),
  }));
  mkdirSync(join(root, "weeks"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(catalogPath, JSON.stringify({ weeks: stored }, null, 2) + "\n");
  writeFileSync(join(root, "index.html"), renderIndex(weeks, families));
  const weeksDir = join(root, "weeks");
  const redirects = {
    "2026-09-26": "2026-09-24",
    "2026-10-03": "2026-10-02",
    "2026-10-10": "2026-10-09",
    "2026-10-17": "2026-10-16",
  };
  const keep = new Set([
    ...weeks.map((week) => `${week.slug}.html`),
    ...Object.keys(redirects).map((slug) => `${slug}.html`),
  ]);
  for (const name of readdirSync(weeksDir)) {
    if (name.endsWith(".html") && !keep.has(name)) unlinkSync(join(weeksDir, name));
  }
  for (const week of weeks) {
    writeFileSync(join(weeksDir, `${week.slug}.html`), renderWeek(week, weeks, families));
  }
  for (const [from, to] of Object.entries(redirects)) {
    const target = `${to}.html`;
    writeFileSync(
      join(weeksDir, `${from}.html`),
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<title>Moved · BT's Extreme Metal Release Report</title>
<meta name="description" content="This week lives on another page.">
<style>
  body { margin: 1.5rem; background: #070708; color: #f4f1ea; font: 16px/1.5 sans-serif; }
  a, a:link, a:visited, a:hover, a:active, a:focus { color: #d7d0c4; }
</style>
<script>location.replace(${JSON.stringify(target)})</script>
</head>
<body>
<p><a href="${target}">This week moved.</a></p>
</body>
</html>
`
    );
  }
  writeSpecialPages();
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
      "Usage: node scripts/add-week.mjs <digest.txt> --slug 2026-10-23 --title \"Week of Oct 18–23, 2026\" --kind friday|saturday|midweek [--blurb \"...\"] [--sort 2026-10-23] [--retire old-slug]"
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
  const catalog = readCatalog();

  if (kind === "saturday") {
    const target = catalog.weeks.find((item) => item.slug === flags.slug);
    if (!target && !flags.title) {
      console.error("--title is required when the Friday week does not exist yet");
      process.exit(1);
    }
    const merged = target
      ? mergeSections(target.sections, parsed.sections)
      : { sections: parsed.sections, added: parsed.sections.reduce((sum, section) => sum + section.releases.length, 0), dupes: 0 };
    const week = target || {
      slug: flags.slug,
      title: flags.title,
      kind: "friday",
      sort: flags.sort || flags.slug,
      blurb: "",
      sources: "",
      sections: [],
    };
    if (flags.title) week.title = flags.title;
    if (flags.sort) week.sort = flags.sort;
    week.sections = merged.sections;
    if (parsed.sources) {
      const incoming = publicSourceText(parsed.sources);
      if (incoming && !(week.sources || "").includes(incoming)) {
        week.sources = publicSourceText([week.sources, incoming].filter(Boolean).join(" "));
      }
    }
    week.blurb = flags.blurb || autoBlurb(week);
    if (!target) catalog.weeks.push(week);
    retireSlugs(catalog);
    console.log(
      `${week.slug}: folded Saturday digest, +${merged.added} release${merged.added === 1 ? "" : "s"}, ${merged.dupes} already listed`
    );
    renderAll(catalog);
  } else {
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
      sources: publicSourceText(parsed.sources),
      sections: parsed.sections,
    };
    const existing = catalog.weeks.findIndex((item) => item.slug === week.slug);
    if (existing >= 0) catalog.weeks[existing] = week;
    else catalog.weeks.push(week);
    retireSlugs(catalog);
    console.log(
      `${week.slug}: ${count} releases in ${parsed.sections.length} genre${parsed.sections.length === 1 ? "" : "s"}`
    );
    renderAll(catalog);
  }
}
