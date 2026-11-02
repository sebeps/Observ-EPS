/* =====================================================================
   Parcours élève : accueil, préparation (observés + rôles), observation,
   résultats (graphiques, conseils, évaluation des rôles), suivi.
   ===================================================================== */
'use strict';

const LIVE_KEY = 'obseps_live';

/* ---------- Accueil ---------- */
function activityBanner(){
  const C = CFG();
  return `<div class="act-banner">${C.image ? `<img src="${C.image}" alt="">` : `<div class="act-ico">👀</div>`}
    <div><div class="act-name">${esc(C.name)}</div><div class="muted">${C.nbObs} observé${C.nbObs > 1 ? 's' : ''} · ${C.buttons.length} bouton(s)${C.roles.length ? ' · rôles : ' + esc(C.roles.map(r => r.name).join(', ')) : ''}</div></div></div>`;
}
function viewHomeEleve(){
  const has = S.students.length > 0, n = curLesson();
  const pres = S.students.filter(s => present(n, s.id)).length;
  const mine = allObs().filter(o => o.d === ROOT.deviceId).length;
  const live = loadLive();
  return `<div class="home">${activityBanner()}
    ${has ? `<div class="home-lesson"><div class="big">🏫 ${esc(S.name)} · Leçon ${n}/${S.nbLessons}</div>${lesson(n).title ? `<div class="strong">${esc(lesson(n).title)}</div>` : ''}
        <div class="muted">${pres}/${S.students.length} élève(s) présent(s)${ROOT.seance && ROOT.seance.cid === S.id ? ' · leçon reçue le ' + dateFR(ROOT.seance.at) : ''}</div></div>`
      : `<div class="home-lesson"><div class="big">Aucune leçon</div><div class="strong">Scanne le QR de la leçon affiché par ton enseignant.</div></div>`}
    ${live ? `<button class="btn orange big-btn" data-action="resumeLive">▶ Reprendre l'observation en cours</button>` : ''}
    <div class="home-grid">
      <button class="home-btn scan" data-action="go" data-view="receive"><span class="ico">📷</span>Recevoir la leçon</button>
      <button class="home-btn obs" data-action="newObs" ${has ? '' : 'disabled'}><span class="ico">👀</span>Nouvelle observation</button>
      <button class="home-btn stats" data-action="go" data-view="suivi" ${has ? '' : 'disabled'}><span class="ico">📊</span>Suivi des élèves</button>
      <button class="home-btn hist" data-action="go" data-view="history" ${has ? '' : 'disabled'}><span class="ico">🗂</span>Observations<small>${mine} sur cette tablette</small></button>
      <button class="home-btn send" data-action="go" data-view="send" ${mine ? '' : 'disabled'}><span class="ico">📤</span>Envoyer au prof</button>
    </div></div>`;
}
function viewHomeProfLocked(){
  return `<div class="home">${activityBanner()}
    <div class="home-lesson"><div class="big">🏫 ${esc(S.name)} · Leçon ${curLesson()}/${S.nbLessons}</div></div>
    <div class="home-grid two">
      <button class="home-btn prof" data-action="openProf"><span class="ico">🔒</span>Espace enseignant</button>
      <button class="home-btn obs" data-action="newObs" ${S.students.length ? '' : 'disabled'}><span class="ico">👀</span>Observer ici</button>
    </div></div>`;
}
function viewRole(){
  return `<div class="home">${activityBanner()}
    <div class="home-lesson"><div class="big">Cette tablette est…</div></div>
    <div class="home-grid two">
      <button class="home-btn prof" data-action="setRole" data-r="prof"><span class="ico">👩‍🏫</span>Tablette enseignant<small>Classes · paramétrage · QR de la leçon · suivi</small></button>
      <button class="home-btn obs" data-action="setRole" data-r="eleve"><span class="ico">🧒</span>Tablette élève<small>Recevoir la leçon · observer · envoyer</small></button>
    </div><p class="muted center">Modifiable ensuite (code enseignant). Les données de la tablette sont conservées.</p></div>`;
}

/* ---------- Préparation : choisir les observés et les rôles ---------- */
function freshSetup(prev){
  const C = CFG();
  const used = prev ? prev.zones.map(z => z.col) : [];
  const zones = Array.from({ length: C.nbObs }, (_, i) => ({ s: prev?.zones[i]?.s ? [...prev.zones[i].s] : [], col: prev?.zones[i]?.col || [COLORS[0].c, COLORS[1].c][i] }));
  const roles = {}; C.roles.forEach(r => roles[r.id] = prev?.roles?.[r.id] ? [...prev.roles[r.id]] : []);
  return { zones, roles, target: 'z0' };
}
function targetList(T){
  const C = CFG(), out = [];
  T.zones.forEach((z, i) => out.push({ k: 'z' + i, label: `${C.libelle || 'Observé'} ${C.nbObs > 1 ? i + 1 : ''}`.trim(), col: z.col, list: z.s, ico: '👀' }));
  C.roles.forEach(r => out.push({ k: 'r:' + r.id, label: r.name, col: '#5b6478', list: T.roles[r.id] || [], ico: '🎽' }));
  return out;
}
function whereIs(T, sid){
  const C = CFG(), w = [];
  T.zones.forEach((z, i) => { if (z.s.includes(sid)) w.push({ t: (C.libelle || 'Observé') + (C.nbObs > 1 ? ' ' + (i + 1) : ''), col: z.col }); });
  C.roles.forEach(r => { if ((T.roles[r.id] || []).includes(sid)) w.push({ t: r.name, col: '#5b6478' }); });
  return w;
}
function filterBar(){
  const G = groupsUsed(); if (!G.length) return '';
  return `<div class="filters"><button class="chip ${UI.filter ? '' : 'on'}" data-action="filter" data-g="">Tous</button>${G.map(g => `<button class="chip ${UI.filter === g ? 'on' : ''}" data-action="filter" data-g="${g}"><span class="dot" style="background:${GROUP_COLORS[g]}"></span>Groupe ${g}</button>`).join('')}</div>`;
}
const passFilter = s => !UI.filter || (s.grp || 0) === UI.filter;
function viewSetup(){
  const T = UI.setup || (UI.setup = freshSetup()), n = curLesson(), C = CFG();
  const targets = targetList(T);
  const list = sortedStudents().filter(passFilter);
  const ok = T.zones.every(z => z.s.length);
  return `<div class="card strong compact"><div class="row"><div class="grow"><b>1. Touche une case</b>, puis <b>2. touche les élèves</b> à y placer (touche à nouveau pour retirer).</div>
      <button class="btn small ghost" data-action="setupReset">Tout vider</button></div>
      <div class="targets">${targets.map(t => `<button class="target ${T.target === t.k ? 'on' : ''}" data-action="setupTarget" data-k="${t.k}" style="--tc:${t.col}">
        <span class="t-h">${t.ico} ${esc(t.label)}</span><span class="t-l">${t.list.length ? t.list.map(id => esc(nameOf(id))).join(', ') : '<i>personne</i>'}</span>
        ${t.k[0] === 'z' ? `<span class="t-col" data-action="setupColor" data-k="${t.k}" title="Changer la couleur">🎨</span>` : ''}</button>`).join('')}</div></div>
    ${filterBar()}
    <div class="tiles small">${list.map(s => { const w = whereIs(T, s.id), at = attOf(n, s.id);
      return `<button class="tile ${w.length ? 'picked' : ''} ${at ? 'off' : ''}" data-action="setupPick" data-sid="${s.id}">
        <span class="band" style="background:${GROUP_COLORS[s.grp || 0]}"></span><span class="name">${esc(nameOf(s.id))}</span>
        ${at ? `<span class="tag ${at === 'abs' ? 'abs' : 'inapte'}">${at === 'abs' ? 'Absent' : 'Inapte'}</span>` : ''}
        ${w.map(x => `<span class="pill" style="background:${x.col};color:${textOn(x.col)}">${esc(x.t)}</span>`).join('')}</button>`; }).join('') || '<p>Aucun élève.</p>'}</div>
    <div class="sticky-bottom"><button class="btn green big-btn" data-action="startObs" ${ok ? '' : 'disabled'}>▶ Commencer l'observation</button></div>`;
}

