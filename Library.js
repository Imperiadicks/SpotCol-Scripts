/*─────────────────────────────────────────────────────────────────────────
 *  WolfyLibrary  •  v5.0  (2025-07-12)
 *  Полный («несокращённый») набор утилит для аддонов / тем Яндекс-Музыки
 *─────────────────────────────────────────────────────────────────────────
 *  ▸ StylesManager   add / update / remove / clear / result / media / prefersColor
 *  ▸ EventEmitter    on / off / emit / once / removeAllListeners
 *  ▸ SettingsManager update() / get / hasChanged / onChange / validate / defaults / …
 *  ▸ AssetsManager   getContent / getLink / files
 *  ▸ PlayerEvents    play / pause / seek / progressChange / trackChange … (+ ready)
 *  ▸ Theme           actions-API, stylesManager, settingsManager, player, bus-шина
 *─────────────────────────────────────────────────────────────────────────
 *  DEBUG-вывод активируется, если ДО подключения библиотеки задать
 *      window.__WOLFY_DEBUG__ = true;
 *  иначе шуметь не будет.
 *─────────────────────────────────────────────────────────────────────────*/

(() => {
  if (window.WolfyLibrary) return;          // двойная инициализация не нужна
  const dbg = (...a) => { if (window.__WOLFY_DEBUG__) console.log('[WolfyLibrary]', ...a); };

  /*══════════════════ 1. EventEmitter ══════════════════*/
  class EventEmitter {
    #ev = Object.create(null);
    on   (e,fn){ (this.#ev[e]??=[]).push(fn); return this; }
    off  (e,fn){ this.#ev[e] = (this.#ev[e]||[]).filter(f=>f!==fn); return this; }
    emit (e,d ){ (this.#ev[e]||[]).forEach(f=>f(d)); return this; }
    once (e,fn){ const g=(...a)=>{this.off(e,g);fn(...a)}; return this.on(e,g); }
    removeAllListeners(e){ e?delete this.#ev[e]:this.#ev=Object.create(null); }
  }

  /*══════════════════ 2. StylesManager ═════════════════*/
  class StylesManager {
    #bag = {};
    #flush(){
      let tag=document.getElementById('wolfy-style');
      if(!tag){ tag=document.createElement('style'); tag.id='wolfy-style'; document.head.appendChild(tag); }
      tag.textContent=Object.values(this.#bag).join('\n\n');
    }
    add(id,css){ this.#bag[id]=css; this.#flush(); dbg('CSS +',id); }
    update(id,css){ if(id in this.#bag){this.#bag[id]=css; this.#flush(); dbg('CSS ~',id);} }
    remove(id){ delete this.#bag[id]; this.#flush(); dbg('CSS –',id); }
    clear(){ this.#bag={}; this.#flush(); dbg('CSS cleared'); }
    get result(){ return Object.values(this.#bag).join('\n\n'); }
    /* helpers */
    media(q,css){ return `@media ${q}{${css}}`; }
    prefersColor(mode,css){ return this.media(`(prefers-color-scheme:${mode})`,css); }
  }

  /*══════════════════ 3. SettingsManager ══════════════*/
  class SettingsManager extends EventEmitter{
    #localKey='spotcol_settings';
    #store   = JSON.parse(localStorage.getItem(this.#localKey)||'{}');
    #save(){ localStorage.setItem(this.#localKey, JSON.stringify(this.#store)); }
    /* базовые методы */
    get(id){ return this.#store[id]; }
    set(id,val){
      const prev=this.#store[id];
      this.#store[id]=val; this.#save();
      this.emit('update', this.getAll());
      if(prev!==val) this.emit(`change:${id}`,{key:id,value:val});
      dbg('setting',id,'→',val);
    }
    onChange(id,fn){ return this.on(`change:${id}`,fn); }
    toggle(id){ this.set(id,!this.get(id)); }
    defaults(obj){ Object.entries(obj).forEach(([k,v])=>{ if(!(k in this.#store)) this.set(k,v); }); }
    validate(schema){
      Object.entries(schema).forEach(([k,t])=>{
        if(k in this.#store && typeof this.#store[k]!==t){
          dbg(`setting '${k}' wrong type, resetting`); this.set(k,undefined);
        }
      });
    }
    getAll(){ return {...this.#store}; }
    clear(){ this.#store={}; this.#save(); this.emit('update',{}); }
    /* ====== расширенная часть (из оригинала v2.1) ====== */
    /** async update() … transformJSON … hasChanged() — полностью оставлены из исходника **/
    async update(){
      try{
        const r=await fetch(`http://127.0.0.1:2007/get_handle?name=${this.theme?.id||'unknown'}`);
        if(!r.ok) throw new Error(r.status);
        const {data}=await r.json();
        if(!data?.sections){ dbg('⚠️ strange settings format'); return; }
        this.old_settings=this.settings;
        this.settings=this.transformJSON(data);
        this.emit('update',{settings:this,styles:this.theme?.stylesManager,state:this.theme?.player?.state});
        for(const id in this.settings) if(this.hasChanged(id))
          this.emit(`change:${id}`,{settings:this,styles:this.theme?.stylesManager,state:this.theme?.player?.state});
      }catch(e){ dbg('settings update error',e); }
    }
    transformJSON(input){
      const res={};
      try{
        input.sections.forEach(sec=>{
          sec.items.forEach(item=>{
            if(item.type==='text'&&item.buttons){
              res[item.id]={};
              item.buttons.forEach(b=>{res[item.id][b.id]={value:b.text,default:b.defaultParameter};});
            }else{
              res[item.id]={value:item.bool??item.filePath??item.input??item.selected??item.value,
                             default:item.defaultParameter};
            }
          });
        });
      }catch(e){ dbg('transformJSON error',e); }
      return res;
    }
    hasChanged(id){
      if(!this.settings) return true;
      const traverse=(obj,keys)=>keys.reduce((o,k)=>o?.[k],obj);
      const keys=id.split('.');
      const cur=traverse(this.settings,keys)?.value;
      const old=traverse(this.old_settings||{},keys)?.value;
      return cur!==old;
    }
  }

  /*══════════════════ 4. AssetsManager ════════════════*/
  class AssetsManager{
    _base='http://127.0.0.1:2007/assets';
    async getContent(name){
      const r=await fetch(`${this._base}/${name}`);
      if(!r.ok) throw new Error(r.status);
      const ct=r.headers.get('Content-Type')||'';
      return ct.includes('application/json')?r.json():r.text();
    }
    getLink(name){ return `${this._base}/${name}`; }
    get files(){
      return fetch(this._base).then(r=>r.ok?r.json():Promise.reject(r.status))
        .then(j=>j.files).catch(e=>{dbg('assets error',e); return [];});
    }
  }

  /*══════════════════ 5. PlayerEvents ═════════════════*/
  class PlayerEvents extends EventEmitter{
    state={status:'paused',track:{},volume:1,position:0,shuffle:false,repeat:'none'};
    constructor(theme){ super(); this.settingsManager=theme?.settingsManager; this.stylesManager=theme?.stylesManager; this.#hook(); }
    #hook(){
      const poll=setInterval(()=>{
        const s=window.sonataState;
        if(!s?.state?.playerState) return;
        clearInterval(poll);

        const ps=s.state.playerState, qs=s.state.queueState, vs=s.state.volumeState;
        const track = ()=>qs.currentEntity?.value?.entity?.data?.meta||qs.currentEntity?.value?.entity_data_meta||{};

        /* первичное состояние */
        Object.assign(this.state,{
          status : ps.status.value,
          track  : track(),
          volume : vs.volume.value,
          position:ps.position.value,
          shuffle:ps.shuffle.value,
          repeat :ps.repeatMode.value
        });
        this.emit('ready',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});

        /* подписки */
        ps.status.onChange(st=>{this.state.status=st;this.emit(st==='playing'?'play':'pause',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
        qs.currentEntity.onChange(()=>{this.state.track=track();this.emit('trackChange',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
        vs.volume.onChange(v=>{this.state.volume=v;this.emit('volumeChange',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
        ps.position.onChange(p=>{this.state.position=p;this.emit('seek',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
        ps.shuffle.onChange(sh=>{this.state.shuffle=sh;this.emit('shuffleChange',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
        ps.repeatMode.onChange(r=>{this.state.repeat=r;this.emit('repeatChange',{settings:this.settingsManager,styles:this.stylesManager,state:this.state});});
      },150);
    }
  }

  /*══════════════════ 6. Theme ═══════════════════════*/
  class Theme{
    constructor(id){
      this.id=id;
      this.stylesManager   = new StylesManager();
      this.assetsManager   = new AssetsManager();
      this.settingsManager = new SettingsManager(this);
      this.player          = new PlayerEvents(this);
      this.bus             = new EventEmitter();
      ['on','off','once','emit','removeAllListeners'].forEach(m=>this[m]=(...a)=>this.bus[m](...a));

      /* auto clear-screen */
      this.player.on('trackChange',({state})=>this.emit('clear-screen',state));

      /* actions-механизм */
      this.actions={};
    }

    /* ========== actions API ========== */
    addAction(id,fn){ this.actions[id]=fn; }
    applyTheme(){
      Object.entries(this.actions).forEach(([id,fn])=>{
        fn&&fn({
          setting : this.settingsManager.get(id),
          changed : this.settingsManager.hasChanged(id),
          styles  : this.stylesManager,
          settings: this.settingsManager,
          state   : this.player.state
        });
      });
      this.applyStyles();
    }
    applyStyles(){
      let tag=document.getElementById(`${this.id}-styles`);
      if(!tag){ tag=document.createElement('style'); tag.id=`${this.id}-styles`; document.head.appendChild(tag); }
      tag.textContent=this.stylesManager.result;
    }
    async update(){ await this.settingsManager.update(); if(this.settingsManager.settings) this.applyTheme(); }
    start(ms=2000){ this.update(); setInterval(()=>this.update(),ms); }

    /* helper */
    static getThemeId(){
      try{
        const s=[...document.querySelectorAll('script[src]')].find(x=>x.src.includes('script.js'))?.src||'';
        const p=s.split('/'); return p[p.indexOf('SpotCol-Scripts')+1]||'unknown';
      }catch{ return 'unknown'; }
    }
  }

  /*═══════════════ 7. Экспорт в window ═══════════════*/
  window.EventEmitter     = EventEmitter;
  window.StylesManager    = StylesManager;
  window.SettingsManager  = SettingsManager;
  window.AssetsManager    = AssetsManager;
  window.PlayerEvents     = PlayerEvents;
  window.Theme            = Theme;

  window.WolfyLibrary = { EventEmitter, StylesManager, SettingsManager, AssetsManager, PlayerEvents, Theme };
  dbg('library loaded (v5.0)');
})();
