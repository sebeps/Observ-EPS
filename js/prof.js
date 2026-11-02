/* =====================================================================
   Espace enseignant (principe Biathlon) : classes, cycle, leçon du jour,
   QR de la leçon, récupération des saisies, suivi par classe / élève /
   leçon, export Excel, sauvegarde.
   ===================================================================== */
'use strict';

function pinPad(onOk, title='🔒 Code enseignant'){
  let code = '';
  const m = modal(`<h2 class="center">${title}</h2><div class="pin-dots">${'<span></span>'.repeat(4)}</div>
    <div class="pin-pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✕'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <p class="center muted small-t">Code par défaut : 0000 (modifiable dans Sauvegarde & réglages)</p>`);
  const dots = m.querySelectorAll('.pin-dots span');
  m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === '✕') return closeModal();
    if (k === '⌫') code = code.slice(0, -1); else if (code.length < 4) code += k;
    dots.forEach((d, i) => d.classList.toggle('f', i < code.length));
    if (code.length === 4) { if (code === String(ROOT.pin || '0000')) { closeModal(); onOk(); } else { toast('Code incorrect'); code = ''; dots.forEach(d => d.classList.remove('f')); } }
  });
}

const PSECT = {
  prep:  { ico:'🛠', t:'Classes & cycle', tabs:[['classes', '👥 Classes & élèves'], ['cycle', '📅 Leçons du cycle']] },
  param: { ico:'🎛', t:'Paramétrer l\'appli élève', tabs:[] },
  jour:  { ico:'📲', t:'Leçon du jour', tabs:[['appel', '✅ Appel'], ['qr', '📲 QR de la leçon']] },
  recup: { ico:'📥', t:'Récupérer les saisies', tabs:[] },
  suivi: { ico:'📊', t:'Suivi & bilans', tabs:[['sclasse', '🏫 Par classe'], ['seleves', '🧒 Par élève'], ['slecon', '📅 Par leçon'], ['export', '📊 Export Excel']] },
  save:  { ico:'💾', t:'Sauvegarde & réglages', tabs:[] }
};
const TAB_SECT = { classes:'prep', cycle:'prep', param:'param', appel:'jour', qr:'jour', recup:'recup', sclasse:'suivi', seleves:'suivi', slecon:'suivi', export:'suivi', save:'save' };

function classPicker(){
  const cls = Object.values(ROOT.classes);
  return `<div class="class-chips">${cls.map(c => `<button class="class-chip ${c.id === S.id ? 'on' : ''}" data-action="selClass" data-id="${c.id}">🏫 ${esc(c.name)}</button>`).join('')}</div>`;
}
function lessonPicker(){
  return `<div class="lesson-picker">${Array.from({ length: S.nbLessons }, (_, i) => i + 1).map(n => `<button class="lp ${n === curLesson() ? 'on' : ''}" data-action="setCurrent" data-n="${n}">${n}</button>`).join('')}</div>`;
}
function viewProf(){
  const t = UI.tab || 'menu';
  if (t === 'menu') return profMenu();
  const sec = TAB_SECT[t]; const P = PSECT[sec];
  let head = `<div class="btn-row" style="margin-bottom:8px"><button class="btn small" data-action="tab" data-t="menu">← Menu enseignant</button><h2 style="margin:0 0 0 6px">${P.ico} ${P.t}</h2></div>`;
  if (sec !== 'param' && sec !== 'save') head += `<div class="card compact">${classPicker()}${sec === 'jour' || sec === 'recup' ? `<div class="row" style="margin-top:6px"><b>Leçon du jour</b>${lessonPicker()}</div>` : ''}</div>`;
  if (P.tabs.length) head += `<div class="subtabs">${P.tabs.map(([k, l]) => `<button class="${k === t ? 'on' : ''}" data-action="tab" data-t="${k}">${l}</button>`).join('')}</div>`;
  const body = { classes: profClasses, cycle: profCycle, param: viewParam, appel: profAppel, qr: profQR, recup: profRecup, sclasse: profSuiviClasse, seleves: viewSuiviTiles, slecon: profSuiviLecon, export: profExport, save: profSave }[t]();
  return head + body;
}
function profMenu(){
  const n = curLesson(), pres = S.students.filter(s => present(n, s.id)).length;
  const obsN = obsOfLesson(n), seen = new Set(obsN.flatMap(o => o.z.flatMap(z => z.s)));
  return `<div class="card compact center">${classPicker()}<div style="margin-top:6px"><b>${esc(S.name)}</b> · ${lessonLabel(n)} · ${pres}/${S.students.length} présent(s) · ${obsN.length} observation(s) · ${seen.size} élève(s) observé(s)</div></div>
    <div class="pmenu">
      <button class="pm-btn" data-action="tab" data-t="classes"><span class="step">1</span><span class="ico">🛠</span>Classes & cycle<small>Classes · élèves (Pronote) · groupes · leçons</small></button>
      <button class="pm-btn" data-action="tab" data-t="param"><span class="step">2</span><span class="ico">🎛</span>Paramétrer l'appli élève<small>${esc(CFG().name)} · ${CFG().nbObs} observé(s) · boutons · indicateurs · rôles · JSON</small></button>
      <button class="pm-btn" data-action="tab" data-t="appel"><span class="step">3</span><span class="ico">📲</span>Leçon du jour<small>Appel · QR de la leçon pour les tablettes</small></button>
      <button class="pm-btn" data-action="tab" data-t="recup"><span class="step">4</span><span class="ico">📥</span>Récupérer les saisies<small>Scanner les QR des tablettes élèves</small></button>
      <button class="pm-btn" data-action="tab" data-t="sclasse"><span class="step">5</span><span class="ico">📊</span>Suivi & bilans<small>Par classe · par élève · par leçon · Excel</small></button>
      <button class="pm-btn" data-action="tab" data-t="save"><span class="step">6</span><span class="ico">💾</span>Sauvegarde & réglages<small>Sauvegarde · autre tablette enseignant · code</small></button>
    </div>
    <div class="btn-row center-row"><button class="btn" data-action="newObs" ${S.students.length ? '' : 'disabled'}>👀 Observer sur cette tablette</button><button class="btn ghost" data-action="go" data-view="history">🗂 Toutes les observations</button></div>`;
}

