const params = new URLSearchParams(location.search);
const genre = (params.get("genre") || "").trim().toLowerCase();

if (document.body.dataset.catalog === "true") {
  for (const link of document.querySelectorAll(".genre-nav a")) {
    const id = (link.dataset.genre || "").toLowerCase();
    if (id === genre) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function hasFamily(node) {
  if (!genre) return true;
  return (node.dataset.families || "").split(/\s+/).includes(genre);
}

function genreLabel() {
  const current = document.querySelector(".genre-nav a[aria-current='page']");
  return current ? current.textContent.trim() : genre;
}

function withGenre(base) {
  const hashAt = base.indexOf("#");
  const path = hashAt >= 0 ? base.slice(0, hashAt) : base;
  const hash = hashAt >= 0 ? base.slice(hashAt) : "";
  if (!genre) return base;
  return `${path}?genre=${encodeURIComponent(genre)}${hash}`;
}

const input = document.querySelector("#q");
const sections = [...document.querySelectorAll("main .genre")];

if (input && sections.length) {
  const empty = document.querySelector("main > .empty");
  const apply = ({ scroll }) => {
    const query = input.value.trim().toLowerCase();
    let first = null;
    let headed = null;
    for (const section of sections) {
      let shown = 0;
      for (const item of section.querySelectorAll(".rel")) {
        const hit = hasFamily(item) && (!query || (item.dataset.text || "").includes(query));
        item.hidden = !hit;
        if (hit) shown += 1;
      }
      section.hidden = shown === 0;
      const count = section.querySelector(".section-count");
      if (count) count.textContent = `${shown} release${shown === 1 ? "" : "s"}`;
      if (!shown) continue;
      if (!first) first = section;
      if (
        !headed &&
        genre &&
        (section.dataset.heading || "").split(/\s+/).includes(genre)
      ) {
        headed = section;
      }
    }
    if (empty) empty.hidden = Boolean(first);
    const target = headed || first;
    if (scroll && target) target.scrollIntoView({ block: "start" });
  };
  if (params.get("q")) input.value = params.get("q");
  input.addEventListener("input", () => {
    apply({ scroll: false });
    const url = new URL(location.href);
    if (input.value) url.searchParams.set("q", input.value);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  });
  apply({ scroll: Boolean(genre) && !location.hash });
}

const browse = document.querySelector("#browse");
const weekItems = [...document.querySelectorAll(".week-item")];
if (browse && weekItems.length) {
  const weeksTitle = document.querySelector("#weeks-title");
  const browseTitle = document.querySelector("#browse-title");
  const weeksEmpty = document.querySelector(".weeks-empty");
  const browseEmpty = document.querySelector(".browse-empty");
  const hits = [...browse.querySelectorAll(".hit")];
  const label = genreLabel();

  let weeksShown = 0;
  for (const item of weekItems) {
    const card = item.querySelector(".week-card");
    const show = hasFamily(item);
    item.hidden = !show;
    if (card && card.dataset.base) card.href = withGenre(card.dataset.base);
    if (show) weeksShown += 1;
  }
  if (weeksEmpty) weeksEmpty.hidden = weeksShown !== 0;
  if (weeksTitle) weeksTitle.textContent = genre ? `Weeks with ${label}` : "Weeks";

  let hitsShown = 0;
  for (const hit of hits) {
    const jump = hit.querySelector(".jump");
    const show = Boolean(genre) && hasFamily(hit);
    hit.hidden = !show;
    if (jump && jump.dataset.base) jump.href = withGenre(jump.dataset.base);
    if (show) hitsShown += 1;
  }
  browse.hidden = !genre;
  if (browseTitle && genre) browseTitle.textContent = `${label} across weeks`;
  if (browseEmpty) browseEmpty.hidden = !genre || hitsShown !== 0;
  if (genre && !location.hash) browse.scrollIntoView({ block: "start" });
}