/* ---------- Observation en direct ---------- */
function loadLive(){ try { const l = JSON.parse(localStorage.getItem(LIVE_KEY)); return l && l.cid === S.id ? l : null; } catch(e){ return null; } }
function saveLive(){ if (UI.live) try { localStorage.setItem(LIVE_KEY, JSON.stringify(UI.live)); } catch(e){} }
function clearLive(){ UI.live = null; localStorage.removeItem(LIVE_KEY); clearInterval(UI._tick); }
function liveElapsed(L){ return L.elapsed + (L.running ? (now() - L.runFrom) / 1000 : 0); }
function startLive(T){
  const C = CFG();
  UI.live = { id: newObsId(), cid: S.id, n: curLesson(), started: now(), elapsed: 0, running: false, runFrom: 0,
    z: T.zones.map(z => ({ s: [...z.s], col: z.col, c: {}, dd: {} })),
    r: C.roles.flatMap(r => (T.roles[r.id] || []).map(sid => ({ s: sid, r: r.id, l: null }))), undo: [], setup: clone(T) };
  if (C.timer.on) { UI.live.running = true; UI.live.runFrom = now(); }
  saveLive(); go('obs');
}
/* Cases de la grille : disposition du prof, ou automatique dans l'ordre des boutons */
function gridCells(){
  const C = CFG(), L = C.layout, cells = {};
  const placed = Object.keys(L.cells).length;
  if (placed) Object.entries(L.cells).forEach(([k, id]) => { if (+k < L.cols * L.rows) cells[k] = id; });
  else C.buttons.forEach((b, i) => { if (i < L.cols * L.rows) cells[i] = b.id; });
  return cells;
}
function zoneGrid(zi, z, live=true){
  const C = CFG(), L = C.layout, cells = gridCells();
  const mirror = L.bgMode === 'mirror' && zi === 1;
  let h = '';
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    const k = r * L.cols + (mirror ? L.cols - 1 - c : c), id = cells[k], b = id && cfgButton(id);
    if (!b) { h += '<div class="cell"></div>'; continue; }
    const col = L.btnColor === 'button' && b.color ? b.color : z.col;
    h += `<div class="cell"><button class="obs-btn" ${live ? `data-action="hit" data-z="${zi}" data-b="${b.id}"` : 'disabled'} style="--bc:${col};color:${textOn(col)}">
      <span class="ob-n">${esc(b.name)}</span>${L.counter || L.pts ? `<span class="ob-i">${L.counter ? `<b id="cnt-${zi}-${b.id}">${z.c[b.id] || 0}</b>` : ''}${L.counter && L.pts ? ' × ' : ''}${L.pts ? `${b.pts > 0 ? '+' : ''}${b.pts} pt${Math.abs(b.pts) > 1 ? 's' : ''}` : ''}</span>` : ''}</button></div>`;
  }
  return `<div class="obs-grid" style="grid-template-columns:repeat(${L.cols},1fr);grid-template-rows:repeat(${L.rows},minmax(74px,1fr))">
    ${L.bg ? `<div class="obs-bg" style="background-image:url(${L.bg});${mirror ? 'transform:scaleX(-1)' : ''}"></div>` : ''}${h}</div>`;
}
function recapHTML(z, zi, dur){
  const C = CFG(), V = varsOf(z.c, z.s.length, dur);
  return C.recap.filter(r => r.formula).map((r, i) => `<span class="rc"><small>${esc(r.label)}</small><b id="rc-${zi}-${i}">${fmt(evalFormula(r.formula, V))}</b></span>`).join('');
}
function ddHTML(zi, z){
  const C = CFG(); if (!C.dropdowns.length) return '';
  return `<div class="dd-box">${C.dropdowns.map(d => `<label class="field">${esc(d.label)}
    <select data-field="dd" data-z="${zi}" data-d="${d.id}"><option value="">—</option>${
      (d.type === 'eleve' ? sortedStudents().map(s => [s.id, nameOf(s.id)]) : d.options.map(o => [o, o])).map(([v, t]) => `<option value="${esc(v)}" ${z.dd[d.id] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`).join('')}</div>`;
}
function viewObs(){
  const L = UI.live, C = CFG();
  if (!L) return '<p>Aucune observation en cours.</p>';
  const two = L.z.length > 1;
  return `<div class="obs-top">
      <div class="timer ${C.timer.on ? '' : 'hide'}"><span id="timer">${mmss(C.timer.dir === 'down' ? C.timer.sec - liveElapsed(L) : liveElapsed(L))}</span>
        <button class="btn small" data-action="timerToggle" id="timer-btn">${L.running ? 'Pause' : '▶ Go'}</button><button class="btn small ghost" data-action="timerReset">↺</button></div>
      ${C.guidance ? `<div class="guidance">💡 ${esc(C.guidance)}</div>` : '<div class="grow"></div>'}
      <button class="btn small" data-action="undo" id="undo-btn" ${L.undo.length ? '' : 'disabled'}>↶ Annuler</button>
      <button class="btn small green" data-action="finishObs">✓ Terminer</button></div>
    <div class="zones ${two ? 'two' : ''}">${L.z.map((z, zi) => `<section class="zone" style="--zc:${z.col}">
      <div class="zone-h" style="background:${z.col};color:${textOn(z.col)}"><b>${esc(z.s.map(nameOf).join(' · '))}</b><span class="recap">${recapHTML(z, zi, liveElapsed(L))}</span></div>
      ${zoneGrid(zi, z)}${ddHTML(zi, z)}</section>`).join('')}</div>
    ${L.r.length ? `<div class="muted center">🎽 ${L.r.map(r => esc(nameOf(r.s)) + ' (' + esc(C.roles.find(x => x.id === r.r)?.name || '') + ')').join(' · ')} — évaluation des rôles à la fin.</div>` : ''}`;
}
function afterObs(){
  clearInterval(UI._tick);
  const C = CFG();
  UI._tick = setInterval(() => {
    const L = UI.live, el = $('#timer'); if (!L || !el) return clearInterval(UI._tick);
    const t = liveElapsed(L);
    if (C.timer.dir === 'down') { const left = C.timer.sec - t; el.textContent = mmss(left);
      if (left <= 0 && L.running) { L.elapsed = C.timer.sec; L.running = false; saveLive(); const b = $('#timer-btn'); if (b) b.textContent = '▶ Go';
        el.parentElement.classList.add('end'); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); toast('⏰ Temps écoulé !', 4000); } }
    else el.textContent = mmss(t);
  }, 250);
}
function hit(zi, id){
  const L = UI.live; if (!L) return;
  const z = L.z[zi]; z.c[id] = (z.c[id] || 0) + 1; L.undo.push([zi, id]);
  if (!L.running && CFG().timer.on && L.elapsed === 0) { L.running = true; L.runFrom = now(); }
  saveLive(); if (navigator.vibrate) navigator.vibrate(25);
  refreshZone(zi, id);
}
function refreshZone(zi, id){
  const L = UI.live, z = L.z[zi];
  const c = $(`#cnt-${zi}-${id}`); if (c) { c.textContent = z.c[id] || 0; const b = c.closest('.obs-btn'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
  const V = varsOf(z.c, z.s.length, liveElapsed(L));
  CFG().recap.filter(r => r.formula).forEach((r, i) => { const e = $(`#rc-${zi}-${i}`); if (e) e.textContent = fmt(evalFormula(r.formula, V)); });
  const u = $('#undo-btn'); if (u) u.disabled = !L.undo.length;
}
function undo(){
  const L = UI.live; if (!L || !L.undo.length) return;
  const [zi, id] = L.undo.pop(); L.z[zi].c[id] = Math.max(0, (L.z[zi].c[id] || 0) - 1); if (!L.z[zi].c[id]) delete L.z[zi].c[id];
  saveLive(); refreshZone(zi, id); toast('Dernière action annulée', 1200);
}
async function finishObs(){
  const L = UI.live; if (!L) return;
  const tot = sum(L.z.map(z => sum(Object.values(z.c))));
  if (!(await confirmBox('Terminer l\'observation ?', tot ? `${tot} action(s) enregistrée(s).` : '⚠️ Aucune action enregistrée.', 'Terminer'))) return;
  const o = { id: L.id, cid: S.id, n: L.n, ts: now(), at: L.started, d: ROOT.deviceId, dur: Math.round(liveElapsed(L)),
    z: L.z.map(z => ({ s: z.s, col: z.col, c: z.c, dd: z.dd })), r: L.r, act: CFG().name };
  S.obs[o.id] = o; UI.lastSetup = L.setup; clearLive(); save();
  go('result', { obsId: o.id });
}

