const input = document.querySelector("#q");
if (input) {
  const sections = [...document.querySelectorAll(".genre")];
  const apply = () => {
    const query = input.value.trim().toLowerCase();
    for (const section of sections) {
      let shown = 0;
      for (const item of section.querySelectorAll(".rel")) {
        const hit = !query || (item.dataset.text || "").includes(query);
        item.hidden = !hit;
        if (hit) shown += 1;
      }
      section.hidden = shown === 0;
    }
  };
  const params = new URLSearchParams(location.search);
  if (params.get("q")) input.value = params.get("q");
  input.addEventListener("input", () => {
    apply();
    const url = new URL(location.href);
    if (input.value) url.searchParams.set("q", input.value);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  });
  apply();
}
