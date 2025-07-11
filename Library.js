(() => {
  if (window.WolfyLibrary) return;

  // ---------------- EventEmitter ----------------
  class EventEmitter {
    #ev = {};
    on(e, f) {
      (this.#ev[e] ??= []).push(f);
    }
    off(e, f) {
      this.#ev[e] = (this.#ev[e] || []).filter(x => x !== f);
    }
    emit(e, d) {
      (this.#ev[e] || []).forEach(f => f(d));
    }
  }

  // ---------------- StylesManager ----------------
  class StylesManager {
    #store = {};
    add(id, css) {
      this.#store[id] = css;
      this.#flush();
    }
    remove(id) {
      delete this.#store[id];
      this.#flush();
    }
    clear() {
      this.#store = {};
      this.#flush();
    }
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
    constructor() {
      super();
      this.#init();
    }
    #init() {
      const wait = setInterval(() => {
        const sonata = window.sonataState || window.player;
        if (!sonata?.state?.playerState) return;
        clearInterval(wait);

        const ps = sonata.state.playerState;
        const qs = sonata.state.queueState;

        // начальные значения
        try {
          this.state.track =
            qs.currentEntity?.value?.entity?.data?.meta ||
            qs.currentEntity?.value?.entity_data_meta ||
            {};
        } catch (e) {
          this.state.track = {};
        }

        this.state.status = ps.status.value;

        ps.status.onChange(st => {
          this.state.status = st;
          this.emit(st === 'playing' ? 'play' : 'pause', {
            state: this.state
          });
        });

        qs.currentEntity.onChange(() => {
          try {
            this.state.track =
              qs.currentEntity?.value?.entity?.data?.meta ||
              qs.currentEntity?.value?.entity_data_meta ||
              {};
          } catch (e) {
            this.state.track = {};
          }
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

    get(key) {
      return this.#store[key];
    }

    set(key, value) {
      this.#store[key] = value;
      localStorage.setItem('spotcol_settings', JSON.stringify(this.#store));
      this.emit('change', { key, value });
    }

    has(key) {
      return Object.prototype.hasOwnProperty.call(this.#store, key);
    }

    clear() {
      this.#store = {};
      localStorage.removeItem('spotcol_settings');
      this.emit('clear');
    }

    /** Возвращает копию всех настроек */
    getAll() {
      return { ...this.#store };
    }

    /** Подписка на изменение конкретного ключа */
    onChange(key, callback) {
      this.on('change', ({ key: k, value }) => {
        if (k === key) callback(value);
      });
    }

    /** Переключает значение true/false */
    toggle(key) {
      const current = Boolean(this.#store[key]);
      const next = !current;
      this.set(key, next);
      return next;
    }

    /** Задаёт значения по умолчанию, если они отсутствуют */
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
