(() => {
  const GH_BASE_js = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/js/';
  const GH_BASE_css = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/css/';
  console.log("ПРОВЕРКА SPOTCOL.JS")
  const scripts = [
    'Library.js',
    'colorize 2.js',
    // 'BetterPlayer.js',
    'Main.js',
    'SpotifyScreen.js'
  ];

  const styles = [
    'SpotCol.css',
    'Colorize 2.css'
  ];

async function loadScript(name) {
  const url = GH_BASE_js + encodeURIComponent(name);
  console.log(`[SpotCol] 📦 Загружаю ${name} → ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const code = await res.text();

    // Выполняем в глобальной области через .call(window)
    const globalEval = Function(code);
    globalEval.call(window);

    console.log(`[SpotCol] ✅ ${name} загружен и выполнен`);
  } catch (e) {
    console.error(`[SpotCol] ❌ Не удалось загрузить ${name}:`, e);
  }
}

  async function loadCss(name) {
    const url = GH_BASE_css + encodeURIComponent(name);
    console.log(`[SpotCol] 🎨 Загружаю CSS → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const css = await res.text();
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      console.log(`[SpotCol] ✅ CSS ${name} подключён`);
    } catch (e) {
      console.error(`[SpotCol] ❌ CSS ошибка: ${name}`, e);
    }
  }

  (async () => {
    for (const style of styles) await loadCss(style);
    for (const script of scripts) await loadScript(script);
    console.log('[SpotCol] 🟢 Все модули загружены');
  })();
})();
