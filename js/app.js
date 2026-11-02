/* =====================================================================
   Navigation, barre du haut, délégation des événements
   ===================================================================== */
'use strict';

const UI = { view: 'home', tab: 'menu', ptab: 'activite', profUnlocked: false, filter: null, sid: null, obsId: null, setup: null, live: null, metric: null, prev: null };
const A = {};      // actions (data-action)
const F = {};      // champs (data-field)
const FILES = {};  // fichiers (data-file)

function setTop(main, sub, right=''){
  $('#tb-main').textContent = main;
  $('#tb-sub').textContent = sub;
  $('#tb-right').innerHTML = right;
}
const DETAIL = ['result', 'suiviEleve'];
function go(view, opts = {}){
  if (DETAIL.includes(view) && !DETAIL.includes(UI.view)) UI.prev = { view: UI.view, tab: UI.tab };
  Object.assign(UI, opts); UI.view = view; render(); window.scrollTo(0, 0);
}
function back(){ const p = UI.prev || { view: 'home' }; UI.prev = null; if (p.tab) UI.tab = p.tab; go(p.view); }

function render(){
  stopScan();
  const m = $('#main');
  document.body.classList.toggle('obs-mode', UI.view === 'obs');
  if (!ROOT.role) { setTop('Obs\'EPS', 'Choix du rôle de la tablette'); m.innerHTML = viewRole(); return; }
  const prof = isProf();
  let v = UI.view;
  if (v === 'prof' && !(prof && UI.profUnlocked)) v = UI.view = 'home';
  if (v === 'home' && prof && UI.profUnlocked) { v = UI.view = 'prof'; }
  if (v === 'obs' && !UI.live) { const l = loadLive(); if (l) UI.live = l; else v = UI.view = 'home'; }
  const C = CFG(), sub = `🏫 ${S.name} · L${curLesson()}`;
  const homeBtn = `<button class="btn small light" data-action="go" data-view="home">⌂ Accueil</button>`;
  const backBtn = `<button class="btn small light" data-action="back">← Retour</button>`;
  const lockBtn = `<button class="btn small light" data-action="openProf" title="Espace enseignant">🔒</button>`;
  if (v === 'home') { setTop(C.name, (prof ? 'Tablette enseignant' : 'Tablette élève') + ' · ' + S.name, prof ? '' : lockBtn); m.innerHTML = prof ? viewHomeProfLocked() : viewHomeEleve(); }
  else if (v === 'setup') { setTop('Nouvelle observation', sub, homeBtn); m.innerHTML = viewSetup(); }
  else if (v === 'obs') { setTop(C.name, sub + ' · observation en cours', `<button class="btn small light" data-action="leaveObs">⌂</button>`); m.innerHTML = viewObs(); afterObs(); }
  else if (v === 'result') { setTop('Résultats', sub, backBtn + homeBtn); m.innerHTML = viewResult(); }
  else if (v === 'history') { setTop('Observations', sub, homeBtn); m.innerHTML = viewHistory(); }
  else if (v === 'suivi') { setTop('Suivi des élèves', sub, homeBtn); m.innerHTML = viewSuiviTiles(); }
  else if (v === 'suiviEleve') { setTop('Suivi · ' + nameOf(UI.sid), sub, backBtn); m.innerHTML = viewSuiviEleve(); }
  else if (v === 'send') { setTop('Envoyer au prof', sub, homeBtn); m.innerHTML = viewSend(); afterSend(); }
  else if (v === 'receive') { setTop('Recevoir la leçon', 'QR affiché par l\'enseignant', homeBtn); m.innerHTML = viewReceive(); afterReceive(); }
  else if (v === 'prof') {
    setTop('Espace enseignant', sub + ' · ' + C.name, `<button class="btn small light" data-action="lockProf" title="Verrouiller">🔓</button>`);
    m.innerHTML = viewProf();
    if (UI.tab === 'qr') afterQR();
    if (UI.tab === 'recup') afterRecup();
  }
}

