/* =====================================================================
   Obs'EPS — Observation et suivi des élèves en EPS (PWA hors-ligne)
   Fusion de deux applis :
   - Biathlon (N'EPS) : échanges entre tablettes par QR / fichier, suivi par élève
     et par classe au fil des leçons, classes multiples, appel.
   - Gain EPS CA4 : appli élève entièrement paramétrable (1 ou 2 observés, boutons,
     disposition, indicateurs, rôles, conseils, résultats) et paramétrage en JSON.
   Données stockées sur l'appareil (localStorage).
   ===================================================================== */
'use strict';

const APP_VERSION = '1.0.0';
const ROOT_KEY = 'obseps_v1';
const QR_CHUNK = 440;

/* ---------------------------------------------------------------------
   Utilitaires
   --------------------------------------------------------------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v, d=1) => (v == null || !isFinite(v)) ? '—' : (Math.round(v * 10**d) / 10**d).toString().replace('.', ',');
const pct = v => v == null || !isFinite(v) ? '—' : fmt(v, 0) + ' %';
const now = () => Date.now();
function rnd(n){ const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const clone = o => JSON.parse(JSON.stringify(o));
const sum = a => a.reduce((x, y) => x + (+y || 0), 0);
const avg = a => { const v = a.filter(x => x != null && isFinite(x)); return v.length ? sum(v) / v.length : null; };
function capName(s){ return String(s || '').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()).trim(); }
function dateFR(ts){ const d = new Date(ts); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); }
function mmss(s){ s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function textOn(hex){ const h = String(hex || '#888').replace('#', ''); if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 > 150 ? '#111' : '#fff'; }

function toast(msg, ms=2400){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }

/* Fenêtres */
function modal(html, { wide, onOpen, noClose } = {}){
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
  const bg = root.firstElementChild;
  if (!noClose) bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  if (onOpen) onOpen(bg.firstElementChild);
  return bg.firstElementChild;
}
function closeModal(){ if (typeof stopScan === 'function') stopScan(); $('#modal-root').innerHTML = ''; }
function confirmBox(title, text, ok='Valider', danger=false){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2><p>${text}</p><div class="btn-row spread"><button class="btn ghost" data-r="0">Annuler</button><button class="btn ${danger ? 'red' : 'primary'}" data-r="1">${esc(ok)}</button></div>`);
    m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.r === '1'); });
  });
}
function promptBox(title, value='', { placeholder='', multiline=false, label='' } = {}){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2>${label ? `<p class="muted">${label}</p>` : ''}
      ${multiline ? `<textarea id="pb-in" rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input id="pb-in" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
      <div class="btn-row spread" style="margin-top:14px"><button class="btn ghost" data-r="0">Annuler</button><button class="btn primary" data-r="1">Valider</button></div>`);
    const inp = m.querySelector('#pb-in'); setTimeout(() => inp.focus(), 50);
    const done = ok => { const v = inp.value; closeModal(); res(ok ? v : null); };
    m.querySelector('[data-r="0"]').onclick = () => done(false);
    m.querySelector('[data-r="1"]').onclick = () => done(true);
    if (!multiline) inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); });
  });
}
function choiceBox(title, text, choices){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}<div class="btn-col">${choices.map((c, i) => `<button class="btn ${c.cls || ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}<button class="btn ghost" data-i="-1">Annuler</button></div>`);
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); const i = +b.dataset.i; res(i < 0 ? null : choices[i].value); });
  });
}

/* Images : redimensionnées pour rester légères (stockage local + fichiers JSON) */
function readImage(file, max=1100, q=0.8){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
      res(cv.toDataURL('image/jpeg', q)); }; img.onerror = () => rej(new Error('Image illisible')); img.src = r.result; };
    r.onerror = () => rej(new Error('Fichier illisible')); r.readAsDataURL(file);
  });
}
async function downloadFile(content, name, type='application/json'){
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  try { const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files:[f] }) && /iPad|iPhone|Android/i.test(navigator.userAgent)) { await navigator.share({ files:[f], title:name }); return; }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const stamp = () => new Date().toISOString().slice(0, 10);
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'x';

/* ---------------------------------------------------------------------
   Couleurs (équipes / chasubles)
   --------------------------------------------------------------------- */