/* ---------- Résultats d'une observation ---------- */
function prevLessonValue(sids, n, ind){
  for (let k = n - 1; k >= 1; k--) {
    const counts = {}; let any = false;
    obsOfLesson(k).forEach(o => o.z.forEach(z => { if (z.s.length === sids.length && sids.every(s => z.s.includes(s))) { any = true; Object.entries(z.c).forEach(([b, v]) => counts[b] = (counts[b] || 0) + v); } }));
    if (any) return { k, v: indicatorOf(ind, counts).value };
  }
  return null;
}
function indicatorBlock(ind, counts, opts={}){
  const R = CFG().results, I = indicatorOf(ind, counts);
  if (!I.total) return `<div class="ind"><h4>${esc(ind.title)}</h4><p class="muted">Pas d'action observée pour cet indicateur.</p></div>`;
  const cons = R.conseils ? conseilOf(ind, I.value) : null;
  let cmp = '';
  if (R.compare && opts.sids) { const p = prevLessonValue(opts.sids, opts.n, ind);
    if (p && p.v != null) { const d = I.value - p.v; cmp = `<div class="cmp ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">Leçon ${p.k} : ${pct(p.v)} → aujourd'hui ${pct(I.value)} ${d > 0 ? '▲' : d < 0 ? '▼' : '='}</div>`; } }
  return `<div class="ind"><h4>${esc(ind.title)} <span class="ind-v">${pct(I.value)}</span></h4>
    ${ind.interp ? `<div class="muted small-t">${esc(ind.interp)}</div>` : ''}
    <div class="ind-body">${ind.chart === 'pie' ? pieSVG(I.parts, 150) + legendHTML(I.parts) : barsHTML(I.parts)}</div>
    ${cmp}${cons ? `<div class="advice">💡 ${esc(cons)}</div>` : ''}</div>`;
}
function viewResult(){
  const o = S.obs[UI.obsId]; if (!o) return '<p>Observation introuvable.</p>';
  const C = CFG(), R = C.results;
  let h = `<div class="card compact"><div class="row"><div class="grow"><b>${esc(o.act || C.name)}</b> · ${lessonLabel(o.n)} · ${dateFR(o.ts)} · durée ${mmss(o.dur)}</div>
    ${o.d === ROOT.deviceId || isProf() ? `<button class="btn small ghost" data-action="delObs" data-id="${o.id}">🗑 Supprimer</button>` : ''}</div></div>`;
  h += `<div class="zones ${o.z.length > 1 ? 'two' : ''}">`;
  o.z.forEach((z, zi) => {
    const V = varsOf(z.c, z.s.length, o.dur);
    h += `<section class="zone res" style="--zc:${z.col}"><div class="zone-h" style="background:${z.col};color:${textOn(z.col)}"><b>${esc(z.s.map(nameOf).join(' · '))}</b></div><div class="zone-b">`;
    if (R.recap && C.recap.some(r => r.formula)) h += `<div class="recap-big">${C.recap.filter(r => r.formula).map(r => `<div><small>${esc(r.label)}</small><b>${fmt(evalFormula(r.formula, V))}</b></div>`).join('')}</div>`;
    if (R.table) h += `<table class="simple"><tr><th>Bouton</th><th>Nb</th><th>Points</th></tr>${C.buttons.map(b => `<tr><td>${esc(b.name)}</td><td class="num">${z.c[b.id] || 0}</td><td class="num">${fmt((z.c[b.id] || 0) * b.pts)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="num">${V.OA}</td><td class="num">${fmt(V.SA)}</td></tr></table>`;
    const dds = C.dropdowns.filter(d => z.dd && z.dd[d.id]);
    if (dds.length) h += `<p class="muted">${dds.map(d => `${esc(d.label)} : <b>${esc(d.type === 'eleve' ? nameOf(z.dd[d.id]) : z.dd[d.id])}</b>`).join(' · ')}</p>`;
    if (R.indicators) h += C.indicators.map(ind => indicatorBlock(ind, z.c, { sids: z.s, n: o.n })).join('');
    h += `</div></section>`;
  });
  h += `</div>`;
  if (R.roles && (o.r || []).length) {
    h += `<div class="card"><h2>🎽 Évaluation des rôles</h2>${o.r.map((r, i) => { const role = C.roles.find(x => x.id === r.r); if (!role) return '';
      const lv = role.levels.map((t, k) => ({ t, k })).filter(x => x.t.trim());
      return `<div class="role-ev"><div class="strong">${esc(nameOf(r.s))} · <span class="muted">${esc(role.name)}</span></div>
        <div class="lvls">${(lv.length ? lv : [0,1,2,3,4].map(k => ({ t: 'Niveau ' + k, k }))).map(x => `<button class="lvl ${r.l === x.k ? 'on' : ''}" data-action="setLevel" data-i="${i}" data-l="${x.k}"><b>${x.k}</b> ${esc(x.t)}</button>`).join('')}</div></div>`; }).join('')}</div>`;
  }
  h += `<div class="btn-row center-row" style="margin:16px 0">
    <button class="btn primary" data-action="againObs">↻ Nouvelle observation (mêmes élèves)</button>
    <button class="btn" data-action="newObs">👀 Autres élèves</button>
    <button class="btn ghost" data-action="go" data-view="home">⌂ Accueil</button></div>`;
  return h;
}

/* ---------- Liste des observations ---------- */
function viewHistory(){
  const list = allObs().filter(o => isProf() || o.d === ROOT.deviceId).reverse();
  if (!list.length) return '<div class="card center">Aucune observation pour cette classe.</div>';
  return `<div class="card"><table class="simple clickable"><tr><th>Leçon</th><th>Date</th><th>Observé(s)</th><th>Actions</th></tr>${list.map(o => `<tr data-action="openObs" data-id="${o.id}">
    <td>L${o.n}</td><td>${dateFR(o.ts)}</td><td>${o.z.map(z => `<span class="pill" style="background:${z.col};color:${textOn(z.col)}">${esc(z.s.map(nameOf).join(', '))}</span>`).join(' ')}</td>
    <td class="num">${sum(o.z.map(z => sum(Object.values(z.c))))}</td></tr>`).join('')}</table></div>`;
}

/* ---------- Suivi : tuiles des élèves + fiche élève ---------- */
function mainMetric(){ const m = metrics(); return m.find(x => x.k === UI.metric) || m[0]; }
function metricSelect(){
  const m = metrics(), cur = mainMetric();
  return `<label class="field inline">Mesure suivie <select data-field="metric">${m.map(x => `<option value="${x.k}" ${x.k === cur.k ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`;
}
function viewSuiviTiles(){
  const M = mainMetric(), N = S.nbLessons, cur = curLesson();
  const list = sortedStudents().filter(passFilter);
  return `<div class="card compact"><div class="row">${metricSelect()}<span class="muted grow">Valeur de la dernière leçon observée · flèche = évolution</span></div></div>${filterBar()}
    <div class="tiles">${list.map(s => {
      const vals = Array.from({ length: N }, (_, i) => metricValue(M.k, studentLesson(s.id, i + 1)));
      const idx = vals.map((v, i) => v == null ? -1 : i).filter(i => i >= 0), last = idx.length ? vals[idx[idx.length - 1]] : null, prev = idx.length > 1 ? vals[idx[idx.length - 2]] : null;
      const nbCur = studentLesson(s.id, cur).nb;
      return `<button class="tile" data-action="suiviEleve" data-sid="${s.id}"><span class="band" style="background:${GROUP_COLORS[s.grp || 0]}"></span>
        <span class="name">${esc(nameOf(s.id))}</span>
        <span class="t-val">${metricFmt(M, last)} ${prev != null && last != null ? (last > prev ? '<span class="up">▲</span>' : last < prev ? '<span class="down">▼</span>' : '') : ''}</span>
        <span class="spark">${vals.map(v => `<i style="height:${v == null ? 2 : Math.max(4, Math.min(100, M.unit === '%' ? v : M.unit === '/4' ? v * 25 : 50))}%;${v == null ? 'opacity:.25' : ''}"></i>`).join('')}</span>
        <span class="meta">${nbCur} obs. leçon ${cur} · ${obsWith(s.id).length} au total</span></button>`; }).join('') || '<p>Aucun élève.</p>'}</div>`;
}
function viewSuiviEleve(){
  const sid = UI.sid, s = student(sid); if (!s) return '<p>Élève introuvable.</p>';
  const C = CFG(), N = S.nbLessons, labels = Array.from({ length: N }, (_, i) => 'L' + (i + 1));
  const SL = labels.map((_, i) => studentLesson(sid, i + 1));
  const M = metrics().filter(m => !m.k.startsWith('o:'));
  let h = `<div class="card strong compact"><div class="row"><h2 class="grow" style="margin:0">${esc(isProf() ? fullName(sid) : nameOf(sid))}</h2>
    ${s.grp ? `<span class="pill" style="background:${GROUP_COLORS[s.grp]};color:#fff">Groupe ${s.grp}</span>` : ''}<span class="muted">${obsWith(sid).length} observation(s)</span></div></div>`;
  if (C.indicators.length) h += `<div class="card"><h3>📈 Indicateurs au fil des leçons</h3>${lineSVG(C.indicators.map((ind, i) => ({ name: ind.title, color: CHART_COLORS[i], values: SL.map(x => metricValue('i' + i, x)) })), labels, { min: 0, max: 100, unit: '%' })}</div>`;
  h += `<div class="card"><h3>🏅 Score moyen par observation</h3>${lineSVG([{ name: 'Score', color: '#0b6bcb', values: SL.map(x => metricValue('SAm', x)) }], labels)}</div>`;
  if (C.roles.length && SL.some(x => Object.keys(x.roles).length)) h += `<div class="card"><h3>🎽 Rôles (niveau 0 à 4)</h3>${lineSVG(C.roles.map((r, i) => ({ name: r.name, color: CHART_COLORS[(i + 4) % 10], values: SL.map(x => x.roles[r.id] ?? null) })), labels, { min: 0, max: 4 })}</div>`;
  h += `<div class="card scroll-x"><h3>Tableau par leçon</h3><table class="simple"><tr><th>Leçon</th>${M.map(m => `<th>${esc(m.label)}</th>`).join('')}</tr>
    ${SL.map((x, i) => `<tr class="${i + 1 === curLesson() ? 'cur' : ''}"><td><b>L${i + 1}</b>${attOf(i + 1, sid) ? ` <span class="tag ${attOf(i + 1, sid) === 'abs' ? 'abs' : 'inapte'}">${attOf(i + 1, sid) === 'abs' ? 'Abs' : 'Inap'}</span>` : ''}</td>${M.map(m => { const v = metricValue(m.k, x);
      return `<td class="num" style="${m.unit === '%' ? heat(v) : m.unit === '/4' ? heat(v, 4) : ''}">${metricFmt(m, v)}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
  const lastI = SL.map((x, i) => x.nb ? i : -1).filter(i => i >= 0).pop();
  if (lastI != null && C.indicators.length) {
    const cs = C.indicators.map(ind => ({ ind, c: conseilOf(ind, indicatorOf(ind, SL[lastI].counts).value) })).filter(x => x.c);
    if (cs.length) h += `<div class="card"><h3>💡 Conseils (leçon ${lastI + 1})</h3>${cs.map(x => `<div class="advice"><b>${esc(x.ind.title)}</b> : ${esc(x.c)}</div>`).join('')}</div>`;
  }
  const list = obsWith(sid).reverse();
  h += `<div class="card"><h3>Observations</h3>${list.length ? `<table class="simple clickable"><tr><th>Leçon</th><th>Date</th><th>Rôle / équipe</th></tr>${list.map(o => {
    const z = o.z.find(z => z.s.includes(sid)), r = (o.r || []).find(r => r.s === sid);
    return `<tr data-action="openObs" data-id="${o.id}"><td>L${o.n}</td><td>${dateFR(o.ts)}</td><td>${z ? `<span class="pill" style="background:${z.col};color:${textOn(z.col)}">${esc(z.s.map(nameOf).join(', '))}</span>` : ''}${r ? ` 🎽 ${esc(C.roles.find(x => x.id === r.r)?.name || '')}${r.l != null ? ' : ' + r.l + '/4' : ''}` : ''}</td></tr>`; }).join('')}</table>` : '<p class="muted">Aucune.</p>'}</div>`;
  return h;
}

/* ---------- Envoi / réception (tablette élève) ---------- */
function viewSend(){
  const p = buildMine();
  return `<div class="card strong center"><b>${p.obs.length} observation(s) faite(s) sur cette tablette · ${esc(S.name)}</b>
      <div class="muted">L'enseignant scanne ce QR dans « 📥 Récupérer les saisies ». Les QR défilent seuls.</div></div>
    <div id="qr-area" class="center"></div>
    <div class="btn-row center-row"><button class="btn" data-action="fileMine">📤 Partager en fichier à la place</button></div>`;
}
function afterSend(){ showPacketQR(buildMine(), 'R', $('#qr-area'), '', 300); }
function viewReceive(){
  return `<div class="card strong center"><b>📷 Scanne le QR de la leçon affiché par l'enseignant</b><div class="muted">ou un QR de paramétrage</div></div>
    <div id="scan-area"></div>
    <div class="btn-row center-row"><label class="btn">📂 Importer un fichier (.json)<input type="file" data-file="json" accept=".json,application/json" hidden></label></div>`;
}
function afterReceive(){ startScan($('#scan-area'), ['S', 'C', 'F'], async p => { const r = await applyPacket(p); if (r !== 'continue') { UI.filter = null; go('home'); } return r; }); }