/* ---------- Classes & élèves ---------- */
function profClasses(){
  const list = sortedStudents(), G = Math.max(0, ...S.students.map(s => s.grp || 0));
  return `<div class="card compact"><div class="row">
      <label class="field grow">Nom de la classe<input type="text" data-field="className" value="${esc(S.name)}"></label>
      <label class="field grow">Nouvelle classe<input type="text" id="new-class" placeholder="Ex : 4e B"></label>
      <button class="btn green" data-action="addClass" style="align-self:flex-end">＋ Créer</button>
      ${Object.keys(ROOT.classes).length > 1 ? `<button class="btn red small" data-action="delClass" style="align-self:flex-end">🗑 Supprimer « ${esc(S.name)} »</button>` : ''}</div></div>
    <div class="card"><h3>Importer la liste des élèves</h3><p class="muted">Fichier Pronote / Excel / CSV (nom et prénom, ou « NOM Prénom » dans une colonne), ou copier-coller depuis un tableur.</p>
      <div class="btn-row"><label class="btn primary">📂 Fichier .xlsx / .csv<input type="file" data-file="students" accept=".xlsx,.xls,.csv,.txt" hidden></label></div>
      <textarea id="paste-students" rows="3" placeholder="DUPONT;Léa&#10;MARTIN;Hugo&#10;ou une ligne par élève : DUPONT Léa" style="margin-top:10px"></textarea>
      <div class="btn-row"><button class="btn small" data-action="pasteStudents">✅ Ajouter la liste collée</button></div>
      <h3 style="margin-top:14px">Ajouter un élève</h3><div class="row"><input type="text" id="add-nom" placeholder="NOM" class="grow"><input type="text" id="add-prenom" placeholder="Prénom" class="grow"><button class="btn green" data-action="addStudent">＋</button></div></div>
    <div class="card"><div class="row"><h3 class="grow" style="margin:0">${list.length} élève(s)</h3>${list.length ? '<button class="btn small red" data-action="clearStudents">Vider la liste</button>' : ''}</div>
      <p class="muted">Groupe (facultatif) : chaque tablette élève peut n'afficher qu'un groupe. Touchez la pastille pour changer.</p>
      <table class="simple"><tr><th>Affiché</th><th>Nom complet</th><th>Groupe</th><th></th></tr>
      ${list.map(s => `<tr><td><b>${esc(nameOf(s.id))}</b></td><td>${esc(fullName(s.id))}</td>
        <td><button class="gdot" data-action="cycleGroup" data-sid="${s.id}" style="background:${GROUP_COLORS[s.grp || 0]}">${s.grp || '–'}</button></td>
        <td class="right"><button class="btn small ghost" data-action="editStudent" data-sid="${s.id}">✏️</button><button class="btn small ghost" data-action="delStudent" data-sid="${s.id}">🗑</button></td></tr>`).join('')}</table></div>`;
}
function profCycle(){
  const N = S.nbLessons;
  return `<div class="card"><div class="row"><b>Nombre de leçons</b><div class="stepper"><button data-action="nbLessons" data-d="-1">−</button><span class="val">${N}</span><button data-action="nbLessons" data-d="1">+</button></div></div>
    <table class="simple" style="margin-top:10px"><tr><th>Leçon</th><th>Titre / thème (facultatif)</th><th>Observations</th></tr>
    ${Array.from({ length: N }, (_, i) => i + 1).map(n => `<tr class="${n === curLesson() ? 'cur' : ''}"><td><b>${n}</b></td><td><input type="text" data-field="lessonTitle" data-n="${n}" value="${esc(lesson(n).title)}" placeholder="Ex : Défendre son but"></td><td class="num">${obsOfLesson(n).length}</td></tr>`).join('')}</table></div>`;
}

