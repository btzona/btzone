#!/bin/sh
# Rebuild every committed week from its digest. Safe to re-run.
set -eu
cd "$(dirname "$0")/.."

node scripts/add-week.mjs digests/2026-09-18.txt \
  --slug 2026-09-18 \
  --title "Week of Sep 11–18, 2026" \
  --kind friday \
  --sort 2026-09-18

node scripts/add-week.mjs digests/2026-09-24.txt \
  --slug 2026-09-24 \
  --title "Sep 19–24, 2026" \
  --kind midweek \
  --sort 2026-09-24 \
  --blurb "Mid-week window between the Sep 18 and Sep 25 waves, covering Sep 21–24"

node scripts/add-week.mjs digests/2026-09-26.txt \
  --slug 2026-09-26 \
  --title "Saturday catch-up · Sep 23–26, 2026" \
  --kind saturday \
  --sort 2026-09-26

node scripts/add-week.mjs digests/2026-10-03.txt \
  --slug 2026-10-03 \
  --title "Saturday catch-up · Oct 2–3, 2026" \
  --kind saturday \
  --sort 2026-10-03

node scripts/add-week.mjs digests/2026-10-09.txt \
  --slug 2026-10-09 \
  --title "Week of Oct 4–9, 2026" \
  --kind friday \
  --sort 2026-10-09

node scripts/add-week.mjs digests/2026-10-10.txt \
  --slug 2026-10-10 \
  --title "Saturday catch-up · Oct 9–10, 2026" \
  --kind saturday \
  --sort 2026-10-10

node scripts/add-week.mjs digests/2026-10-23.txt \
  --slug 2026-10-23 \
  --title "Week of Oct 18–23, 2026" \
  --kind friday \
  --sort 2026-10-23 \
  --blurb "124 releases · black, death, experimental/noise, grind/crust, sludge/doom"
