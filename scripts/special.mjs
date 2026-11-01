/**
 * Side lists for J-Rod Core, Lenny's Stoner Corner, and Deutschrap.
 * Stored apart from data/catalog.json, one object per week slug.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  attributions,
  escapeHtml,
  familiesFor,
  familiesIn,
  genreNav,
  navRow,
  pageShell,
  renderOutlinks,
  unique,
} from "./chrome.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "data", "catalog.json");

export const LISTS = [
  {
    id: "jrod",
    key: "jrod",
    file: "special-jrod.json",
    page: "jrod-core.html",
    title: "J-Rod Core",
    tagline: "Deathcore picks for J-Rod.",
    description: "Deathcore for J-Rod: breakdowns, slams, and the heavy stuff.",
  },
  {
    id: "lenny",
    key: "lenny",
    file: "special-lenny.json",
    page: "lennys-stoner-corner.html",
    title: "Lenny's Stoner Corner",
    tagline: "Thick fuzz, slow riffs, and doom for Lenny.",
    description: "Stoner rock, stoner metal, and doom for Lenny.",
  },
  {
    id: "deutschrap",
    key: "deutschrap",
    file: "special-deutschrap.json",
    page: "deutschrap.html",
    title: "Deutschrap",
    tagline: "German hip-hop picks, straight from the playlist.",
    description: "German hip-hop picks, straight from the playlist.",
  },
];

export function listPath(list) {
  return join(root, "data", list.file);
}

export function entryKey(entry) {
  return `${entry.band} ${entry.album}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function sortKey(value) {
  return String(value || "").replace(/^[^0-9A-Za-z\u0400-\u04FF]+/, "");
}

export function compareEntries(a, b) {
  const band = sortKey(a.band).localeCompare(sortKey(b.band), "en", { sensitivity: "base" });
  if (band) return band;
  return sortKey(a.album).localeCompare(sortKey(b.album), "en", { sensitivity: "base" });
}

function canonicalYoutube(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (/^[\w-]{6,}$/.test(id)) return `https://www.youtube.com/watch?v=${id}`;
    return null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const query = parsed.searchParams.get("v");
    if (query && /^[\w-]{6,}$/.test(query)) return `https://www.youtube.com/watch?v=${query}`;
    const shorts = parsed.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/);
    if (shorts) return `https://www.youtube.com/watch?v=${shorts[1]}`;
  }
  return null;
}

export function cleanUrl(url, kind) {
  if (url == null) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (kind === "spotify" && /^https:\/\/open\.spotify\.com\/(?:album|track)\/[A-Za-z0-9]+\/?$/.test(value)) {
    return value.replace(/\/$/, "");
  }
  if (kind === "bandcamp" && /^https:\/\/[a-z0-9.-]+\.bandcamp\.com\/album\/[^?#\s]+$/i.test(value)) return value;
  if (kind === "youtube") return canonicalYoutube(value) || undefined;
  return undefined;
}

const sourceNote = /\s*\([^)]*(?:Bandcamp|Metal Injection|\bMA\b|Metal Archives|archive|artist tags|per MA)[^)]*\)/gi;

export function publicGenre(genre) {
  return String(genre || "")
    .replace(sourceNote, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([;/])/g, " $1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[;/]\s*/, "")
    .replace(/\s*[;/]\s*$/, "")
    .trim();
}

export function normalizeEntry(raw) {
  const band = String(raw.band || raw.artist || "").trim();
  const album = String(raw.album || raw.title || "").trim();
  if (!band || !album) return null;
  const spotify = cleanUrl(raw.spotify, "spotify");
  const bandcamp = cleanUrl(raw.bandcamp, "bandcamp");
  const youtube = cleanUrl(raw.youtube, "youtube");
  return {
    band,
    album,
    date: String(raw.date || "").trim(),
    genre: publicGenre(raw.genre),
    country: String(raw.country || "").trim() || "Unknown",
    spotify: spotify || null,
    youtube: youtube || null,
    bandcamp: bandcamp || null,
    spotifyRejected: spotify === undefined,
    youtubeRejected: youtube === undefined,
    bandcampRejected: bandcamp === undefined,
  };
}