/* Import d'une liste d'élèves */
async function readSheetRows(file){
  if (!window.XLSX) throw new Error('Bibliothèque Excel non chargée');
  const buf = await file.arrayBuffer(); let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf); if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    return parseText(text.replace(/^﻿/, ''));
  } else wb = XLSX.read(buf, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
}
function parseText(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const first = lines[0] || '', FS = first.includes(';') ? ';' : first.includes('\t') ? '\t' : first.includes(',') ? ',' : null;
  return lines.map(l => FS ? l.split(FS).map(x => x.trim().replace(/^"|"$/g, '')) : [l.trim()]);
}
const HEADER_RX = /^(nom|noms|élève|élèves|eleve|eleves|pr[ée]nom|identit[ée]|classe|n°|num)/i;
const isNameLike = s => !!s && /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- .]+$/.test(s) && !/\d/.test(s);
function parseStudents(rows){
  rows = rows.map(r => r.map(c => String(c ?? '').trim())).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  let ci = { nom: -1, prenom: -1, full: -1 };
  const h = rows[0].map(x => x.toLowerCase());
  if (h.some(x => HEADER_RX.test(x))) {
    h.forEach((x, i) => { if (/pr[ée]nom/.test(x) && !/nom.*pr[ée]nom/.test(x)) ci.prenom = i; else if (/nom.*pr[ée]nom|[ée]l[èe]ve|identit/.test(x)) ci.full = i; else if (/^noms?$/.test(x)) ci.nom = i; });
    rows = rows.slice(1);
  }
  if (ci.nom < 0 && ci.full < 0) { const nc = rows[0].filter(isNameLike).length; const idx = rows[0].map((c, i) => isNameLike(c) ? i : -1).filter(i => i >= 0);
    if (nc >= 2) { ci.nom = idx[0]; ci.prenom = idx[1]; } else ci.full = idx[0] ?? 0; }
  return rows.map(r => {
    if (ci.full >= 0 && ci.nom < 0) { const t = (r[ci.full] || '').split(/\s+/); const up = t.filter(w => w.length > 1 && w === w.toUpperCase());
      const nom = up.length ? up.join(' ') : t[0]; const prenom = up.length ? t.filter(w => !up.includes(w)).join(' ') : t.slice(1).join(' ');
      return { nom: nom.toUpperCase(), prenom: capName(prenom || '') }; }
    return { nom: (r[ci.nom] || '').toUpperCase(), prenom: capName(r[ci.prenom] || '') };
  }).filter(s => s.nom || s.prenom);
}
async function addStudents(list){
  if (!list.length) return toast('Aucun élève reconnu');
  let added = 0;
  list.forEach(x => { if (S.students.some(s => (s.nom || '') === x.nom && (s.prenom || '') === x.prenom)) return; S.students.push({ id: newStudentId(), nom: x.nom, prenom: x.prenom || x.nom, grp: 0 }); added++; });
  save(); render(); toast(`✓ ${added} élève(s) ajouté(s)`);
}

