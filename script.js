(() => {
  const src = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/SpotCol.js?v=1.9.0';
  fetch(src)
    .then(r => r.text())
    .then(code => Function(code)());
})();
