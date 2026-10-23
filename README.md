# BT's Extreme Metal Release Report

A public, week-over-week archive of Bryan Timmins's extreme metal release digests: black metal, death metal, grind, crust, sludge, and doom. Each week is a static page. Album titles link out when that week's note had a link.

**Public site:** https://btzona.github.io/btzone/

The index lists weeks newest first. The top bar filters by genre (Black, Death, Grind / Crust, Sludge / Doom, Experimental). On a week page it shows that style and scrolls to the first matching `>> GENRE <<` section. On the index it keeps the weeks that include the genre and lists those releases across weeks. A week page groups releases under `>> GENRE <<` headings. Each line reads:

`Band - Album - MM/DD - genre - Country`

Each row is one week. A Saturday catch-up is not its own card or page: those releases are folded into that week's list, and a band/album already on the week is kept once. The Sep 11–18 and Sep 19–26 notes recorded Spotify availability in the last field instead of a country; those lines say `Spotify: yes` or `Spotify: no`.

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
  --title "Week of Oct 4–10, 2026" \
  --kind saturday \
  --retire 2026-10-10
```

`--kind` is `friday`, `saturday`, or `midweek`. `saturday` merges into `--slug` and drops a release that is already on that week (same band and album). If that slug does not exist yet, the command creates it as the week page. Optional `--blurb` and `--sort` (defaults to the slug, which is how the index orders weeks, newest first). Run the Friday digest first, then the Saturday fold-in. `scripts/seed.sh` does that for the weeks already in the repo.

Digest format:

```text
>> BLACK METAL <<
Abaser - Esclaves de l'hiver de la tristesse (EP) <https://example.com/album> - 10/20 - atmospheric black metal - Unknown

>> SLUDGE / DOOM <<
Boss Keloid - Float & Aperture - 10/23 - progressive sludge metal - UK | https://example.com/album

Sources: where the week's note came from.
```

The command rewrites `data/catalog.json`, `index.html`, and `weeks/*.html`. Commit those files. To regenerate without parsing again:

```bash
node scripts/add-week.mjs --rebuild
```

`scripts/seed.sh` reloads every digest already in the repo.

## Picture

The index photograph is Schammasch at Eindhoven Metal Meeting, 2016, by Grywnn, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Schammasch_@_Eindhoven_Metal_Meeting_2016_054.jpg). The page shows a short “Photo: Schammasch @ EMM 2016” caption. The full credit appears once, in the footer under Attributions. The site code is MIT. The photograph remains CC BY-SA 4.0.

## License

Site code is [MIT](LICENSE). Release titles and notes stay with the digests they came from.