/* ---------- Leçon du jour ---------- */
function profAppel(){
  const n = curLesson();
  const abs = S.students.filter(s => attOf(n, s.id) === 'abs').length, inap = S.students.filter(s => attOf(n, s.id) === 'inap').length;
  return `<div class="card compact"><b>Appel · Leçon ${n}</b> · ${S.students.length - abs - inap} présent(s) · ${abs} absent(s) · ${inap} inapte(s) <span class="muted">— les absents sont signalés sur les tablettes élèves</span></div>
    <div class="tiles small">${sortedStudents().map(s => { const a = attOf(n, s.id);
      return `<div class="att-tile ${a || ''}"><span class="band" style="background:${GROUP_COLORS[s.grp || 0]}"></span><div class="name">${esc(nameOf(s.id))}</div>
        <div class="btn-row"><button class="btn small ${a === 'abs' ? 'red' : ''}" data-action="att" data-sid="${s.id}" data-v="abs">Absent</button><button class="btn small ${a === 'inap' ? 'orange' : ''}" data-action="att" data-sid="${s.id}" data-v="inap">Inapte</button></div></div>`; }).join('') || '<p>Aucun élève.</p>'}</div>
    <div class="btn-row center-row"><button class="btn primary" data-action="tab" data-t="qr">Suivant : 📲 QR de la leçon →</button></div>`;
}
function profQR(){
  const n = curLesson();
  if (UI.qrCfg == null) UI.qrCfg = true;
  return `<div class="card strong"><div class="row"><div class="grow"><b>📲 QR de la leçon ${n}</b> · ${esc(S.name)} · ${S.students.length} élève(s)<br>
      <span class="muted">Sur chaque tablette élève : <b>📷 Recevoir la leçon</b>, puis viser ce QR (les QR défilent seuls).</span></div>
      <label class="check"><input type="checkbox" data-field="qrCfg" ${UI.qrCfg ? 'checked' : ''}> Inclure le paramétrage « ${esc(CFG().name)} » (sans images)</label></div>
    <div id="qr-seance" class="center"></div>
    <div class="btn-row center-row"><button class="btn" data-action="fileSeance">📤 Partager la leçon en fichier</button></div></div>`;
}
function afterQR(){ if (UI.tab === 'qr') showPacketQR(buildSeance(UI.qrCfg), 'S', $('#qr-seance'), `Leçon ${curLesson()} · ${esc(S.name)}`); }

/* ---------- Récupérer les saisies ---------- */
function waitList(){
  const n = curLesson(), pres = sortedStudents().filter(s => present(n, s.id));
  const seen = new Set(obsOfLesson(n).flatMap(o => o.z.flatMap(z => z.s)));
  const miss = pres.filter(s => !seen.has(s.id)), ok = pres.length - miss.length, p = pres.length ? Math.round(ok / pres.length * 100) : 0;
  return `<div class="recv-prog"><div class="rp-bar"><span style="width:${p}%"></span></div><div><b>${ok} / ${pres.length}</b> élèves présents observés (leçon ${n}) · ${obsOfLesson(n).length} observation(s)</div></div>
    <h3>⏳ Pas encore observés <span class="muted">· ${miss.length}</span></h3>
    ${miss.length ? `<div class="wait-list">${miss.map(s => `<span class="wait-it" style="border-left-color:${GROUP_COLORS[s.grp || 0]}">${esc(nameOf(s.id))}</span>`).join('')}</div>` : '<div class="advice good">✓ Tous les élèves présents ont au moins une observation.</div>'}`;
}
function profRecup(){
  return `<div class="recup-grid"><div class="card strong"><h3>📥 Scanner les tablettes élèves</h3>
      <div class="muted">Sur chaque tablette élève : <b>📤 Envoyer au prof</b>, puis scannez le QR ici. La caméra reste ouverte pour la tablette suivante.</div>
      <div id="scan-area"></div>
      <div class="btn-row center-row"><label class="btn">📂 Importer des fichiers (.json)<input type="file" data-file="json" multiple accept=".json,application/json" hidden></label></div></div>
    <div class="card" id="wait-box">${waitList()}</div></div>`;
}
function afterRecup(){
  startScan($('#scan-area'), ['R', 'F'], async p => { await applyPacket(p); const w = $('#wait-box'); if (w) w.innerHTML = waitList(); return 'continue'; });
}