/* ---------- Actions générales et parcours élève ---------- */
Object.assign(A, {
  go: d => go(d.view),
  back: () => back(),
  closeModal: () => closeModal(),
  setRole: async d => {
    if (d.r === 'eleve' && isProf() && !(await confirmBox('Passer en tablette élève ?', 'L\'espace enseignant restera accessible avec le code.', 'Passer en élève'))) return;
    ROOT.role = d.r; save(); UI.profUnlocked = d.r === 'prof'; UI.tab = 'menu'; go(d.r === 'prof' ? 'prof' : 'home');
    if (d.r === 'prof' && ROOT.pin === '0000') toast('Code enseignant par défaut : 0000 (à changer dans Sauvegarde & réglages)', 5000);
  },
  lockProf: () => { UI.profUnlocked = false; go('home'); },
  filter: d => { UI.filter = d.g ? +d.g : null; render(); },
  newObs: async () => {
    const l = loadLive();
    if (l) { const c = await choiceBox('Observation en cours', 'Une observation n\'est pas terminée.', [{ label: '▶ La reprendre', value: 'r', cls: 'primary' }, { label: '🗑 L\'abandonner', value: 'x', cls: 'red' }]);
      if (c === 'r') { UI.live = l; return go('obs'); } if (c !== 'x') return; clearLive(); }
    UI.setup = freshSetup(); go('setup');
  },
  resumeLive: () => { UI.live = loadLive(); go('obs'); },
  setupTarget: d => { UI.setup.target = d.k; render(); },
  setupReset: () => { UI.setup = freshSetup(); render(); },
  setupColor: (d, el, e) => { e.stopPropagation(); const zi = +d.k.slice(1);
    const m = modal(`<h2>Couleur de l'équipe ${zi + 1}</h2><div class="swatches">${COLORS.map(c => `<button class="sw" data-c="${c.c}" style="background:${c.c}" title="${c.n}"></button>`).join('')}</div>`);
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { UI.setup.zones[zi].col = b.dataset.c; closeModal(); render(); }); },
  setupPick: d => {
    const T = UI.setup, sid = d.sid, tk = T.target;
    const list = tk[0] === 'z' ? T.zones[+tk.slice(1)].s : T.roles[tk.slice(2)];
    if (!list) return;
    if (list.includes(sid)) list.splice(list.indexOf(sid), 1);
    else { const rm = a => { const i = a.indexOf(sid); if (i >= 0) a.splice(i, 1); };
      T.zones.forEach(z => rm(z.s)); Object.values(T.roles).forEach(rm); list.push(sid);
      if (attOf(curLesson(), sid)) toast(nameOf(sid) + ' est noté(e) ' + (attOf(curLesson(), sid) === 'abs' ? 'absent(e)' : 'inapte')); }
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  startObs: () => startLive(UI.setup),
  hit: d => hit(+d.z, d.b),
  undo: () => undo(),
  finishObs: () => finishObs(),
  leaveObs: () => { toast('Observation mise en pause : « Reprendre » depuis l\'accueil', 3000); const L = UI.live; if (L && L.running) { L.elapsed = liveElapsed(L); L.running = false; saveLive(); } UI.live = null; clearInterval(UI._tick); go('home'); },
  timerToggle: () => { const L = UI.live; if (L.running) { L.elapsed = liveElapsed(L); L.running = false; } else { L.running = true; L.runFrom = now(); } saveLive(); $('#timer-btn').textContent = L.running ? 'Pause' : '▶ Go'; },
  timerReset: async () => { if (!(await confirmBox('Remettre le chrono à zéro ?', '', 'Remettre à zéro'))) return; const L = UI.live; L.elapsed = 0; L.running = false; saveLive(); render(); },
  setLevel: d => { const o = S.obs[UI.obsId], r = o.r[+d.i]; r.l = r.l === +d.l ? null : +d.l; o.ts = now(); save(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  againObs: () => { const o = S.obs[UI.obsId]; const T = freshSetup({ zones: o.z.map(z => ({ s: z.s, col: z.col })), roles: {} });
    (o.r || []).forEach(r => { if (T.roles[r.r]) T.roles[r.r].push(r.s); }); startLive(T); },
  delObs: async d => { if (!(await confirmBox('Supprimer cette observation ?', 'Elle sera aussi supprimée chez l\'enseignant au prochain envoi.', 'Supprimer', true))) return;
    const o = S.obs[d.id]; o.del = 1; o.ts = now(); save(); toast('Observation supprimée'); back(); },
  openObs: d => go('result', { obsId: d.id }),
  suiviEleve: d => go('suiviEleve', { sid: d.sid }),
  fileMine: () => downloadFile(JSON.stringify(buildMine()), `saisies-${slug(S.name)}-tablette-${ROOT.deviceId}-${stamp()}.json`)
});
Object.assign(F, {
  metric: el => { UI.metric = el.value; render(); },
  dd: el => { const L = UI.live; if (!L) return; L.z[+el.dataset.z].dd[el.dataset.d] = el.value; saveLive(); }
});
FILES.json = async files => { for (const f of files) await importJSONFile(f); };

/* ---------- Délégation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.action]; if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  Promise.resolve(fn(el.dataset, el, e)).catch(err => { console.error(err); toast('⚠️ ' + err.message, 4000); });
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.file) { const fs = Array.from(el.files || []); el.value = ''; if (!fs.length) return; const h = FILES[el.dataset.file]; if (h) h(el.multiple || el.dataset.file === 'json' ? fs : fs[0]); return; }
  if (el.dataset.cfg) { const t = el.dataset.t; let v = t === 'bool' ? el.checked : t === 'num' ? parseFloat(String(el.value).replace(',', '.')) : el.value;
    if (t === 'num' && isNaN(v)) v = 0; setPath(CFG(), el.dataset.cfg, v); cfgChanged(!!el.dataset.rr); return; }
  if (el.dataset.field && F[el.dataset.field]) F[el.dataset.field](el);
});
window.addEventListener('beforeunload', e => { if (UI.view === 'obs' && UI.live) { saveLive(); } });

/* ---------- Démarrage ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#app-version').textContent = 'v' + APP_VERSION;
  if (loadLive() && ROOT.role) UI.view = 'home';
  render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
});
