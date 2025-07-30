(() => {
  console.log('[script] v1.0.0');
  const ts = Date.now();
  const src = `https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/js/SpotCol.js?t=${ts}`;
  fetch(src)
    .then(r => r.text())
    .then(code => Function(code)());
})();