/* ---------- Suivi par classe ---------- */
function profSuiviClasse(){
  const M = mainMetric(), N = S.nbLessons, labels = Array.from({ length: N }, (_, i) => 'L' + (i + 1));
  const list = sortedStudents().filter(passFilter);
  const rows = list.map(s => ({ s, v: labels.map((_, i) => metricValue(M.k, studentLesson(s.id, i + 1))) }));
  const avgs = labels.map((_, i) => avg(rows.map(r => r.v[i])));
  const max = M.unit === '%' ? 100 : M.unit === '/4' ? 4 : null;
  const st = v => max ? heat(v, max) : '';
  const progress = r => { const v = r.v.map((x, i) => [x, i]).filter(x => x[0] != null); return v.length > 1 ? v[v.length - 1][0] - v[0][0] : null; };
  return `<div class="card compact"><div class="row">${metricSelect()}<span class="muted grow">Toutes les observations d'un élève sur une leçon sont cumulées.</span></div></div>${filterBar()}
    <div class="card"><h3>📈 Moyenne de la classe · ${esc(M.label)}</h3>${lineSVG([{ name: 'Moyenne de la classe', color: '#0b6bcb', values: avgs }], labels, { min: max ? 0 : null, max, unit: M.unit === '%' ? '%' : '' })}</div>
    <div class="card scroll-x"><h3>Élèves × leçons</h3><table class="simple grid-t"><tr><th>Élève</th>${labels.map((l, i) => `<th class="${i + 1 === curLesson() ? 'cur' : ''}">${l}</th>`).join('')}<th>Évolution</th></tr>
      ${rows.map(r => { const pg = progress(r); return `<tr><td class="clk" data-action="suiviEleve" data-sid="${r.s.id}"><b>${esc(nameOf(r.s.id))}</b></td>${r.v.map((v, i) => { const a = attOf(i + 1, r.s.id);
        return `<td class="num" style="${st(v)}">${v != null ? metricFmt(M, v) : a ? `<span class="muted">${a === 'abs' ? 'abs' : 'inap'}</span>` : ''}</td>`; }).join('')}
        <td class="num">${pg == null ? '' : `<span class="${pg > 0 ? 'up' : pg < 0 ? 'down' : ''}">${pg > 0 ? '+' : ''}${fmt(pg)}${M.unit === '%' ? ' pts' : ''}</span>`}</td></tr>`; }).join('')}
      <tr class="tot"><td>Moyenne</td>${avgs.map(v => `<td class="num">${metricFmt(M, v)}</td>`).join('')}<td></td></tr></table></div>`;
}
/* ---------- Suivi par leçon ---------- */
function profSuiviLecon(){
  const n = curLesson(), list = obsOfLesson(n), C = CFG();
  return `<div class="card compact"><div class="row"><b>Leçon</b>${lessonPicker()}</div></div>
    <div class="card">${waitList()}</div>
    <div class="card scroll-x"><h3>Bilan de la leçon ${n} par élève</h3><table class="simple"><tr><th>Élève</th><th>Obs.</th>${C.indicators.map(i => `<th>${esc(i.title)}</th>`).join('')}<th>Score moyen</th>${C.roles.map(r => `<th>🎽 ${esc(r.name)}</th>`).join('')}</tr>
      ${sortedStudents().map(s => { const SL = studentLesson(s.id, n); if (!SL.nb && !Object.keys(SL.roles).length) return '';
        return `<tr><td class="clk" data-action="suiviEleve" data-sid="${s.id}"><b>${esc(nameOf(s.id))}</b></td><td class="num">${SL.nb}</td>
        ${C.indicators.map((ind, i) => { const v = metricValue('i' + i, SL); return `<td class="num" style="${heat(v)}">${pct(v)}</td>`; }).join('')}
        <td class="num">${fmt(metricValue('SAm', SL))}</td>${C.roles.map(r => `<td class="num" style="${heat(SL.roles[r.id], 4)}">${SL.roles[r.id] ?? ''}</td>`).join('')}</tr>`; }).join('')}</table></div>
    <div class="card"><h3>${list.length} observation(s)</h3>${list.length ? `<table class="simple clickable"><tr><th>Heure</th><th>Tablette</th><th>Observé(s)</th><th>Actions</th></tr>${list.slice().reverse().map(o => `<tr data-action="openObs" data-id="${o.id}">
      <td>${dateFR(o.ts)}</td><td>${esc(o.d)}</td><td>${o.z.map(z => `<span class="pill" style="background:${z.col};color:${textOn(z.col)}">${esc(z.s.map(nameOf).join(', '))}</span>`).join(' ')}</td><td class="num">${sum(o.z.map(z => sum(Object.values(z.c))))}</td></tr>`).join('')}</table>` : '<p class="muted">Aucune.</p>'}</div>`;
}

