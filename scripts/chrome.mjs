/**
 * Shared page chrome for the weekly archive and the side lists.
 * Week pages, the index, and the buddy pages all use this header,
 * the gold out-links, and the Listen player.
 */

export const FAMILIES = [
  { id: "black", label: "Black", test: /black/i },
  { id: "death", label: "Death", test: /death|slam/i },
  { id: "grind", label: "Grind · Crust", test: /grind|crust/i },
  { id: "sludge", label: "Sludge · Doom", test: /sludge|doom|funeral|stoner/i },
  { id: "experimental", label: "Experimental", test: /experimental|noise|industrial|avant|post-punk|post-rock|drone/i },
];

const BUDDIES = [
  { id: "jrod", href: "jrod-core.html", label: "J-Rod Core", glyph: "skull" },
  { id: "lenny", href: "lennys-stoner-corner.html", label: "Lenny's Stoner Corner", glyph: "amp" },
];

const skull = `<svg class="buddy-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M8 1.15C5.25 1.15 3.05 3.2 3.05 5.75c0 1.48.68 2.72 1.55 3.42V11c0 .5.4.9.9.9h.85v1.35c0 .38.32.7.7.7h1.9c.38 0 .7-.32.7-.7V11.9h.85c.5 0 .9-.4.9-.9V9.17c.87-.7 1.55-1.94 1.55-3.42 0-2.55-2.2-4.6-4.95-4.6zM6.15 5.45a1.12 1.12 0 1 0 .02 2.24 1.12 1.12 0 0 0-.02-2.24zm3.7 0a1.12 1.12 0 1 0 .02 2.24 1.12 1.12 0 0 0-.02-2.24zM7.15 9.05h1.7v.8h-1.7v-.8z"/></svg>`;

const amp = `<svg class="buddy-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M2.35 2.15h11.3v8.15H2.35V2.15zm5.65 1.45a2.2 2.2 0 1 0 .02 4.4 2.2 2.2 0 0 0-.02-4.4zM3.45 11.35h1.45V13.7H3.45v-2.35zm7.65 0h1.45V13.7H11.1v-2.35z"/></svg>`;

const glyphs = { skull, amp };

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function unique(values) {
  return [...new Set(values)];
}

export function familiesFor(...parts) {
  const text = parts.filter(Boolean).join(" ");
  const ids = FAMILIES.filter((family) => family.test.test(text)).map((family) => family.id);
  return ids.length ? ids : ["other"];
}

export function familiesIn(weeks) {
  const used = new Set(weeks.flatMap((week) => week.families));
  const present = FAMILIES.filter((family) => used.has(family.id));
  if (used.has("other")) present.push({ id: "other", label: "Other" });
  return present;
}

export function sectionId(genre) {
  const slug = genre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `g-${slug || "releases"}`;
}

export function renderOutlinks(release) {
  const links = [];
  if (release.spotify) {
    links.push(
      `<a class="outlink" href="${escapeHtml(release.spotify)}" rel="noopener">Spotify</a>`
    );
  }
  if (release.bandcamp) {
    links.push(
      `<a class="outlink" href="${escapeHtml(release.bandcamp)}" rel="noopener">Bandcamp</a>`
    );
  }
  if (!links.length) return "";
  return `<span class="outlinks">${links.join("")}</span>`;
}

export function genreNav(selfPath, families) {
  const links = [
    `<a data-genre="" href="${escapeHtml(selfPath)}">All</a>`,
    ...families.map(
      (family) =>
        `<a data-genre="${escapeHtml(family.id)}" href="${escapeHtml(selfPath)}?genre=${escapeHtml(family.id)}">${escapeHtml(family.label)}</a>`
    ),
  ].join("\n    ");
  return `<nav class="genre-nav" aria-label="Genres">
    ${links}
  </nav>`;
}

export function buddyNav(prefix, current) {
  const links = BUDDIES.map((buddy) => {
    const here = current === buddy.id ? ` aria-current="page"` : "";
    return `<a href="${escapeHtml(prefix)}${buddy.href}"${here}>${glyphs[buddy.glyph]}<span>${escapeHtml(buddy.label)}</span></a>`;
  }).join("\n    ");
  return `<nav class="buddy-nav" aria-label="Side lists">
    ${links}
  </nav>`;
}

export function navRow(genreHtml, prefix, current) {
  return `<div class="nav-row">
  ${genreHtml}
  ${buddyNav(prefix, current)}
</div>`;
}

const credit = `Schammasch at Eindhoven Metal Meeting, 2016. Photo by Grywnn, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, via <a href="https://commons.wikimedia.org/wiki/File:Schammasch_@_Eindhoven_Metal_Meeting_2016_054.jpg">Wikimedia Commons</a>. Site code is MIT. The photograph stays under CC BY-SA 4.0.`;

const playlist = `<section class="listen" id="listen" aria-label="Listen">
  <h2>Listen</h2>
  <div class="listen-frame">
    <iframe src="https://open.spotify.com/embed/playlist/2lZxOHKx38DX9AuY0G2hjI?utm_source=generator&amp;theme=0" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify playlist"></iframe>
  </div>
</section>`;

export function attributions(lead) {
  return `${playlist}
<footer id="attributions">
  <p>${lead}</p>
  <h2>Attributions</h2>
  <p>${credit}</p>
</footer>`;
}

export function pageShell({ title, description, depth, body, catalog = false }) {
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
<body${catalog ? ' data-catalog="true"' : ""}>
<a class="skip" href="#content">Skip to the releases</a>
${body}
<script src="${prefix}js/site.js"></script>
</body>
</html>
`;
}