export function readList(list) {
  try {
    const data = JSON.parse(readFileSync(listPath(list), "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`${list.file} must be an object keyed by week slug`);
    }
    return data;
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

export function writeList(list, data) {
  const slugs = Object.keys(data).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const ordered = {};
  for (const slug of slugs) {
    const week = data[slug] || {};
    const releases = [...(week.releases || [])].sort(compareEntries).map((release) => ({
      band: release.band,
      album: release.album,
      date: release.date,
      genre: publicGenre(release.genre),
      country: release.country,
      spotify: release.spotify || null,
      youtube: release.youtube || null,
      bandcamp: release.bandcamp || null,
    }));
    const stored = { releases };
    if (week.title) stored.title = week.title;
    ordered[slug] = stored;
  }
  writeFileSync(listPath(list), JSON.stringify(ordered, null, 2) + "\n");
}

function readCatalogWeeks() {
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    return Array.isArray(catalog.weeks) ? catalog.weeks : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function weekTitle(slug, week, titles) {
  if (titles[slug]) return titles[slug];
  if (week && week.title) return String(week.title);
  throw new Error(
    `No week label for ${slug}. Add that week to the catalog, or set "title" on that week in the side-list file.`
  );
}

function renderEntry(release) {
  const album = `<span class="album">${escapeHtml(release.album)}</span>`;
  return `<li class="rel"><span class="band">${escapeHtml(release.band)}</span><span class="sep"> - </span>${album}<span class="sep"> - </span><span class="date">${escapeHtml(release.date)}</span><span class="sep"> - </span><span class="style">${escapeHtml(publicGenre(release.genre))}</span><span class="sep"> - </span><span class="place">${escapeHtml(release.country)}</span>${renderOutlinks(release)}</li>`;
}

function renderListPage(list, data, families) {
  const titles = Object.fromEntries(readCatalogWeeks().map((week) => [week.slug, week.title]));
  const slugs = Object.keys(data).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const weeks = slugs
    .map((slug) => {
      const week = data[slug] || {};
      const releases = [...(week.releases || [])].sort(compareEntries);
      return { slug, title: weekTitle(slug, week, titles), releases };
    })
    .filter((week) => week.releases.length);
  const sections = weeks
    .map((week) => {
      const items = week.releases.map(renderEntry).join("\n");
      return `<section class="special-week" id="week-${escapeHtml(week.slug)}">
  <h2>${escapeHtml(week.title)}</h2>
  <p class="section-count">${week.releases.length} release${week.releases.length === 1 ? "" : "s"}</p>
  <ul class="releases">
${items}
  </ul>
</section>`;
    })
    .join("\n");
  const body = `<header class="mast">
  <p class="home-row">
    <a class="wordmark" href="index.html">Extreme Metal Release Report</a>
    <a class="back" href="index.html">← All weeks</a>
  </p>
  <h1 class="side-title">${escapeHtml(list.title)}</h1>
</header>
${navRow(genreNav("index.html", families), "", list.id)}
<p class="lede">${escapeHtml(list.tagline)}</p>
<main id="content">
  ${sections || `<p class="empty">No releases on this list yet.</p>`}
</main>
${attributions(`<a href="index.html">All weeks</a>`)}`;
  return pageShell({
    title: `${list.title} · BT's Extreme Metal Release Report`,
    description: list.description,
    depth: 0,
    body,
  });
}

export function catalogFamilies(weeks) {
  const annotated = weeks.map((week) => {
    const families = unique(
      (week.sections || []).flatMap((section) =>
        (section.releases || []).flatMap((release) => familiesFor(section.genre, release.genre))
      )
    );
    return { families };
  });
  return familiesIn(annotated);
}

export function writeSpecialPages() {
  const families = catalogFamilies(readCatalogWeeks());
  const counts = [];
  for (const list of LISTS) {
    const data = readList(list);
    writeFileSync(join(root, list.page), renderListPage(list, data, families));
    const total = Object.values(data).reduce((sum, week) => sum + ((week && week.releases) || []).length, 0);
    counts.push(`${list.title}: ${total}`);
  }
  console.log(`Rebuilt side lists (${counts.join("; ")}).`);
}

/**
 * Merge one compact payload into both side lists for a single week slug.
 * Incoming entries whose `week` is set to something else are skipped.
 * A repeated band + album keeps its row and fills a link that was null.
 */
export function mergeSpecial(slug, payload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) {
    throw new Error(`Week slug must look like 2026-10-23, got ${slug}`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("JSON file must be an object with jrod, lenny, and deutschrap arrays");
  }
  const summary = [];
  let matched = 0;
  for (const list of LISTS) {
    if (!Object.prototype.hasOwnProperty.call(payload, list.key)) {
      summary.push({ list: list.id, added: 0, updated: 0, skipped: 0, unchanged: 0 });
      continue;
    }
    const incoming = payload[list.key];
    if (!Array.isArray(incoming)) throw new Error(`${list.key} must be an array`);
    const data = readList(list);
    const week = data[slug] && typeof data[slug] === "object" ? data[slug] : { releases: [] };
    const releases = [...(week.releases || [])];
    const seen = new Map(releases.map((release) => [entryKey(release), release]));
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let unchanged = 0;
    for (const raw of incoming) {
      if (raw && raw.week && raw.week !== slug) {
        skipped += 1;
        continue;
      }
      const entry = normalizeEntry(raw || {});
      if (!entry) {
        console.error(`Skipped a ${list.title} row with no band or album`);
        continue;
      }
      const label = `${entry.band} - ${entry.album}`;
      if (entry.spotifyRejected) console.error(`Dropped a Spotify URL that is not an album or track page: ${label}`);
      if (entry.youtubeRejected) console.error(`Dropped a YouTube URL that is not a video page: ${label}`);
      if (entry.bandcampRejected) console.error(`Dropped a Bandcamp URL that is not an album page: ${label}`);
      delete entry.spotifyRejected;
      delete entry.youtubeRejected;
      delete entry.bandcampRejected;
      matched += 1;
      const existing = seen.get(entryKey(entry));
      if (existing) {
        let changed = false;
        if (!existing.spotify && entry.spotify) {
          existing.spotify = entry.spotify;
          changed = true;
        }
        if (!existing.youtube && entry.youtube) {
          existing.youtube = entry.youtube;
          changed = true;
        }
        if (!existing.bandcamp && entry.bandcamp) {
          existing.bandcamp = entry.bandcamp;
          changed = true;
        }
        if (changed) updated += 1;
        else unchanged += 1;
        continue;
      }
      seen.set(entryKey(entry), entry);
      releases.push(entry);
      added += 1;
    }
    data[slug] = { ...week, releases };
    writeList(list, data);
    summary.push({ list: list.id, added, updated, skipped, unchanged });
  }
  if (!matched) throw new Error(`No ${slug} entries found in that JSON file`);
  return summary;
}