/* ---------- Export Excel ---------- */
function profExport(){
  return `<div class="card strong"><h3>📊 Export Excel · ${esc(S.name)}</h3>
    <p class="muted">Classeur avec : toutes les observations (une ligne par élève observé), un onglet de suivi par mesure (élèves × leçons) et les rôles.</p>
    <div class="btn-row"><button class="btn green" data-action="exportXlsx">📊 Exporter ${esc(S.name)} (.xlsx)</button><button class="btn" data-action="exportCsv">CSV (observations)</button></div></div>`;
}
function obsRows(){
  const C = CFG(), rows = [];
  allObs().forEach(o => o.z.forEach((z, zi) => z.s.forEach(sid => {
    const V = varsOf(z.c, z.s.length, o.dur), r = { 'Classe': S.name, 'Leçon': o.n, 'Date': dateFR(o.ts), 'Tablette': o.d, 'Élève': fullName(sid), 'Équipe': zi + 1, 'Coéquipiers': z.s.filter(x => x !== sid).map(fullName).join(', '), 'Durée (s)': o.dur };
    C.dropdowns.forEach(d => r[d.label] = d.type === 'eleve' ? (z.dd?.[d.id] ? fullName(z.dd[d.id]) : '') : (z.dd?.[d.id] || ''));
    C.buttons.filter(b => b.exp).forEach(b => r[b.name] = z.c[b.id] || 0);
    r['Total appuis'] = V.OA; r['Score'] = V.SA;
    C.recap.filter(x => x.formula).forEach(x => r[x.label || x.formula] = evalFormula(x.formula, V));
    C.indicators.forEach(ind => { const v = indicatorOf(ind, z.c).value; r[ind.title + ' (%)'] = v == null ? '' : Math.round(v * 10) / 10; });
    rows.push(r);
  })));
  return rows;
}
function exportXlsx(){
  if (!window.XLSX) return toast('Bibliothèque Excel non chargée');
  const wb = XLSX.utils.book_new(), N = S.nbLessons;
  const r1 = obsRows(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r1.length ? r1 : [{ Info: 'Aucune observation' }]), 'Observations');
  const used = new Set();
  metrics().filter(m => !m.k.startsWith('o:')).forEach(m => {
    const rows = sortedStudents().map(s => { const r = { 'Élève': fullName(s.id), 'Groupe': s.grp || '' };
      for (let n = 1; n <= N; n++) { const v = metricValue(m.k, studentLesson(s.id, n)); r['L' + n] = v == null ? (attOf(n, s.id) ? (attOf(n, s.id) === 'abs' ? 'abs' : 'inap') : '') : Math.round(v * 10) / 10; }
      return r; });
    let name = m.label.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28); while (used.has(name)) name = name.slice(0, 26) + '_' + used.size; used.add(name);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  });
  const roleRows = []; allObs().forEach(o => (o.r || []).forEach(r => roleRows.push({ 'Leçon': o.n, 'Date': dateFR(o.ts), 'Élève': fullName(r.s), 'Rôle': CFG().roles.find(x => x.id === r.r)?.name || '?', 'Niveau': r.l ?? '' })));
  if (roleRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roleRows), 'Rôles');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `suivi-${slug(S.name)}-${slug(CFG().name)}-${stamp()}.xlsx`);
}
function exportCsv(){
  const rows = obsRows(); if (!rows.length) return toast('Aucune observation');
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const csv = [keys.join(';'), ...rows.map(r => keys.map(k => String(r[k] ?? '').replace(/;/g, ',').replace(/\n/g, ' ')).join(';'))].join('\r\n');
  downloadFile('﻿' + csv, `observations-${slug(S.name)}-${stamp()}.csv`, 'text/csv');
}

