#!/usr/bin/env node
/**
 * Rebuild the side-list pages from data/special-jrod.json and
 * data/special-lenny.json. Idempotent: the same files produce the same HTML.
 *
 *   node scripts/build-special.mjs
 *
 * `node scripts/add-week.mjs --rebuild` and `node scripts/build-weeks.mjs`
 * also rewrite these pages, so the shared header stays on every page.
 */

import { writeSpecialPages } from "./special.mjs";

writeSpecialPages();
