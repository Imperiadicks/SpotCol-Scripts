(() => {
  if (window.WolfyLibrary) return;

  const log = (...a) => { if (window.__WOLFY_DEBUG__) console.log('[WolfyLibrary]', ...a); };

  /* ───────────────── 1. EventEmitter ───────────────── */
  class EventEmitter {
    #ev = Object.create(null);
    on   (e, fn){ (this.#ev[e] ??= []).push(fn); return this; }
    off  (e, fn){ this.#ev[e] = (this.#ev[e] || []).filter(f => f !== fn); return this; }
    emit (e, d ){ (this.#ev[e] || []).forEach(f => f(d)); return this; }
    once (e, fn){ const g = (...a) => { this.off(e, g); fn(...a); }; return this.on(e, g); }
    removeAllListeners(e){ e ? delete this.#ev[e] : this.#ev = Object.create(null); }
  }

  /* ───────────────── 2. StylesManager ───────────────── */
  class StylesManager {
    #bag = {};
    #flush(){
      let tag = document.getElementById('wolfy-style');
      if (!tag){ tag = document.createElement('style'); tag.id = 'wolfy-style'; document.head.appendChild(tag); }
      tag.textContent = this.result;
    }
    get result(){ return Object.values(this.#bag).join('\n\n'); }
    add(id, css){ this.#bag[id] = css; this.#flush(); log('CSS +', id); }
    update(id, css){ if (id in this.#bag){ this.#bag[id] = css; this.#flush(); log('CSS ~', id); } }
    remove(id){ delete this.#bag[id]; this.#flush(); log('CSS –', id); }
    clear(){ this.#bag = {}; this.#flush(); log('CSS cleared'); }
    media(q, css){ return `@media ${q}{${css}}`; }
    prefersColor(mode, css){ return this.media(`(prefers-color-scheme:${mode})`, css); }
  }

  /* ───────────────── 3. SettingsManager ─────────────── */
  class SettingsManager extends EventEmitter {
    #key = 'spotcol_settings';
    #store = JSON.parse(localStorage.getItem(this.#key) || '{}');
    #save(){ localStorage.setItem(this.#key, JSON.stringify(this.#store)); }

    get(key){ return this.#store[key]; }
    set(key, value){
      const prev = this.#store[key];
      this.#store[key] = value;
      this.#save();
      this.emit('update', this.getAll());
      if (prev !== value) this.emit(`change:${key}`, { key, value });
      log('setting', key, '→', value);
    }
    onChange(key, fn){ return this.on(`change:${key}`, fn); }
    toggle(key){ this.set(key, !this.get(key)); }
    defaults(obj){ Object.entries(obj).forEach(([k, v]) => { if (!(k in this.#store)) this.set(k, v); }); }
    validate(schema){ Object.entries(schema).forEach(([k, t]) => { if (k in this.#store && typeof this.#store[k] !== t){ this.set(k, undefined); } }); }
    getAll(){ return { ...this.#store }; }
    clear(){ this.#store = {}; this.#save(); this.emit('update', {}); }

    /* полный original update/transformJSON/hasChanged */
    async update(){
      try{
        const r = await fetch(`http://127.0.0.1:2007/get_handle?theme=${this.theme?.id || 'unknown'}`);
        if(!r.ok) throw 0;
        const { data } = await r.json();
        this.old_settings = this.settings;
        this.settings = this.transformJSON(data);
        this.emit('update', { settings: this, styles: this.theme?.stylesManager, state: this.theme?.player?.state });
        for(const id in this.settings) if(this.hasChanged(id))
          this.emit(`change:${id}`, { settings: this, styles: this.theme?.stylesManager, state: this.theme?.player?.state });
      }catch(e){ log('settings update error', e); }
    }
    transformJSON(data){
      const res = {};
      try{
        data.sections.forEach(sec => {
          sec.items.forEach(it => {
            if(it.type === 'text' && it.buttons){
              res[it.id] = {};
              it.buttons.forEach(b => { res[it.id][b.id] = { value: b.text, default: b.defaultParameter }; });
            }else{
              res[it.id] = { value: it.bool ?? it.filePath ?? it.input ?? it.selected ?? it.value, default: it.defaultParameter };
            }
          });
        });
      }catch(e){ log('transform error', e); }
      return res;
    }
    hasChanged(id){
      if(!this.settings) return true;
      const path=id.split('.'); const pick=obj=>path.reduce((o,k)=>o?.[k],obj);
      return pick(this.settings)?.value !== pick(this.old_settings||{})?.value;
    }
  }

  /* ───────────────── 4. AssetsManager ──────────────── */
  class AssetsManager {
    _base = 'http://127.0.0.1:2007/assets';
    async getContent(name){ const r = await fetch(`${this._base}/${name}`); return r.ok ? r.text() : ''; }
    getLink(name){ return `${this._base}/${name}`; }
    get files(){ return fetch(this._base).then(r=>r.json()).then(j=>j.files).catch(()=>[]); }
  }

  /* ───────────────── 5. PlayerEvents ──────────────── */
  class PlayerEvents extends EventEmitter {
    state = { status:'paused', track:{}, volume:1, position:0, shuffle:false, repeat:'none' };
    constructor(theme){ super(); this.settingsManager = theme?.settingsManager; this.stylesManager = theme?.stylesManager; this.#hook(); }
    #hook(){
      const wait = setInterval(() => {
        const s = window.sonataState;
        if(!s?.state?.playerState) return;
        clearInterval(wait);
        const ps = s.state.playerState, qs = s.state.queueState, vs = s.state.volumeState;
        const track = () => qs.currentEntity?.value?.entity?.data?.meta || qs.currentEntity?.value?.entity_data_meta || {};
        Object.assign(this.state,{ status: ps.status.value, track: track(), volume: vs?.volume?.value ?? 1, position: ps.position.value, shuffle: ps.shuffle.value, repeat: ps.repeatMode.value });
        this.emit('ready', { settings:this.settingsManager, styles:this.stylesManager, state:this.state });
        ps.status.onChange(st=>{ this.state.status = st; this.emit(st==='playing'?'play':'pause', { settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
        qs.currentEntity.onChange(()=>{ this.state.track = track(); this.emit('trackChange',{ settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
        if(vs?.volume) vs.volume.onChange(v=>{ this.state.volume=v; this.emit('volumeChange',{ settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
        ps.position.onChange(p=>{ this.state.position=p; this.emit('seek',{ settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
        ps.shuffle.onChange(sh=>{ this.state.shuffle=sh; this.emit('shuffleChange',{ settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
        ps.repeatMode.onChange(r=>{ this.state.repeat=r; this.emit('repeatChange',{ settings:this.settingsManager, styles:this.stylesManager, state:this.state }); });
      },150);
    }
  }

  /* ───────────────── 6. Theme ─────────────────────── */
  class Theme {
    constructor(id){
      this.id = id;
      this.stylesManager   = new StylesManager();
      this.assetsManager   = new AssetsManager();
      this.settingsManager = new SettingsManager(); this.settingsManager.theme = this;
      this.player          = new PlayerEvents(this);
      this.bus             = new EventEmitter();
      ['on','off','once','emit','removeAllListeners'].forEach(m=>this[m]=(...a)=>this.bus[m](...a));
      this.actions = {};
      this.player.on('trackChange',({state})=>this.emit('clear-screen',state));
    }

    addAction(id,fn){ this.actions[id]=fn; }
    applyStyles(){ let tag=document.getElementById(`${
