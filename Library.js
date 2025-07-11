(() => {
  if (window.WolfyLibrary) return;

  // ========== EventEmitter ==========
  class EventEmitter {
    #ev = {};
    on(e, f){ (this.#ev[e] ??= []).push(f) }
    off(e, f){ this.#ev[e] = (this.#ev[e]||[]).filter(x=>x!==f) }
    emit(e, d){ (this.#ev[e]||[]).forEach(f=>f(d)) }
  }

  // ========== StylesManager ==========
  class StylesManager {
    #store = {};
    add(id, css){ this.#store[id]=css; this.#flush() }
    remove(id){ delete this.#store[id]; this.#flush() }
    clear(){ this.#store={}; this.#flush() }
    #flush(){
      let s = document.getElementById('wolfy-stub-style');
      if(!s){ s=document.createElement('style'); s.id='wolfy-stub-style'; document.head.appendChild(s); }
      s.textContent = Object.values(this.#store).join('\n\n');
    }
  }

  // ========== PlayerEvents ==========
  class PlayerEvents extends EventEmitter {
    state = { status:'paused', track:{}, volume:0 };
    constructor(){ super(); this.#init(); }

    #init(){
      const wait = setInterval(()=>{
        const sonata = window.sonataState || window.player;
        if (!sonata?.state?.playerState || !sonata?.state?.queueState) return;
        clearInterval(wait);

        const ps = sonata.state.playerState;
        const qs = sonata.state.queueState;

        // безопасное получение трека
        const safeTrack =
          qs?.currentEntity?.value?.entity_data_meta ||
          qs?.currentEntity?.value?.entity?.data?.meta ||
          {};

        this.state.track = safeTrack;
        this.state.status = ps.status.value;

        ps.status.onChange(st => {
          this.state.status = st;
          this.emit(st === 'playing' ? 'play' : 'pause', { state: this.state });
        });

        qs.currentEntity.onChange(() => {
          const newTrack =
            qs?.currentEntity?.value?.entity_data_meta ||
            qs?.currentEntity?.value?.entity?.data?.meta ||
            {};
          this.state.track = newTrack;
          this.emit('trackChange', { state: this.state });
        });
      }, 200);
    }
  }

  // ========== SettingsManager ==========
  class SettingsManager extends EventEmitter {
    get(key) {
      const raw = window.SETTINGS.get(key);
      return { value: raw ?? false, default: false };
    }
    hasChanged(){ return false }
    on(){ super.on(...arguments) }
  }

  // ========== Theme ==========
  class Theme {
    constructor(id){
      this.id = id;
      this.stylesManager   = new StylesManager();
      this.settingsManager = new SettingsManager();
      this.player = new PlayerEvents();
      this.sonataState = this.player;
    }

    start() { }
    addAction() { }
  }

  // ========== spotcol_settings ==========
  window.SETTINGS = {
    store: JSON.parse(localStorage.getItem('spotcol_settings') || '{}'),

    set(key, value) {
      this.store[key] = value;
      localStorage.setItem('spotcol_settings', JSON.stringify(this.store));
    },

    get(key) {
      return this.store[key];
    },

    has(key) {
      return Object.prototype.hasOwnProperty.call(this.store, key);
    },

    clear() {
      this.store = {};
      localStorage.removeItem('spotcol_settings');
    }
  };

  // ========== Экспорт ==========
  window.EventEmitter    = EventEmitter;
  window.StylesManager   = StylesManager;
  window.PlayerEvents    = PlayerEvents;
  window.SettingsManager = SettingsManager;
  window.Theme           = Theme;

  window.WolfyLibrary = {
    EventEmitter, StylesManager, PlayerEvents, SettingsManager, Theme
  };

  console.log('[Wolfy-stub] активирован: WolfyLibrary временно заменён');
  window.spotcol_settings = SETTINGS.store;
})();
