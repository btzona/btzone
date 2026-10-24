#!/bin/sh
# Rebuild every committed week from its digest. Safe to re-run.
# One page per Friday-ending week. Saturday catch-ups fold into that week.
set -eu
cd "$(dirname "$0")/.."
node scripts/build-weeks.mjs
