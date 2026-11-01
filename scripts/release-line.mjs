/**
 * Shared digest line parser.
 *
 *   Band - Album - MM/DD - genre - Country
 *   Band - Album <https://artist.bandcamp.com/album/name> - MM/DD - genre - Country
 *   Band - Album - MM/DD - genre - Country | bandcamp: https://artist.bandcamp.com/album/name | spotify: https://open.spotify.com/album/id | youtube: https://www.youtube.com/watch?v=id
 *
 * Only an open.spotify.com album URL is stored as `spotify`. Only a
 * bandcamp.com /album/ URL is stored as `bandcamp`. A YouTube watch URL is
 * stored as `youtube` when one is present. Anything else is ignored.
 * Two different URLs for the same service on one line are dropped.
 */

export function cleanUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim().replace(/[>,.)]+$/, "");
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

export function classifyReleaseUrl(raw) {
  const cleaned = cleanUrl(raw);
  if (!cleaned) return null;
  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }
  parsed.search = "";
  parsed.hash = "";
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  if (host === "open.spotify.com") {
    const album = path.match(/\/album\/([A-Za-z0-9]+)/);
    if (!album) return null;
    return { kind: "spotify", url: `https://open.spotify.com/album/${album[1]}` };
  }
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) {
    if (!/^\/album\/[^/]+/.test(path)) return null;
    parsed.protocol = "https:";
    return { kind: "bandcamp", url: parsed.toString().replace(/\/$/, "") };
  }
  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const id = parsed.searchParams.get("v");
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: "youtube", url: `https://www.youtube.com/watch?v=${id}` };
    const shorts = path.match(/^\/(?:shorts|embed)\/([\w-]{6,})/);
    if (shorts) return { kind: "youtube", url: `https://www.youtube.com/watch?v=${shorts[1]}` };
    return null;
  }
  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0] || "";
    if (/^[\w-]{6,}$/.test(id)) return { kind: "youtube", url: `https://www.youtube.com/watch?v=${id}` };
    return null;
  }
  return null;
}

function remember(bucket, url) {
  if (!bucket.includes(url)) bucket.push(url);
}

export function linksFromUrls(rawUrls) {
  const spotify = [];
  const bandcamp = [];
  const youtube = [];
  for (const raw of rawUrls) {
    const classified = classifyReleaseUrl(raw);
    if (!classified) continue;
    const bucket = classified.kind === "spotify" ? spotify : classified.kind === "youtube" ? youtube : bandcamp;
    remember(bucket, classified.url);
  }
  return {
    spotify: spotify.length === 1 ? spotify[0] : null,
    bandcamp: bandcamp.length === 1 ? bandcamp[0] : null,
    youtube: youtube.length === 1 ? youtube[0] : null,
    spotifyConflict: spotify.length > 1,
    bandcampConflict: bandcamp.length > 1,
    youtubeConflict: youtube.length > 1,
  };
}

export function parseRelease(line) {
  const rawUrls = [];
  let work = line.trim();
  work = work.replace(/(?:<\s*)?(spotify|bandcamp|youtube)\s*:\s*(https?:\/\/[^>\s|]+)(?:\s*>)?/gi, (_all, _kind, url) => {
    rawUrls.push(url);
    return " ";
  });
  work = work.replace(/<((?:https?:\/\/)[^>]+)>/g, (_all, url) => {
    rawUrls.push(url);
    return " ";
  });
  work = work.replace(/\s+\|\s+(https?:\/\/\S+)/g, (_all, url) => {
    rawUrls.push(url);
    return " ";
  });
  work = work.replace(/\s+/g, " ").trim();
  // Labeled links are ` | bandcamp: URL | spotify: URL`. The labels are
  // removed above; the leftover separators are not part of the country.
  work = work.replace(/(?:\s*\|\s*)+$/, "").trim();
  const parts = work.split(" - ");
  if (parts.length < 4) return null;
  const place = parts.pop().trim();
  const genre = parts.pop().trim();
  const date = parts.pop().trim();
  if (!/^\d{1,2}\/\d{1,2}/.test(date)) return null;
  const band = parts.shift().trim();
  const album = parts.join(" - ").trim();
  if (!band || !album) return null;
  const links = linksFromUrls(rawUrls);
  return {
    band,
    album,
    date,
    genre,
    place,
    spotify: links.spotify,
    bandcamp: links.bandcamp,
    youtube: links.youtube,
    spotifyConflict: links.spotifyConflict,
    bandcampConflict: links.bandcampConflict,
    youtubeConflict: links.youtubeConflict,
  };
}
