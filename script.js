(() => {
  const GH_BASE = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/';
  const scripts = [
    'Library.js',
    'colorize 2.js',
    'BetterPlayer.js',
    'ScreenSpotify.js',
    'Main.js'
  ];

  async function loadScript(name) {
    const url = GH_BASE + encodeURIComponent(name);
    console.log(`[SpotCol] 📦 Загружаю ${name} → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const code = await res.text();
      Function(code)();
      console.log(`[SpotCol] ✅ ${name} загружен и выполнен`);
    } catch (e) {
      console.error(`[SpotCol] ❌ Не удалось загрузить ${name}:`, e);
    }
  }

  (async () => {
    for (const file of scripts) {
      await loadScript(file);
    }
    console.log('[SpotCol] 🟢 Все модули загружены');
  })();
})();