const COLORS = [
  { n:'Bleu', c:'#1E5FD8' }, { n:'Rouge', c:'#E3262B' }, { n:'Vert', c:'#1FA24A' }, { n:'Jaune', c:'#FFD400' },
  { n:'Orange', c:'#FF7A00' }, { n:'Violet', c:'#8A2BE2' }, { n:'Rose', c:'#FF4FA3' }, { n:'Noir', c:'#1A1A1A' },
  { n:'Blanc', c:'#FFFFFF' }, { n:'Cyan', c:'#00B8D9' }, { n:'Marron', c:'#8B5A2B' }, { n:'Gris', c:'#8A94A6' }
];
const GROUP_COLORS = ['#8A94A6', '#1E5FD8', '#E3262B', '#1FA24A', '#FFD400', '#FF7A00', '#8A2BE2', '#FF4FA3', '#00B8D9'];
const CHART_COLORS = ['#1E5FD8', '#E3262B', '#1FA24A', '#FF7A00', '#8A2BE2', '#00B8D9', '#FF4FA3', '#8B5A2B', '#FFD400', '#1A1A1A'];

/* ---------------------------------------------------------------------
   Paramétrage de l'appli élève (modèle Gain EPS)
   --------------------------------------------------------------------- */
const MAX_BUTTONS = 24, MAX_INDIC = 4, MAX_ROLES = 3, MAX_DD = 3;
const bid = () => 'b' + rnd(4);
function defaultConfig(){
  const B = (name, pts) => ({ id: bid(), name, pts, color:'', exp:true });
  const buttons = [B('Tir réussi', 3), B('Tir raté', 0), B('Passe réussie', 1), B('Passe ratée', 0), B('Perte de balle', -1), B('Récupération', 2)];
  return {
    uid: rnd(8), rev: 1, at: now(),
    name: 'Handball', libelle: 'Joueur', nbObs: 2, image: '', guidance: 'Clique sur un bouton à chaque action de l\'élève observé.',
    buttons,
    layout: { cols: 4, rows: 2, cells: {}, bg: '', bgMode: 'identical', btnColor: 'team', counter: true, pts: true },
    dropdowns: [],
    recap: [{ label: 'Actions', formula: 'OA' }, { label: 'Score', formula: 'SA' }],
    indicators: [
      { id: 'i' + rnd(4), title: 'Efficacité au tir', btns: [buttons[0].id, buttons[1].id], num: [buttons[0].id], chart: 'pie', colors: {}, interp: 'Part des tirs réussis.',
        intervals: [0, 30, 60], conseils: { 0: 'Prends le temps de te rapprocher du but avant de tirer.', 30: 'C\'est bien : vise les angles pour marquer plus souvent.', 60: 'Très efficace : continue et aide tes partenaires !' } },
      { id: 'i' + rnd(4), title: 'Qualité des passes', btns: [buttons[2].id, buttons[3].id], num: [buttons[2].id], chart: 'bar', colors: {}, interp: '',
        intervals: [0, 50, 80], conseils: { 0: 'Regarde ton partenaire avant de passer.', 50: 'Passe plus vite au partenaire démarqué.', 80: 'Excellent jeu collectif !' } }
    ],
    roles: [
      { id: 'r' + rnd(4), name: 'Arbitre', levels: ['', 'Ne siffle pas', 'Siffle mais hésite', 'Siffle juste la plupart du temps', 'Siffle juste et explique ses décisions'] },
      { id: 'r' + rnd(4), name: 'Observateur', levels: ['', 'Oublie des actions', 'Note la plupart des actions', 'Note toutes les actions', 'Note tout et conseille l\'observé'] }
    ],
    timer: { on: true, dir: 'up', sec: 300 },
    results: { recap: true, table: true, indicators: true, conseils: true, roles: true, compare: true },
    allowEdit: true
  };
}
const TEMPLATES = {
  handball:  { name:'Handball', libelle:'Joueur', b:[['Tir réussi',3],['Tir raté',-1],['Passe décisive',2],['Interception',2],['Faute',-2],['But marqué',5],['Dribble réussi',1]] },
  badminton: { name:'Badminton', libelle:'Joueur', b:[['Smash gagnant',3],['Amorti',2],['Dégagement',1],['Service ace',3],['Faute',-2],['Point marqué',1],['Volée',2]] },
  boxe:      { name:'Boxe française', libelle:'Tireur', b:[['Direct',1],['Crochet',2],['Uppercut',3],['Esquive',1],['Touche reçue',-1],['Touche portée',2],['Parade',1]] },
  tennis:    { name:'Tennis de table', libelle:'Joueur', b:[['Service ace',3],['Coup droit gagnant',2],['Revers',1],['Smash',3],['Amorti',2],['Point gagné',1],['Faute',-2]] },
  volley:    { name:'Volley-ball', libelle:'Équipe', b:[['Attaque gagnante',3],['Attaque ratée',-1],['Réception réussie',1],['Réception ratée',-1],['Service réussi',1],['Service raté',-1],['Contre',2]] },
  lutte:     { name:'Lutte', libelle:'Lutteur', b:[['Amenée au sol',2],['Immobilisation',4],['Sortie de zone',1],['Passivité',-1],['Retournement',2],['Mise en danger',3]] }
};
function normConfig(c){
  const d = defaultConfig();
  c = { ...d, ...(c || {}) };
  c.layout = { ...d.layout, ...(c.layout || {}) }; c.layout.cells = c.layout.cells || {};
  c.timer = { ...d.timer, ...(c.timer || {}) };
  c.results = { ...d.results, ...(c.results || {}) };
  c.buttons = (c.buttons || []).map(b => ({ id: b.id || bid(), name: b.name || 'Bouton', pts: +b.pts || 0, color: b.color || '', exp: b.exp !== false }));
  c.dropdowns = (c.dropdowns || []).map(x => ({ id: x.id || 'd' + rnd(4), label: x.label || 'Liste', type: x.type === 'eleve' ? 'eleve' : 'simple', options: x.options || [] }));
  c.recap = (c.recap || []).slice(0, 3).map(r => ({ label: r.label || '', formula: r.formula || '' }));
  c.indicators = (c.indicators || []).map(i => ({ id: i.id || 'i' + rnd(4), title: i.title || 'Indicateur', btns: i.btns || [], num: i.num || [], chart: i.chart || 'pie', colors: i.colors || {}, interp: i.interp || '',
    intervals: (i.intervals && i.intervals.length ? i.intervals : [0, 50]).map(Number).sort((a, b) => a - b), conseils: i.conseils || {} }));
  c.roles = (c.roles || []).map(r => ({ id: r.id || 'r' + rnd(4), name: r.name || 'Rôle', levels: Array.from({ length: 5 }, (_, k) => (r.levels || [])[k] || '') }));
  c.nbObs = +c.nbObs === 2 ? 2 : 1;
  // on retire des cases les boutons supprimés
  Object.keys(c.layout.cells).forEach(k => { if (!c.buttons.some(b => b.id === c.layout.cells[k])) delete c.layout.cells[k]; });
  return c;
}
const cfgButton = id => CFG().buttons.find(b => b.id === id);

