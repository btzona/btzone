# BT's Extreme Metal Release Report

A public, week-over-week archive of Bryan Timmins's extreme metal release digests: black metal, death metal, grind, crust, sludge, and doom. Each week is a static page. Album titles link out when that week's note had a link.

**Public site:** https://btzona.github.io/btzone/

The index lists weeks newest first. Under the title, genre labels filter the page (Black, Death, Grind · Crust, Sludge · Doom, Experimental). On a week page it shows that style and scrolls to the first matching `>> GENRE <<` section. On the index it keeps the weeks that include the genre and lists those releases across weeks. A week page groups releases under `>> GENRE <<` headings. Each line reads:

`Band - Album - MM/DD - genre - Country`

The album name is plain text. When a Spotify album page or a Bandcamp album page is known, a small gold Spotify or Bandcamp label sits at the end of the line. A release can have one, both, or neither. Other links are left off.

Each row is one week, Friday through Friday, with no gap between them:

- Week of Sep 12–18, 2026
- Week of Sep 19–25, 2026 (includes the Sep 24 mid-week note and the Sep 26 catch-up)
- Week of Sep 26–Oct 2, 2026 (includes the Oct 3 catch-up)
- Week of Oct 3–9, 2026 (includes the Oct 10 catch-up)
- Week of Oct 10–16, 2026 (includes the Oct 17 catch-up)
- Week of Oct 18–23, 2026

A Saturday catch-up is not its own card or page. A band and album already on that week is kept once. Older catch-up addresses redirect to the week page. The last field is the band's country. Where that could not be verified, the line says Unknown. Spotify and Bandcamp labels are separate from that field.

## Pages

The site is plain HTML, CSS, and one small script. GitHub Pages does not need a build. `index.html` is at the repository root, with week pages in `weeks/`. `.nojekyll` is committed so Pages serves the files as they are.

Publish from the `main` branch, folder `/` (root):

**Settings → Pages → Build and deployment → Source → Deploy from a branch → `main` → `/ (root)` → Save.**

The same files can be published by GitHub Actions. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) copies the committed HTML to Pages and calls `configure-pages` with `enablement: true`. Creating the Pages site the first time needs a token with `pages: write` and `administration: write`. The default `GITHUB_TOKEN` can deploy after the site exists; it cannot create it. If the workflow fails on that permission, use the branch setting above once, or set the source to GitHub Actions and re-run the workflow.

## Add a week

Put a digest at `digests/YYYY-MM-DD.txt`, then run:

```bash
node scripts/add-week.mjs digests/2026-10-23.txt \
  --slug 2026-10-23 \
  --title "Week of Oct 18–23, 2026" \
  --kind friday
```

A Saturday digest uses the same slug as the week it extends. It does not create a sibling page. `--retire` removes an older slug left over from when catch-ups were separate:

```bash
node scripts/add-week.mjs digests/2026-10-10.txt \
  --slug 2026-10-09 \
  --title "Week of Oct 3–9, 2026" \
  --kind saturday \
  --retire 2026-10-10
```

`--kind` is `friday`, `saturday`, or `midweek`. `saturday` merges into `--slug` and drops a release that is already on that week (same band and album). If that slug does not exist yet, the command creates it as the week page. Optional `--blurb` and `--sort` (defaults to the slug, which is how the index orders weeks, newest first). Run the Friday digest first, then the Saturday fold-in.

`scripts/seed.sh` rebuilds the six weeks already in the repo from `scripts/build-weeks.mjs`. That script folds each catch-up into its Friday week, drops a repeated band and album, and reads countries from `data/countries.json`. A null entry there is rendered as Unknown.

Digest format:

```text
>> BLACK METAL <<
Abaser - Esclaves de l'hiver de la tristesse (EP) - 10/20 - atmospheric black metal - Unknown | bandcamp: https://artist.bandcamp.com/album/name | spotify: https://open.spotify.com/album/id

>> SLUDGE / DOOM <<
Boss Keloid - Float & Aperture <https://artist.bandcamp.com/album/name> - 10/23 - progressive sludge metal - UK

Sources: where the week's note came from.
```

`spotify` has to be an `https://open.spotify.com/album/...` URL. `bandcamp` has to be an `https://....bandcamp.com/album/...` URL. A bare `<https://...>` or trailing `| https://...` is kept only when the host matches one of those. Artist pages, track pages, Apple Music, and label stores are not shown. Two different URLs for the same service on one line are dropped. Leave a label off when the page is not verified. `scripts/build-weeks.mjs` also fills gaps from `data/links.json`, which stores the same two fields keyed by band and album. A null there means no verified page.

The command rewrites `data/catalog.json`, `index.html`, and `weeks/*.html`. Commit those files. To regenerate without parsing again:

```bash
node scripts/add-week.mjs --rebuild
```

`scripts/seed.sh` reloads every digest already in the repo.

## Picture

The index photograph is Schammasch at Eindhoven Metal Meeting, 2016, by Grywnn, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Schammasch_@_Eindhoven_Metal_Meeting_2016_054.jpg). The page shows a short “Photo: Schammasch @ EMM 2016” caption. The full credit appears once, in the footer under Attributions. The site code is MIT. The photograph remains CC BY-SA 4.0.

## License

Site code is [MIT](LICENSE). Release titles and notes stay with the digests they came from.