/* ---------- Sauvegarde & réglages ---------- */
function profSave(){
  return `<div class="card strong"><h3>💾 Sauvegarde complète de la tablette</h3><p class="muted">Toutes les classes, observations et le paramétrage, dans un seul fichier.</p>
      <div class="btn-row"><button class="btn green" data-action="backup">💾 Sauvegarder (.json)</button><label class="btn">♻️ Restaurer<input type="file" data-file="json" accept=".json,application/json" hidden></label></div></div>
    <div class="card"><h3>🔁 Vers une autre tablette enseignant · ${esc(S.name)}</h3><p class="muted">Élèves (noms complets), leçons et observations. À recevoir dans « 📥 Récupérer les saisies » de l'autre tablette (ou par fichier).</p>
      <div class="btn-row"><button class="btn" data-action="fullQR">▦ QR historique</button><button class="btn" data-action="fullFile">📤 Fichier historique</button></div></div>
    <div class="card"><h3>🔒 Code enseignant</h3><div class="row"><input type="password" inputmode="numeric" maxlength="4" id="new-pin" placeholder="4 chiffres" style="max-width:160px"><button class="btn" data-action="setPin">Changer</button></div>
      <p class="muted">Le code n'est pas transmis aux tablettes élèves.</p></div>
    <div class="card"><h3>Tablette</h3><div class="btn-row"><button class="btn small" data-action="setRole" data-r="eleve">🧒 Passer en tablette élève</button><button class="btn small" data-action="demo">🧪 Créer une classe de démonstration</button></div></div>
    <div class="card"><h3>Effacer</h3><div class="btn-row"><button class="btn small ghost" data-action="clearObs">Effacer les observations de « ${esc(S.name)} »</button><button class="btn small red" data-action="resetAll">Tout effacer sur cette tablette</button></div>
      <p class="muted small-t">Obs'EPS v${APP_VERSION} · appareil ${esc(ROOT.deviceId)}</p></div>`;
}

/* ---------- Classe de démonstration ---------- */
function makeDemo(){
  const P = ['Léa','Hugo','Inès','Nathan','Jade','Lucas','Chloé','Adam','Manon','Rayan','Zoé','Noah','Lina','Tom','Emma','Sacha'];
  const Nn = ['MARTIN','BERNARD','DUBOIS','THOMAS','ROBERT','PETIT','DURAND','LEROY','MOREAU','SIMON','LAURENT','LEFEBVRE','MICHEL','GARCIA','DAVID','BERTRAND'];
  const c = newClass('Démo 5e A'); c.nbLessons = 6; c.current = 5;
  c.students = P.map((p, i) => ({ id: newStudentId(c), nom: Nn[i], prenom: p, grp: 1 + (i % 4) }));
  const C = CFG(), skill = {}; c.students.forEach(s => skill[s.id] = 0.25 + Math.random() * 0.5);
  for (let n = 1; n <= 4; n++) {
    lesson(n, c).title = ['Diagnostic', 'Conserver la balle', 'Progresser vers le but', 'Tirer en position favorable'][n - 1];
    const ids = c.students.map(s => s.id).sort(() => Math.random() - 0.5);
    for (let k = 0; k + 1 < ids.length; k += 2) {
      const z = [ids[k], ids[k + 1]].map((sid, j) => { const q = Math.min(0.95, skill[sid] + (n - 1) * 0.08 + (Math.random() - 0.5) * 0.15); const cnt = {};
        C.buttons.forEach((b, bi) => { const base = 2 + Math.floor(Math.random() * 6); cnt[b.id] = b.pts > 0 ? Math.round(base * (0.5 + q)) : Math.round(base * (1.2 - q)); });
        return { s: [sid], col: [COLORS[0].c, COLORS[1].c][j], c: cnt, dd: {} }; });
      const o = { id: 'demo-' + n + '-' + k + rnd(3), cid: c.id, n, ts: now() - (5 - n) * 7 * 864e5 + k * 6e4, d: 'DEMO', dur: 300, z: C.nbObs === 2 ? z : [z[0]], act: C.name,
        r: C.roles.length ? [{ s: ids[(k + 2) % ids.length], r: C.roles[0].id, l: Math.min(4, 1 + Math.floor(Math.random() * 2) + Math.floor(n / 2)) }] : [] };
      c.obs[o.id] = o;
    }
  }
  ROOT.classes[c.id] = c; useClass(c.id); save();
}