/* ---------------------------------------------------------------------
   État : ROOT = { deviceId, pin, role, active, classes, cfg, seance }
   classe = { id, name, nbLessons, current, students:[{id,nom,prenom,disp,grp}],
              lessons:{ n:{ title, att:{sid:'abs'|'inap'} } }, obs:{ id: observation } }
   observation = { id, cid, n, ts, d, dur, z:[{ s:[sid], col, c:{btnId:nb}, dd:{} }], r:[{ s, r:roleId, l }] }
   --------------------------------------------------------------------- */
let ROOT, S;
function newClass(name, id){ return { id: id || rnd(4), name: name || 'Classe', nbLessons: 8, current: 1, students: [], lessons: {}, obs: {} }; }
function normClass(c){
  c.nbLessons = +c.nbLessons || 8; c.current = Math.min(+c.current || 1, c.nbLessons);
  c.students = c.students || []; c.lessons = c.lessons || {}; c.obs = c.obs || {};
  c.students.forEach(s => { if (s.grp == null) s.grp = 0; });
  return c;
}
function loadRoot(){
  try { ROOT = JSON.parse(localStorage.getItem(ROOT_KEY)); } catch(e){ ROOT = null; }
  if (!ROOT || !ROOT.classes) ROOT = { v: 1, deviceId: rnd(4), pin: '0000', role: null, active: null, classes: {}, cfg: null, seance: null };
  if (!ROOT.deviceId) ROOT.deviceId = rnd(4);
  if (!ROOT.pin) ROOT.pin = '0000';
  ROOT.cfg = normConfig(ROOT.cfg);
  Object.values(ROOT.classes).forEach(normClass);
  if (!Object.keys(ROOT.classes).length) { const c = newClass('Classe 1'); ROOT.classes[c.id] = c; }
  if (!ROOT.classes[ROOT.active]) ROOT.active = Object.keys(ROOT.classes)[0];
  useClass(ROOT.active);
}
function useClass(id){ ROOT.active = id; S = ROOT.classes[id]; computeNames(); }
const CFG = () => ROOT.cfg;
function save(){
  try { localStorage.setItem(ROOT_KEY, JSON.stringify(ROOT)); }
  catch(e){ toast('⚠️ Mémoire pleine : supprimez des images ou faites une sauvegarde puis un nettoyage', 5000); }
  computeNames();
}
const isProf = () => ROOT.role === 'prof';

