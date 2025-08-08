(() => {
  if (window.Library) return;     // защита от двойной загрузки
  const DEBUG = !!window.__DEBUG__;
  console.log('[Library] v1.2.6');
  const log   = (...a) => DEBUG && console.log('[Library]', ...a);

  const coverURL = () => {
    const imgMini = document.querySelector('div[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
    if (imgMini?.src) return imgMini.src;

    const imgFull = document.querySelector('[data-test-id="FULLSCREEN_PLAYER_MODAL"] img[data-test-id="ENTITY_COVER_IMAGE"]');
    if (imgFull?.src) return imgFull.src;

    const any = document.querySelector('img[data-test-id="ENTITY_COVER_IMAGE"]');
    return any?.src || null;
  };

  const getHiResCover = () => {
    const img = document.querySelector('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover"] img');
    return img?.src?.includes('/100x100') ? img.src.replace('/100x100', '/1000x1000') : null;
  };

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  EventEmitter
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class EventEmitter {
    #ev = Object.create(null);
    on   (e, fn) { (
      this.#ev[e] ??= []).push(fn); 
      return this; 
    }
    once (e, fn) { 
      const g = (...a)=>{
        this.off(e,g);fn(...a);
      }; 
      return this.on(e,g); }
    off  (e, fn) { 
      this.#ev[e] = (
        this.#ev[e] || []).filter(f=>f!==fn); 
        return this; 
      }
    emit (e, d ) { (
      this.#ev[e] || []).forEach(f=>f(d)); 
      return this; 
    }
    removeAll(e) {
       e ? delete this.#ev[e] : this.#ev = Object.create(null); 
    }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  StylesManager
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class StylesManager {
    #bag = {};
    #id  = 'style';
    #flush() {
      let tag = document.getElementById(this.#id);
      if (!tag) { tag = document.createElement('style'); 
        tag.id = this.#id; 
        document.head.appendChild(tag); 
      }
      tag.textContent = Object.values(this.#bag).join('\n\n');
    }
    add(id, css)    { if (!id||!css) return; this.#bag[id] = css.toString(); this.#flush(); }
    remove(id)      { delete this.#bag[id]; this.#flush(); }
    clear()         { this.#bag = {}; this.#flush(); }
    has(id)         { return Object.hasOwn(this.#bag, id); }
    get keys()      { return Object.keys(this.#bag); }
    get size()      { return this.keys.length; }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  SettingsManager  (расширенный)
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class SettingsManager extends EventEmitter {
    #theme;
    #cur   = {};
    #prev  = {};
    constructor(theme) { 
      super(); 
      this.#theme = theme; 
    }
    /* util */
    #pick(obj, path) { return path.split('.').reduce((o,k)=>o?.[k], obj); }

    /* public API */
    get(id)          { return this.#pick(this.#cur, id); }
    has(id)          { return this.#pick(this.#cur, id) !== undefined; }
    getAll()         { return structuredClone(this.#cur); }
    hasChanged(id)   { return JSON.stringify(
      this.#pick(this.#cur,id)) !== JSON.stringify(this.#pick(this.#prev,id)); }
    onChange(id, cb) { this.on(`change:${id}`, cb); }
    defaults(obj)    { for (const [k,v] of Object.entries(obj)) if (!this.has(k)) this.#silentSet(k,v); this.emit('update', {settings:this}); }

    /* загрузка с PulseSync Controls */
    async update() {
      try {
        const url = `http://localhost:2007/get_handle?name=${encodeURIComponent(this.#theme.id)}`;
        const r   = await fetch(url, {cache:'no-store'}); if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { data } = await r.json(); if (!data?.sections) { log('settings: no sections'); return; }
        this.#prev = structuredClone(this.#cur);
        this.#cur  = this.#transform(data.sections);
        this.emit('update', {settings:this});
        for(const id of Object.keys(this.#cur))
          if (this.hasChanged(id)) this.emit(`change:${id}`, {settings:this});
      } catch(e){ console.error('[SettingsManager]', e); }
    }

    /* преобразование API → плоский объект */
    #transform(sections) {
      const out = {};
      for(const s of sections){
        for(const it of s.items){
          if(it.type==='text' && it.buttons){
            out[it.id] = {};
            for(const b of it.buttons) out[it.id][b.id] = { value:b.text, default:b.defaultParameter };
          } else {
            const v = it.bool ?? it.input ?? it.filePath ?? it.selected ?? it.value;
            out[it.id] = { value:v, default:it.defaultParameter };
          }
        }
      }
      return out;
    }

    #silentSet(path,val){
      const keys = path.split('.'); let o=this.#cur;
      keys.slice(0,-1).forEach(k=>{ if(!o[k]) o[k] = {}; o=o[k]; });
      o[keys.at(-1)] = val;
    }
  }
  /* ════════════════════════════════════════════════════════════════════════════════════
   *                                          UI
   * ══════════════════════════════════════════════════════════════════════════════════ */
  const UI = {
    /* --- helpers --- */
    _el(tag, styleObj = {}, parent = document.body, html='') {
      const n = document.createElement(tag);
      Object.assign(n.style, styleObj);
      if (html) n.innerHTML = html;
      parent.appendChild(n); return n;
    },

    /* --- alert (удаляется автоматически) --- */
    alert(msg, ms=2500) {
      const d = this._el('div',{
        position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',
        background:'#222',color:'#fff',padding:'10px 22px',borderRadius:'8px',
        font:'14px/1 sans-serif',opacity:0,transition:'opacity .25s',zIndex:9999
      },document.body,msg);
      requestAnimationFrame(()=>d.style.opacity=1);
      setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),250); }, ms);
    },

    /* --- modal (клик по фону или Esc закрывает) --- */
    modal(html) {
      const wrap = this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',
        alignItems:'center',justifyContent:'center',zIndex:10000});
      const box  = this._el('div',{maxWidth:'80vw',maxHeight:'80vh',overflow:'auto',background:'#111',color:'#eee',
        padding:'24px',borderRadius:'12px',fontFamily:'sans-serif'},wrap,html);
      wrap.addEventListener('click',e=>e.target===wrap&&wrap.remove());
      const esc = e=>{ if(e.key==='Escape'){wrap.remove();document.removeEventListener('keydown',esc);} };
      document.addEventListener('keydown',esc);
    },

    /* --- confirm (promise) --- */
    confirm(text, ok='OK', cancel='Cancel') {
      return new Promise(res=>{
        const wrap=this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000});
        const panel=this._el('div',{background:'#222',color:'#fff',padding:'20px',borderRadius:'10px',minWidth:'260px',fontFamily:'sans-serif',textAlign:'center'},wrap);
        this._el('div',{marginBottom:'12px',fontSize:'15px'},panel,text);
        const row=this._el('div',{display:'flex',gap:'8px',justifyContent:'center'},panel);
        const mkBtn=(t,v)=>{const b=this._el('button',{padding:'6px 16px',background:'#444',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'},row,t); b.onclick=()=>{wrap.remove();res(v);} };
        mkBtn(ok,true); mkBtn(cancel,false);
      });
    },

    /* --- prompt (promise) --- */
    prompt(label, placeholder='', ok='OK', cancel='Cancel'){
      return new Promise(res=>{
        const wrap=this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000});
        const panel=this._el('div',{background:'#222',color:'#fff',padding:'20px',borderRadius:'10px',minWidth:'260px',fontFamily:'sans-serif'},wrap);
        this._el('div',{marginBottom:'8px'},panel,label);
        const input=document.createElement('input');
        Object.assign(input.style,{width:'100%',padding:'6px',marginBottom:'12px',border:'1px solid #555',borderRadius:'6px',background:'#111',color:'#eee'});
        input.placeholder=placeholder; panel.appendChild(input); input.focus();
        const row=this._el('div',{display:'flex',gap:'8px',justifyContent:'right'},panel);
        const mk=(t,v)=>{const b=this._el('button',{padding:'6px 16px',background:'#444',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'},row,t); b.onclick=()=>{wrap.remove();res(v);} };
        mk(cancel,null); mk(ok,null); row.lastChild.onclick = ()=>{wrap.remove();res(input.value);} ;
      });
    },

    /* --- toast (правый верх, стек) --- */
    toast(msg, ms=3000){
      const areaId='toast-area';
      let area=document.getElementById(areaId);
      if(!area){ area=this._el('div',{position:'fixed',top:'16px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:10000}); area.id=areaId; }
      const itm=this._el('div',{background:'#333',color:'#fff',padding:'10px 16px',borderRadius:'8px',font:'14px/1 sans-serif',opacity:0,transition:'opacity .2s'},area,msg);
      requestAnimationFrame(()=>itm.style.opacity=1);
      setTimeout(()=>{itm.style.opacity=0; setTimeout(()=>itm.remove(),200);},ms);
    },

    /* --- simple progress bar (returns {update,finish}) --- */
    progressBar(initial=0){
      const bar=this._el('div',{position:'fixed',bottom:0,left:0,height:'4px',width:'0%',background:'#1db954',transition:'width .1s',zIndex:9999});
      const update=p=>bar.style.width=`${Math.min(100,Math.max(0,p))}%`;
      const finish=()=>{bar.remove();};
      update(initial); return {update,finish};
    }
  };

// UI — универсальные хелперы для модулей (кроссфейд обложки, текст, шина треков)
window.Library = window.Library || {};
Library.initUI = function initUI() {
  const L  = (window.Library = window.Library || {});
  if (L.ui?.bindTrackUI && L.onTrack) return; // уже инициализировано

  const UI = (L.ui = L.ui || {});
  const U  = (L.util = L.util || {});
  const H  = (L._trackHandlers = L._trackHandlers || new Set());

U.coverURLFromTrack = function coverURLFromTrack(t) {
  const norm = (u) => {
    if (!u) return null;
    if (typeof u !== 'string') return null;
    // ЯМ-форматы
    if (u.includes('%%')) u = u.replace('%%', '1000x1000');
    if (u.includes('/100x100')) u = u.replace('/100x100', '/1000x1000');
    // протокол
    return /^https?:\/\//.test(u) ? u : `https://${u}`;
  };

  const url =
    norm(t?.coverUri) ||
    norm(t?.album?.coverUri) ||
    norm(t?.albums?.[0]?.coverUri) ||
    norm(t?.ogImage) ||
    norm(t?.cover?.uri) ||
    norm(t?.coverUrl);

  if (url) return url;

  // фолбэк: что видно в плеере прямо сейчас
  return (typeof L.getHiResCover === 'function' && L.getHiResCover()) ||
         (typeof L.coverURL      === 'function' && L.coverURL())      ||
         null;
};
UI.crossfade = function crossfade(elOrSel, url, { duration = 600 } = {}) {
  if (!url) return;
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;

  // если URL тот же, но текущей картинки нет — всё равно ставим
  if (el.dataset?.bg === url) {
    const hasCurrent = el.querySelector('img._ui_cf.current');
    if (hasCurrent) return;
  }

  const reqId = ((el.dataset?.reqId ? parseInt(el.dataset.reqId, 10) : 0) + 1) || 1;
  el.dataset.reqId = String(reqId);

  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';

  const pre = new Image();
  pre.decoding = 'async';
  pre.src = url;

  pre.onload = () => {
    if (el.dataset.reqId !== String(reqId)) return; // устаревший onload

    const prev = el.querySelector('img._ui_cf.current');

    const next = document.createElement('img');
    next.className = '_ui_cf current';
    next.alt = '';
    next.src = url;
    next.style.cssText = `
      position:absolute; inset:0;
      width:100%; height:100%;
      object-fit:cover;
      opacity:0; transition:opacity ${duration}ms ease;
      pointer-events:none; will-change:opacity;
    `;

    el.appendChild(next);

    requestAnimationFrame(() => {
      next.style.opacity = '1';
      if (prev) {
        prev.classList.remove('current');
        prev.classList.add('old');
        prev.style.transition = `opacity ${Math.max(300, duration - 150)}ms ease`;
        prev.style.opacity = '0';
        prev.addEventListener('transitionend', () => prev.remove(), { once: true });
        setTimeout(() => prev.isConnected && prev.remove(), Math.max(350, duration + 120));
      }
    });

    // лимит в контейнере: не более 2 картинок
    const imgs = el.querySelectorAll('img._ui_cf');
    for (let i = 0; i < imgs.length - 2; i++) {
      if (imgs[i] !== next && imgs[i] !== prev) imgs[i].remove();
    }

    if (el.dataset) el.dataset.bg = url;

    if (window.Library?.debugUI) {
      const cnt = el.querySelectorAll('img._ui_cf').length;
      console.log('[crossfade] url=', url, 'imgs=', cnt, 'bg=', el.dataset.bg);
    }
  };

  pre.onerror = () => {
    if (window.Library?.debugUI) console.warn('[crossfade] onerror', url);
  };
};

// Текстовый апдейтер
  UI.setText = function setText(elOrSel, text) {
    const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
    if (!el) return;
    el.textContent = text ?? '';
  };
// Единая шина событий смены трека (с фолбэк-вотчером)
L.onTrack = function onTrack(handler, { immediate = true } = {}) {
  H.add(handler);

  if (!L._busInit) {
    L._busInit = true;

    const emit = (t, tag='') => {
      if (!t) return;
      if (window.Library?.debugUI) console.log('[onTrack:emit]', tag, t?.title || t?.name, t);
      for (const fn of H) { try { fn(t); } catch (_) {} }
    };

    const tp = window.Theme?.player;
    if (tp?.on) {
      tp.on('trackChange', ({ state }) => emit(state?.track, 'event:trackChange'));
      tp.on('openPlayer',  ({ state }) => emit(state?.track, 'event:openPlayer'));
    }

    if (window.Player?.on) {
      window.Player.on('trackChange', ({ state }) => emit(state?.track, 'alias:trackChange'));
      window.Player.on('openPlayer',  ({ state }) => emit(state?.track, 'alias:openPlayer'));
    }

    if (typeof L.trackWatcher === 'function') {
      try { L.trackWatcher((t) => emit(t, 'custom:watcher')); } catch (_) {}
    }

    let lastId = null;
    setInterval(() => {
      const s = tp?.state?.track || tp?.getCurrentTrack?.() || L.getCurrentTrack?.();
      const id = s?.id || s?.trackId || s?.uuid || (s ? `${s.title}|${s?.album?.id || s?.albums?.[0]?.id || ''}` : null);
      if (!id) return;
      if (id !== lastId) { lastId = id; emit(s, 'poll'); }
    }, 800);

    const cur = tp?.getCurrentTrack?.() || tp?.state?.track || L.getCurrentTrack?.();
    if (cur) setTimeout(() => emit(cur, 'initial'), 0);
  }

  if (immediate) {
    const tp = window.Theme?.player;
    const cur = tp?.getCurrentTrack?.() || tp?.state?.track || L.getCurrentTrack?.();
    if (cur) handler(cur);
  }

  return () => H.delete(handler);
};

  UI.bindTrackUI = function bindTrackUI(map, opts = {}) {
    const update = (track) => {
      if (map.cover)  UI.crossfade(map.cover, U.coverURLFromTrack(track), opts);
      if (map.title)  UI.setText(map.title,  track?.title || track?.name || '');
      if (map.artist) UI.setText(map.artist, (track?.artists || []).map(a => a.name || a).join(', '));
    };
    const off = L.onTrack(update, { immediate: true });
    return () => off && off();
  };

UI.updateTrackUI = function updateTrackUI(map, track, opts = {}) {
  if (!track) return;
  if (map.cover)  UI.crossfade(map.cover, U.coverURLFromTrack(track), opts);
  if (map.title)  UI.setText(map.title,  track.title || track.name || '');
  if (map.artist) UI.setText(map.artist, (track.artists || []).map(a => a.name || a).join(', '));
};

};

/* ========================================================================== *
 *  PlayerEvents – полноценная обёртка над window.player (Yandex Music)
 * ========================================================================== */
class PlayerEvents extends EventEmitter {
  #theme;
  state = {
    status : 'paused',
    page   : location.pathname,
    volume : 0,
    shuffle: false,
    repeat : 'none',
    progress:{ duration:0, position:0, loaded:0, played:0 },
    track   : {}
  };

  constructor(theme){
    super();
    this.#theme = theme;
    this.#wait();        // ждём инициализации window.player
    this.#watchPage();   // отлавливаем смену URL
  }

  /* ---------- ожидание window.player ---------- */
  #wait(){
    const iv = setInterval(()=>{
      if (window?.player?.state?.playerState &&
          window?.player?.state?.queueState?.currentEntity?.value?.entity?.data?.meta){
        clearInterval(iv);
        this.#hook();
      }
    }, 400);
  }

  /* ---------- подписки на observables ---------- */
  #hook(){
    const ps = player.state.playerState;
    const qs = player.state.queueState;

    this.state.track  = qs.currentEntity.value.entity.data.meta;
    this.state.volume = ps.volume.value;
    this.emit('trackChange', { state:this.state });

    ps.status.onChange(s=>{
      this.state.status = s==='loadingMediaData' ? 'paused' : s;
      this.emit(s==='playing' ? 'play' : 'pause', { state:this.state });
      if (s==='loadingMediaData'){
        this.state.track = qs.currentEntity.value.entity.data.meta;
        this.emit('trackChange', { state:this.state });
      }
    });

    ps.event.onChange(ev=>{
      if (ev==='audio-set-progress') this.emit('seek', { state:this.state });
    });

    ps.progress.onChange(p=>{
      this.state.progress = p;
      this.emit('progress', { state:this.state });
    });

    ps.volume.onChange(v=>{
      this.state.volume = Math.round(v*100)/100;
      this.emit('volume', { state:this.state });
    });

    qs.shuffle.onChange(sh=>{
      this.state.shuffle = sh;
      this.emit('shuffle', { state:this.state });
    });

    qs.repeat.onChange(r=>{
      this.state.repeat = r;
      this.emit('repeat', { state:this.state });
    });

    qs.currentEntity.onChange(()=>{
      this.state.track = qs.currentEntity.value.entity.data.meta;
      this.emit('trackChange', { state:this.state });
    });

    /* ---------- fullscreen‑player / lyrics / queue ---------- */
    const test = {
      player : n => n.querySelector?.('[data-test-id="FULLSCREEN_PLAYER_MODAL"]'),
      text   : n => n.querySelector?.('[data-test-id="SYNC_LYRICS_CONTENT"]'),
      queue  : n => n.querySelector?.('.PlayQueue_root__ponhw')
    };
    new MutationObserver(muts=>{
      muts.forEach(mu=>{
        mu.addedNodes.forEach(n=>{
          if (test.player(n)) this.emit('openPlayer',  { state:this.state });
          if (test.text  (n)) this.emit('openText',    { state:this.state });
          if (test.queue (n)) this.emit('openQueue',   { state:this.state });
        });
        mu.removedNodes.forEach(n=>{
          if (test.player(n)) this.emit('closePlayer', { state:this.state });
          if (test.text  (n)) this.emit('closeText',   { state:this.state });
          if (test.queue (n)) this.emit('closeQueue',  { state:this.state });
        });
      });
    }).observe(document.body,{ childList:true, subtree:true });
  }

  /* ---------- слежение за сменой URL ---------- */
  #watchPage(){
    const upd = () => {
      const p = location.pathname;
      if (p !== this.state.page){
        this.state.page = p;
        this.emit('pageChange', { state:this.state });
      }
    };
    ['pushState','replaceState'].forEach(fn=>{
      const o = history[fn];
      history[fn] = function(...a){ o.apply(this,a); upd(); };
    });
    addEventListener('popstate', upd);
  }

  /* ---------- безопасный getter текущего трека ---------- */
  getCurrentTrack() {
    if (this.state?.track?.title) return this.state.track;

    try {
      const src = coverURL();
      const titleEl = document.querySelector('[class*="TrackInfo_title"]');
      const artistEls = [...document.querySelectorAll('[class*="TrackInfo_artists"] a')];

      return {
        coverUri: src?.split('https://')[1]?.replace('100x100', '%%') || '',
        title: titleEl?.textContent || '',
        artists: artistEls.map(a => ({ name: a.textContent }))
      };
    } catch (e) {
      console.warn('[PlayerEvents] getCurrentTrack() fallback error:', e);
      return {};
    }
  }
}


// 📦 Добавление SpotifyScreen в библиотеку
class SpotifyScreen {
  #theme;
  #player;
  #root = null;
  #bg = null;
  #cover = null;
  #track = null;
  #artist = null;
  #like = null;
  #origLike = null;
  #observer = null;
  #prevLiked = null;

  constructor(theme) {
    this.#theme = theme;
    this.#player = theme?.player;

    if (!this.#player) {
      console.warn('[SpotifyScreen] Нет player, инициализация невозможна.');
      return;
    }

    this.#player.on('openPlayer',  ({ state }) => this.#update(state));
    this.#player.on('trackChange', ({ state }) => this.#update(state));
  }

  #el(tag, cls, parent, txt = '') {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    (parent ?? document.body).appendChild(n);
    return n;
  }

  #isLiked(node) {
    if (!node) return false;
    if (node.getAttribute('aria-checked') !== null)
      return node.getAttribute('aria-checked') === 'true';
    return node.classList.contains('Like_active') ||
           !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
  }

  #syncState() {
    if (!this.#origLike || !this.#like) return;

    const src = this.#origLike.querySelector('svg');
    const dst = this.#like.querySelector('svg');

    if (src) dst ? dst.replaceWith(src.cloneNode(true))
                 : this.#like.appendChild(src.cloneNode(true));

    const liked = this.#isLiked(this.#origLike);
    this.#like.classList.toggle('Like_active', liked);
    if (liked !== this.#prevLiked) {
      this.#like.classList.add('animate');
      setTimeout(() => this.#like?.classList.remove('animate'), 350);
      this.#prevLiked = liked;
    }
  }

  #attachObserver() {
    if (this.#observer) this.#observer.disconnect();
    if (!this.#origLike) return;
    this.#observer = new MutationObserver(() => this.#syncState());
    this.#observer.observe(this.#origLike, { attributes: true, childList: true, subtree: true });
  }

  #findOriginalLike() {
    const sels = [
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'
    ];
    return sels.map(q => document.querySelector(q)).find(Boolean) || null;
  }

  #createClone() {
    this.#origLike = this.#findOriginalLike();
    this.#prevLiked = null;
    if (!this.#origLike) return this.#el('div', 'LikeTrack');

    const c = this.#origLike.cloneNode(true);
    c.classList.add('LikeTrack');
    c.removeAttribute('data-test-id');
    c.onclick = () => this.#origLike.click();

    this.#attachObserver();
    this.#syncState();

    return c;
  }

  #build() {
    if (this.#root) return;

    const layout = document.querySelector('div[class^="CommonLayout_root"]');
    const content = layout?.querySelector('div[class*="Content_rootOld"]');

    this.#root  = this.#el('div', 'Spotify_Screen');
    this.#bg    = this.#el('div', 'SM_Background', this.#root);
    this.#cover = this.#el('div', 'SM_Cover',      this.#root);

    if (content) {
      content.insertAdjacentElement('afterend', this.#root);
    } else if (layout) {
      layout.appendChild(this.#root);
    } else {
      document.body.appendChild(this.#root);
    }

    const row = this.#el('div', 'SM_Title_Line', this.#root);
    this.#track  = this.#el('div', 'SM_Track_Name', row);
    this.#like   = this.#createClone();
    row.appendChild(this.#like);
    this.#artist = this.#el('div', 'SM_Artist', this.#root);
  }

  #update(state) {
    this.#build();

    if (!this.#origLike || !document.contains(this.#origLike)) {
      const fresh = this.#createClone();
      this.#like.replaceWith(fresh);
      this.#like = fresh;
    }

    const t = state.track || {};
    const img = t.coverUri
      ? `https://${t.coverUri.replace('%%', '1000x1000')}`
      : 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/no-cover.png';

    this.#bg.style.background = `url(${img}) center/cover no-repeat`;

    let tag = this.#cover.querySelector('img');
    if (!tag) {
      tag = document.createElement('img');
      tag.alt = '';
      tag.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      `;
      this.#cover.appendChild(tag);
    }
    tag.src = img;
    this.#track.textContent  = t.title || '';
    this.#artist.textContent = (t.artists || []).map(a => a.name).join(', ');
    this.#syncState();
    this.#root.style.display = 'block';
  }

    trackWatcher(callback) {
    let lastTrackId = null;

    setInterval(() => {
      const player = window.YaAudio;
      if (!player || typeof player.getCurrentTrack !== 'function') return;

      const track = player.getCurrentTrack();
      if (!track || !track.id || track.id === lastTrackId) return;

      lastTrackId = track.id;

      try {
        callback(track);
      } catch (e) {
        console.error('[Library] trackWatcher error:', e);
      }
    }, 1000);
  }
}

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  Theme  (applyTheme, addAction, update, start, stop, destroy)
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class SonataState {
  constructor() {
    this.events = {};
  }

  on(event, handler) {
    this.events[event] ??= [];
    this.events[event].push(handler);
  }

  emit(event, payload) {
    (this.events[event] ?? []).forEach(fn => fn(payload));
  }
}

  
 class Theme {
  id; stylesManager; settingsManager; assetsManager; player;
  #ev = new EventEmitter(); #actions = {}; #loop = null; context = Object.create(null);

  constructor(id) {
    if (!id) throw Error('Theme id required');
    this.id = id;
    this.stylesManager = new StylesManager();
    this.settingsManager = new SettingsManager(this);
    this.sonataState = new SonataState();
    this.playerState = this.sonataState;

    if (typeof AssetsManager !== 'undefined')
      this.assetsManager = new AssetsManager();

    this.player = new PlayerEvents(this);
    this.#watchPageChanges(); // ← добавлено
    log('Theme', id, 'init');
  }

  #watchPageChanges() {
    let lastURL = location.href;
    setInterval(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        if (this.SpotifyScreen?.check instanceof Function) {
          this.SpotifyScreen.check();
        }
      }
    }, 1000);
  }

    /* --- события темы --- */
    on (...a){ this.#ev.on (...a); }
    off(...a){ this.#ev.off(...a); }
    emit(...a){ this.#ev.emit(...a); }

    /* --- context --- */
    ctx = Object.create(null);
    setContext(k,v){ this.ctx[k]=v; }
    getContext(k){ return this.ctx[k]; }

    /* --- actions (реакция на изменение конкретной настройки) --- */
    addAction(id, fn){ this.#actions[id]=fn; }

    /* --- применить тему = вызвать все actions и нарисовать CSS --- */
    applyTheme(){
      for(const id of Object.keys(this.#actions)){
        const changed = this.settingsManager.hasChanged(id);
        const val     = this.settingsManager.get(id);
        this.#actions[id]?.({value:val, changed, styles:this.stylesManager, settings:this.settingsManager, state:this.player.state });
      }
      /* собственно вставить CSS */
      this.stylesManager.clear();   // стили могли измениться внутри actions
      for(const [id,fn] of Object.entries(this.#actions))
        fn({value:this.settingsManager.get(id), changed:false, styles:this.stylesManager, settings:this.settingsManager, state:this.player.state });
    }

    /* --- update(): тянем настройки и применяем тему --- */
    async update(){ await this.settingsManager.update(); this.applyTheme(); }

    /* --- циклическое обновление --- */
    start(ms=2500){ if(this.#loop) return;
      const tick=async()=>{ try{ await this.update(); }finally{ this.#loop=setTimeout(tick,ms);} };
      tick();
    }
    stop(){ clearTimeout(this.#loop); this.#loop=null; }

    destroy(){ this.stop(); this.stylesManager.clear(); this.#actions={}; this.emit('destroy'); }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  Export
   * ══════════════════════════════════════════════════════════════════════════════════ */
window.Theme = Theme;
const existing = window.Library || {};
window.Library = Object.assign(existing, {
  EventEmitter, StylesManager, SettingsManager, UI, PlayerEvents, Theme, SpotifyScreen, coverURL, getHiResCover
});
  console.log('Library loaded ✓');
  /* ════════════════════════════════════════════════════════════════════════════════════
   *  Debug
   * ══════════════════════════════════════════════════════════════════════════════════ */
    Library.debugUI = true;
    // === Lightweight UI Debug Panel ===
Library.debug = (() => {
  const BOX_ID = 'SM_DebugBox';

  function ensure() {
    let box = document.getElementById(BOX_ID);
    if (box) return box;

    box = document.createElement('div');
    box.id = BOX_ID;
    box.innerHTML = `
      <div class="hdr">
        <strong>UI Debug</strong>
        <div class="btns">
          <button data-act="clear" title="Очистить">✕</button>
          <button data-act="hide"  title="Скрыть">⤫</button>
        </div>
      </div>
      <div class="body"></div>
    `;
    Object.assign(box.style, {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: 999999,
      width: '380px', maxWidth: '90vw', height: '220px', maxHeight: '50vh',
      borderRadius: '12px', overflow: 'hidden',
      background: 'rgba(20,20,25,.9)', color: '#ddd',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      boxShadow: '0 8px 28px rgba(0,0,0,.45)', backdropFilter: 'blur(6px)'
    });
    const hdr = box.querySelector('.hdr');
    Object.assign(hdr.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(255,255,255,.06)', padding: '6px 8px'
    });
    const btns = box.querySelector('.btns');
    Object.assign(btns.style, { display: 'flex', gap: '6px' });
    for (const b of btns.querySelectorAll('button')) {
      Object.assign(b.style, {
        background: 'rgba(255,255,255,.08)', color: '#eee',
        border: 'none', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer'
      });
    }
    const body = box.querySelector('.body');
    Object.assign(body.style, {
      padding: '6px 8px', height: 'calc(100% - 34px)',
      overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
    });

    box.addEventListener('click', (e) => {
      const act = e.target?.dataset?.act;
      if (act === 'clear') body.textContent = '';
      if (act === 'hide')  box.style.display = 'none';
    });

    document.body.appendChild(box);
    return box;
  }

  function fmt(arg) {
    if (arg == null) return String(arg);
    if (typeof arg === 'string') return arg;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }

  function log(...args) {
    if (!Library.debugUI) return;
    const box = ensure();
    const body = box.querySelector('.body');
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ` + args.map(fmt).join(' ');
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
    // дублируем в консоль
    try { console.log('[UI]', ...args); } catch {}
  }

  function clear() {
    const box = document.getElementById(BOX_ID);
    if (box) box.querySelector('.body').textContent = '';
  }

  function toggle() {
    Library.debugUI = !Library.debugUI;
    const box = ensure();
    box.style.display = Library.debugUI ? '' : 'none';
  }

  return { log, clear, toggle, ensure };
})();

})();