/* ---------- Actions enseignant ---------- */
Object.assign(A, {
  openProf: () => pinPad(() => { if (!isProf()) { ROOT.role = 'prof'; save(); } UI.profUnlocked = true; UI.tab = 'menu'; go('prof'); }),
  tab: d => { stopScan(); UI.tab = d.t; if (d.t === 'param' && !UI.ptab) UI.ptab = 'activite'; go('prof'); },
  selClass: d => { useClass(d.id); save(); UI.filter = null; render(); },
  setCurrent: d => { S.current = +d.n; save(); render(); },
  addClass: () => { const n = $('#new-class').value.trim(); if (!n) return toast('Nom de la classe ?'); const c = newClass(n); ROOT.classes[c.id] = c; useClass(c.id); save(); render(); },
  delClass: async () => { if (await confirmBox('Supprimer la classe ?', `« ${esc(S.name)} », ses élèves et ses observations seront supprimés.`, 'Supprimer', true)) { delete ROOT.classes[S.id]; useClass(Object.keys(ROOT.classes)[0]); save(); render(); } },
  addStudent: () => { const nom = $('#add-nom').value.trim().toUpperCase(), prenom = capName($('#add-prenom').value); if (!nom && !prenom) return; addStudents([{ nom, prenom }]); },
  pasteStudents: () => addStudents(parseStudents(parseText($('#paste-students').value))),
  editStudent: async d => { const s = student(d.sid); const v = await promptBox('Modifier l\'élève', (s.nom || '') + ';' + (s.prenom || ''), { label: 'NOM;Prénom' }); if (v == null) return;
    const [nom, prenom] = v.split(';'); s.nom = (nom || '').trim().toUpperCase(); s.prenom = capName(prenom || ''); save(); render(); },
  delStudent: async d => { if (await confirmBox('Retirer l\'élève ?', esc(fullName(d.sid)), 'Retirer', true)) { S.students = S.students.filter(s => s.id !== d.sid); save(); render(); } },
  clearStudents: async () => { if (await confirmBox('Vider la liste ?', 'Les observations sont conservées mais ne seront plus rattachées à un nom.', 'Vider', true)) { S.students = []; save(); render(); } },
  cycleGroup: d => { const s = student(d.sid); s.grp = ((s.grp || 0) + 1) % 9; save(); render(); },
  nbLessons: d => { S.nbLessons = Math.max(1, Math.min(30, S.nbLessons + +d.d)); S.current = Math.min(S.current, S.nbLessons); save(); render(); },
  att: d => { const L = lesson(curLesson()); if (L.att[d.sid] === d.v) delete L.att[d.sid]; else L.att[d.sid] = d.v; save(); render(); },
  fileSeance: () => downloadFile(JSON.stringify(buildSeance(true)), `lecon-${curLesson()}-${slug(S.name)}.json`),
  exportXlsx: () => exportXlsx(), exportCsv: () => exportCsv(),
  backup: () => downloadFile(JSON.stringify({ k: 'backup', at: now(), root: ROOT }), `sauvegarde-obseps-${stamp()}.json`),
  fullQR: () => { const m = modal(`<h2>▦ Historique · ${esc(S.name)}</h2><div id="qr-full"></div><div class="btn-row center-row"><button class="btn" data-action="closeModal">Fermer</button></div>`, { wide: true }); showPacketQR(buildFull(true), 'F', m.querySelector('#qr-full'), ''); },
  fullFile: () => downloadFile(JSON.stringify(buildFull(true)), `historique-${slug(S.name)}-${stamp()}.json`),
  setPin: () => { const v = $('#new-pin').value; if (!/^\d{4}$/.test(v)) return toast('4 chiffres'); ROOT.pin = v; save(); toast('✓ Code modifié'); $('#new-pin').value = ''; },
  demo: () => { makeDemo(); toast('✓ Classe de démonstration créée'); UI.tab = 'sclasse'; render(); },
  clearObs: async () => { if (await confirmBox('Effacer les observations ?', `Toutes les observations de « ${esc(S.name)} » seront supprimées de cette tablette.`, 'Effacer', true)) { S.obs = {}; save(); render(); } },
  resetAll: async () => { if (await confirmBox('Tout effacer ?', 'Classes, observations et paramétrage seront supprimés de cette tablette. Faites une sauvegarde avant !', 'Tout effacer', true)) { localStorage.removeItem(ROOT_KEY); localStorage.removeItem(LIVE_KEY); location.reload(); } }
});
Object.assign(F, {
  className: el => { S.name = el.value.trim() || 'Classe'; save(); render(); },
  lessonTitle: el => { lesson(el.dataset.n).title = el.value.trim(); save(); },
  qrCfg: el => { UI.qrCfg = el.checked; render(); }
});
Object.assign(FILES, {
  students: async f => { try { addStudents(parseStudents(await readSheetRows(f))); } catch(e){ toast('⚠️ ' + e.message, 4000); } }
});