/* Noms affichés : prénom (+ initiale si homonyme) */
let NAMES = {};
function computeNames(){
  NAMES = {}; if (!S) return;
  const by = {};
  S.students.forEach(s => { const p = (s.prenom || s.disp || '').toLowerCase(); (by[p] = by[p] || []).push(s); });
  S.students.forEach(s => {
    if (!s.prenom) { NAMES[s.id] = s.disp || '?'; return; }
    const same = by[s.prenom.toLowerCase()];
    if (same.length < 2) { NAMES[s.id] = s.prenom; return; }
    let n = 1, label;
    do { label = s.prenom + ' ' + (s.nom || '').slice(0, n).toUpperCase() + '.'; n++; }
    while (n <= (s.nom || '').length && same.some(o => o !== s && (o.nom || '').slice(0, n - 1).toUpperCase() === (s.nom || '').slice(0, n - 1).toUpperCase()));
    NAMES[s.id] = label;
  });
}
const nameOf = id => NAMES[id] || '?';
const fullName = id => { const s = student(id); return s ? (s.nom ? (s.nom.toUpperCase() + ' ' + (s.prenom || '')) : (s.disp || '?')) : '?'; };
const student = id => S.students.find(s => s.id === id);
const sortedStudents = () => [...S.students].sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), 'fr'));
function newStudentId(c = S){ let id; do { id = rnd(4); } while (c.students.some(s => s.id === id)); return id; }

/* Leçons */
function lesson(n, c = S){ n = +n; if (!c.lessons[n]) c.lessons[n] = {}; const L = c.lessons[n]; L.att = L.att || {}; if (L.title == null) L.title = ''; return L; }
const curLesson = () => Math.min(S.current || 1, S.nbLessons);
const attOf = (n, sid) => lesson(n).att[sid] || null;
const present = (n, sid) => !attOf(n, sid);
const lessonLabel = n => `Leçon ${n}/${S.nbLessons}` + (lesson(n).title ? ' · ' + lesson(n).title : '');
const groupsUsed = () => [...new Set(S.students.map(s => s.grp || 0))].filter(g => g).sort((a, b) => a - b);

/* Observations */
const allObs = (c = S) => Object.values(c.obs || {}).filter(o => !o.del).sort((a, b) => a.ts - b.ts);
const obsOfLesson = n => allObs().filter(o => o.n === +n);
const obsWith = sid => allObs().filter(o => o.z.some(z => z.s.includes(sid)) || (o.r || []).some(r => r.s === sid));
function newObsId(){ return ROOT.deviceId + '-' + Date.now().toString(36) + rnd(2); }

/* ---------------------------------------------------------------------
   Formules (récapitulatif) : OA, SA, N, T, O1..On, A1..An, + - * / ( )
   Analyseur maison (pas d'eval)
   --------------------------------------------------------------------- */
