(() => {
  const ts = Date.now();
  const src = `https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/SpotCol.js?t=${ts}`;
  fetch(src)
    .then(r => r.text())
    .then(code => Function(code)());
})();

