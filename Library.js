(() => {
  if (window.WolfyLibrary) return;

  // ---------------- EventEmitter ----------------
  class EventEmitter {
    #ev = {};
    on(e, f) { (this.#ev[e] ??= []).push(f); }
    off(e, f) { this.#ev[e] = (this.#ev[e] || []).filter(x => x !== f); }
    emit(e, d) { (this.#ev[e] || []).forEach(f => f(d)); }
  }

  // ---------------- StylesManager ----------------
  class StylesManager {
    #store = {};
    add(id, css) { this.#store[id] = css; this.#flush(); }
    remove(id) { delete this.#store[id]; this.#flush(); }
    clear() { this.#store = {}; this.#flush(); }
    #flush() {
      let s = document.getElementById('wolfy-stub-style');
      if (!s) {
        s = document.createElement('style');
        s.id = 'wolfy-stub-style';
        document.head.appendChild(s);
      }
      s.textContent = Object.values(this.#store).join('\n\n');
    }
  }

  // ---------------- PlayerEvents ----------------
  class PlayerEvents extends EventEmitter {
    state = { status: 'paused', track: {}, volume: 0 };
    constructor() { super(); this.#init(); }
    #init() {
      const wait = setInterval(() => {
        const sonata = window.sonataState || window.player;
        if (!sonata?.state?.playerState) return;
        clearInterval(wait);
        const ps = sonata.state.playerState;
        const qs = sonata.state.queueState;

        try {
          this.state.track =
            qs.currentEntity?.value?.entity?.data?.meta ||
            qs.currentEntity?.value?.entity_data_meta ||
            {};
        } catch { this.state.track = {}; }

        this.state.status = ps.status.value;

        ps.status.onChange(st => {
          this.state.status = st;
          this.emit(st === 'playing' ? 'play' : 'pause', { state: this.state });
        });

        qs.currentEntity.onChange(() => {
          try {
            this.state.track =
              qs.currentEntity?.value?.entity?.data?.meta ||
              qs.currentEntity?.value?.entity_data_meta ||
              {};
          } catch { this.state.track = {}; }
          this.emit('trackChange', { state: this.state });
        });
      }, 200);
    }
  }

  // ---------------- SettingsManager ----------------
  class SettingsManager extends EventEmitter {
    #store = {};
    constructor() {
      super();
      this.#store = JSON.parse(localStorage.getItem('spotcol_settings') || '{}');
    }

    get(key) { return this.#store[key]; }
    set(key, value) {
      this.#store[key] = value;
      localStorage.setItem('spotcol_settings', JSON.stringify(this.#store));
      this.emit('change', { key, value });
    }

    has(key) { return Object.prototype.hasOwnProperty.call(this.#store, key); }
    clear() {
      this.#store = {};
      localStorage.removeItem('spotcol_settings');
      this.emit('clear');
    }

    getAll() { return { ...this.#store }; }
    onChange(key, callback) {
      this.on('change', ({ key: k, value }) => { if (k === key) callback(value); });
    }
    toggle(key) {
      const next = !Boolean(this.#store[key]);
      this.set(key, next);
      return next;
    }
    defaults(obj = {}) {
      let changed = false;
      for (const [key, value] of Object.entries(obj)) {
        if (!this.has(key)) {
          this.set(key, value);
          changed = true;
        }
      }
      return changed;
    }
  }

  // ---------------- Theme ----------------
  class Theme {
    constructor(id) {
      this.id = id;
      this.stylesManager = new StylesManager();
      this.settingsManager = new SettingsManager();
      this.player = new PlayerEvents();
      this.sonataState = this.player;
      this.context = {
        handle: null,
        getHandleValue: key => this.context.handle?.[key]
      };
      this.#loadHandle();
    }

    async #loadHandle() {
const Theme = window.Theme || {}; // если это не сделано

Theme.getThemeId = function() {
  try {
    const scriptSrc = [...document.scripts].find(s => s.src.includes('script.js'))?.src || '';
    const parts = scriptSrc.split('/');
    const themeName = parts[parts.indexOf('SpotCol-Scripts') + 1]; // 'SpotColЛичная'
    return themeName || 'unknown';
  } catch {
    return 'unknown';
  }
};
const themeId = Theme.getThemeId(); // должно вернуть 'SpotColЛичная'
console.log(themeId)
    }

static getThemeId() {
  try {
    const scripts = [...document.querySelectorAll('script[src]')];
    const target = scripts.find(s => s.src.includes('script.js'));
    if (!target) return 'unknown';

    const url = new URL(target.src);
    const parts = url.pathname.split('/').filter(Boolean);
    const index = parts.findIndex(p => p === 'script.js');
    if (index > 0) return parts[index - 1];
    return 'unknown';
  } catch {
    return 'unknown';
  }
}


    start() {}
    addAction() {}
  }

  // ---------------- Глобальный экспорт ----------------
  window.EventEmitter = EventEmitter;
  window.StylesManager = StylesManager;
  window.PlayerEvents = PlayerEvents;
  window.SettingsManager = SettingsManager;
  window.Theme = Theme;

  window.WolfyLibrary = {
    EventEmitter,
    StylesManager,
    PlayerEvents,
    SettingsManager,
    Theme
  };

  console.log('[Wolfy-stub] ✅ Заглушка активна: WolfyLibrary подменён');
})();