function compileFormula(src){
  const s = String(src || '').toUpperCase().replace(/,/g, '.'); let i = 0;
  const tokens = [];
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; tokens.push({ t:'n', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
    if (/[A-Z]/.test(ch)) { let j = i; while (j < s.length && /[A-Z0-9]/.test(s[j])) j++; tokens.push({ t:'v', v: s.slice(i, j) }); i = j; continue; }
    if ('+-*/()'.includes(ch)) { tokens.push({ t:'o', v: ch }); i++; continue; }
    throw new Error('Caractère non autorisé : « ' + ch + ' »');
  }
  if (!tokens.length) throw new Error('Formule vide');
  let p = 0;
  const peek = () => tokens[p], take = () => tokens[p++];
  function expr(){ let n = term(); while (peek() && (peek().v === '+' || peek().v === '-')) { const op = take().v, a = n, b = term(); n = op === '+' ? (V => a(V) + b(V)) : (V => a(V) - b(V)); } return n; }
  function term(){ let n = factor(); while (peek() && (peek().v === '*' || peek().v === '/')) { const op = take().v, a = n, b = factor(); n = op === '*' ? (V => a(V) * b(V)) : (V => { const d = b(V); return d === 0 ? NaN : a(V) / d; }); } return n; }
  function factor(){
    const t = take(); if (!t) throw new Error('Formule incomplète');
    if (t.t === 'n') { if (isNaN(t.v)) throw new Error('Nombre invalide'); return () => t.v; }
    if (t.t === 'v') { const name = t.v; if (!/^(OA|SA|N|T|[OA]\d{1,2})$/.test(name)) throw new Error('Variable inconnue : ' + name); return V => V[name] ?? 0; }
    if (t.v === '-') { const f = factor(); return V => -f(V); }
    if (t.v === '(') { const e = expr(); if (!take() || tokens[p-1].v !== ')') throw new Error('Parenthèse manquante'); return e; }
    throw new Error('Formule invalide');
  }
  const f = expr();
  if (p < tokens.length) throw new Error('Formule invalide');
  return f;
}
function evalFormula(src, V){ try { const v = compileFormula(src)(V); return isFinite(v) ? v : null; } catch(e){ return null; } }

/* ---------------------------------------------------------------------
   Calculs : variables d'une équipe (zone) à partir des compteurs
   --------------------------------------------------------------------- */
function varsOf(counts, n=1, dur=0, cfg=CFG()){
  const V = { OA:0, SA:0, N: n || 1, T: (dur || 0) / 60 };
  cfg.buttons.forEach((b, i) => { const o = +(counts[b.id] || 0); V['O' + (i+1)] = o; V['A' + (i+1)] = o * b.pts; V.OA += o; V.SA += o * b.pts; });
  return V;
}
/* Indicateur : part de chaque bouton + valeur (boutons « numérateur » / boutons de l'indicateur) */
function indicatorOf(ind, counts){
  const btns = ind.btns.filter(id => cfgButton(id));
  const total = sum(btns.map(id => counts[id] || 0));
  const parts = btns.map((id, k) => ({ id, name: cfgButton(id).name, count: counts[id] || 0, pct: total ? (counts[id] || 0) / total * 100 : 0, color: ind.colors[id] || CHART_COLORS[k % CHART_COLORS.length] }));
  const num = (ind.num && ind.num.length ? ind.num : btns.slice(0, 1)).filter(id => btns.includes(id));
  const value = total ? sum(num.map(id => counts[id] || 0)) / total * 100 : null;
  return { total, parts, value };
}
function intervalIndex(ind, v){
  if (v == null) return -1; let k = -1;
  ind.intervals.forEach((x, i) => { if (v >= x) k = i; });
  return k;
}
function conseilOf(ind, v){ const k = intervalIndex(ind, v); if (k < 0) return null; const t = ind.conseils[ind.intervals[k]]; return t && t.trim() ? t : null; }
function intervalLabel(ind, k){ const a = ind.intervals[k], b = ind.intervals[k+1]; return b == null ? `${a} % et plus` : `${a} à ${b} %`; }

/* Bilan d'un élève sur une leçon (toutes ses observations cumulées) */
function studentLesson(sid, n){
  const list = obsOfLesson(n);
  const counts = {}; let nb = 0, dur = 0, N = 1;
  const roles = {};
  list.forEach(o => {
    o.z.forEach(z => { if (!z.s.includes(sid)) return; nb++; dur += o.dur || 0; N = z.s.length;
      Object.entries(z.c || {}).forEach(([k, v]) => counts[k] = (counts[k] || 0) + v); });
    (o.r || []).forEach(r => { if (r.s === sid && r.l != null) roles[r.r] = r.l; });
  });
  return { nb, counts, dur, N, roles, V: varsOf(counts, N, dur) };
}
/* Mesures disponibles pour le suivi */
function metrics(){
  const C = CFG(), m = [];
  C.indicators.forEach((ind, i) => m.push({ k: 'i' + i, label: ind.title, unit: '%', ind }));
  m.push({ k: 'SAm', label: 'Score moyen par observation', unit: 'pts' });
  C.recap.forEach((r, i) => { if (r.formula) m.push({ k: 'r' + i, label: r.label || r.formula, unit: '' }); });
  m.push({ k: 'nb', label: 'Nombre d\'observations', unit: '' });
  C.roles.forEach(r => m.push({ k: 'role:' + r.id, label: 'Rôle : ' + r.name, unit: '/4', role: r }));
  C.buttons.forEach(b => m.push({ k: 'o:' + b.id, label: 'Nb « ' + b.name + ' »', unit: '' }));
  return m;
}
function metricValue(mk, SL){
  if (mk === 'nb') return SL.nb || null;
  if (mk.startsWith('role:')) { const v = SL.roles[mk.slice(5)]; return v == null ? null : v; }
  if (!SL.nb) return null;
  if (mk === 'SAm') return SL.V.SA / SL.nb;
  if (mk.startsWith('o:')) return SL.counts[mk.slice(2)] || 0;
  if (mk[0] === 'i') { const ind = CFG().indicators[+mk.slice(1)]; return ind ? indicatorOf(ind, SL.counts).value : null; }
  if (mk[0] === 'r') { const r = CFG().recap[+mk.slice(1)]; return r ? evalFormula(r.formula, SL.V) : null; }
  return null;
}
function metricFmt(m, v){ if (v == null) return '—'; if (m.unit === '%') return pct(v); if (m.unit === '/4') return fmt(v, 0) + '/4'; return fmt(v); }

/* ---------------------------------------------------------------------
   Graphiques SVG (camembert, barres, courbe)
   --------------------------------------------------------------------- */
function pieSVG(parts, size=180){
  const tot = sum(parts.map(p => p.count)); if (!tot) return '';
  const r = size / 2 - 4, c = size / 2; let a0 = -Math.PI / 2, out = '';
  const nz = parts.filter(p => p.count);
  if (nz.length === 1) out = `<circle cx="${c}" cy="${c}" r="${r}" fill="${nz[0].color}" stroke="#fff" stroke-width="2"/>`;
  else nz.forEach(p => { const a1 = a0 + p.count / tot * Math.PI * 2;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    out += `<path d="M${c} ${c} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${p.color}" stroke="#fff" stroke-width="2"/>`; a0 = a1; });

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="pie">${out}</svg>`;
}
function barsHTML(parts){
  return `<div class="hbars">${parts.map(p => `<div class="hb"><span class="hb-l">${esc(p.name)}</span><span class="hb-t"><i style="width:${p.pct.toFixed(1)}%;background:${p.color}"></i></span><b>${fmt(p.pct, 0)} %</b></div>`).join('')}</div>`;
}
function legendHTML(parts){ return `<div class="legend">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.name)} : <b>${p.count}</b> (${fmt(p.pct, 0)} %)</span>`).join('')}</div>`; }
/* Courbe : series = [{ name, color, values:[v par leçon] }], labels = ['L1', ...] */
function lineSVG(series, labels, { min=null, max=null, unit='' } = {}){
  const W = 640, H = 240, pl = 44, pr = 14, pt = 14, pb = 30;
  const all = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  if (!all.length) return '<p class="muted">Pas encore de données.</p>';
  let lo = min != null ? min : Math.min(0, ...all), hi = max != null ? max : Math.max(...all);
  if (hi === lo) hi = lo + 1;
  const X = i => pl + (labels.length < 2 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (labels.length - 1));
  const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#dfe5ee"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="12" fill="#5b6478">${fmt(v, 0)}${unit}</text>`; }
  labels.forEach((l, i) => g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#5b6478">${esc(l)}</text>`);
  series.forEach(s => {
    let d = '', pen = false;
    s.values.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 3}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round"/>`;
    s.values.forEach((v, i) => { if (v != null && isFinite(v)) g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${s.dash ? 3 : 5}" fill="${s.color}"/>`; });
  });
  const leg = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="line-chart" preserveAspectRatio="xMidYMid meet">${g}</svg>${leg}`;
}
/* Couleur d'une cellule de tableau selon la valeur (0-100 % ou niveau 0-4) */
function heat(v, max=100){
  if (v == null) return '';
  const t = Math.max(0, Math.min(1, v / max));
  const stops = [[224, 49, 49], [255, 160, 50], [255, 212, 59], [134, 220, 150], [47, 158, 68]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
  const c = stops[i].map((x, k) => Math.round(x + (stops[i+1][k] - x) * u));
  return `background:rgb(${c.join(',')});color:${t > .85 || t < .15 ? '#fff' : '#111'}`;
}

loadRoot();
