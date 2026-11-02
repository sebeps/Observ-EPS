/* =====================================================================
   Paramétrage de l'appli élève (principe de Gain EPS CA4)
   Enregistrement automatique · export / import JSON · QR de paramétrage
   ===================================================================== */
'use strict';

const PTABS = [['activite', '🏷 Activité'], ['boutons', '🔘 Boutons'], ['layout', '📐 Disposition'], ['listes', '📋 Listes'], ['recap', '🧮 Récap'],
  ['indic', '📊 Indicateurs & conseils'], ['roles', '🎽 Rôles'], ['resultats', '🏁 Résultats'], ['fichier', '💾 Modèles & JSON']];

function setPath(obj, path, v){ const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; }
function getPath(obj, path){ return path.split('.').reduce((o, k) => o == null ? o : o[k], obj); }
function cfgChanged(rr=true){ const C = CFG(); C.rev = (C.rev || 1) + 1; C.at = now(); ROOT.cfg = normConfig(C); save(); flagSaved(); if (rr) render(); }
function flagSaved(){ const f = $('#saved-flag'); if (f) { f.textContent = '✓ Enregistré'; clearTimeout(f._h); f._h = setTimeout(() => f.textContent = '', 1500); } }

/* champs génériques : data-cfg="chemin" data-t="num|bool|text" */
const inp = (path, { t='text', ph='', rr=false, style='' } = {}) => `<input type="${t === 'num' ? 'number' : 'text'}" data-cfg="${path}" data-t="${t}" ${rr ? 'data-rr="1"' : ''} value="${esc(getPath(CFG(), path) ?? '')}" placeholder="${esc(ph)}" ${style ? `style="${style}"` : ''}>`;
const chk = (path, label) => `<label class="check"><input type="checkbox" data-cfg="${path}" data-t="bool" data-rr="1" ${getPath(CFG(), path) ? 'checked' : ''}> ${label}</label>`;
const btnRef = b => { const i = CFG().buttons.indexOf(b) + 1; return `<span class="ref">O${i}/A${i}</span>`; };

function viewParam(){
  const t = UI.ptab || 'activite';
  const body = { activite: pActivite, boutons: pBoutons, layout: pLayout, listes: pListes, recap: pRecap, indic: pIndic, roles: pRoles, resultats: pResultats, fichier: pFichier }[t]();
  return `<div class="subtabs">${PTABS.map(([k, l]) => `<button class="${k === t ? 'on' : ''}" data-action="ptab" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="param-head"><span class="muted">Paramétrage « <b>${esc(CFG().name)}</b> » · version ${CFG().rev} · enregistrement automatique</span><span id="saved-flag" class="saved"></span>
      <button class="btn small" data-action="previewObs">👁 Aperçu élève</button></div>${body}`;
}

function pActivite(){
  const C = CFG();
  return `<div class="card"><h3>Activité</h3><div class="grid2">
      <label class="field">Nom de l'activité ${inp('name', { ph: 'Ex : Handball', rr: true })}</label>
      <label class="field">Libellé de l'observé ${inp('libelle', { ph: 'Ex : Joueur, Équipe, Tireur' })}</label></div>
    <h3>Nombre d'observés en même temps</h3>
    <div class="seg">${[1, 2].map(n => `<button class="${C.nbObs === n ? 'on' : ''}" data-action="setNbObs" data-n="${n}">${n === 1 ? '👤 1 observé' : '👥 2 observés (face à face)'}</button>`).join('')}</div>
    <p class="muted">Un observé peut être un élève seul ou une équipe (plusieurs élèves dans la même case).</p>
    <h3>Image de l'activité</h3><div class="row">${C.image ? `<img src="${C.image}" class="thumb">` : ''}
      <label class="btn small">🖼 Choisir une image<input type="file" accept="image/*" data-file="cfgImage" hidden></label>${C.image ? `<button class="btn small ghost" data-action="clearImg" data-k="image">Retirer</button>` : ''}</div>
    <h3>Texte d'aide affiché pendant l'observation</h3><textarea data-cfg="guidance" data-t="text" rows="2">${esc(C.guidance)}</textarea></div>
  <div class="card"><h3>⏱ Chronomètre</h3>${chk('timer.on', 'Afficher un chronomètre pendant l\'observation')}
    ${C.timer.on ? `<div class="row"><div class="seg">${[['up', 'Chrono (temps qui monte)'], ['down', 'Compte à rebours']].map(([k, l]) => `<button class="${C.timer.dir === k ? 'on' : ''}" data-action="setCfg" data-p="timer.dir" data-v="${k}">${l}</button>`).join('')}</div>
      ${C.timer.dir === 'down' ? `<label class="field inline">Durée (min) <input type="number" min="0.5" step="0.5" value="${C.timer.sec / 60}" data-field="timerMin" style="width:90px"></label>` : ''}</div>` : ''}
    <p class="muted">La durée sert aussi à la variable <b>T</b> (minutes) des formules.</p></div>`;
}

function pBoutons(){
  const C = CFG();
  return `<div class="card"><h3>Boutons d'observation (${C.buttons.length}/${MAX_BUTTONS})</h3>
    <p class="muted">Chaque appui ajoute 1 occurrence et ses points. Dans les formules : <b>O1</b> = nombre d'appuis du bouton 1, <b>A1</b> = points du bouton 1.</p>
    <div class="blist">${C.buttons.map((b, i) => `<div class="bitem">${btnRef(b)}
      <input type="text" data-cfg="buttons.${i}.name" data-t="text" value="${esc(b.name)}" class="grow">
      <label class="mini">Points <input type="number" data-cfg="buttons.${i}.pts" data-t="num" value="${b.pts}" style="width:70px"></label>
      <label class="mini" title="Couleur propre (si l'option est choisie dans Disposition)">🎨 <input type="color" data-cfg="buttons.${i}.color" data-t="text" value="${b.color || '#1e5fd8'}"></label>
      <label class="mini"><input type="checkbox" data-cfg="buttons.${i}.exp" data-t="bool" ${b.exp ? 'checked' : ''}> Export</label>
      <button class="btn small ghost" data-action="moveBtn" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'}>↑</button>
      <button class="btn small ghost" data-action="moveBtn" data-i="${i}" data-d="1" ${i < C.buttons.length - 1 ? '' : 'disabled'}>↓</button>
      <button class="btn small red" data-action="delBtn" data-i="${i}">✕</button></div>`).join('') || '<p class="muted">Aucun bouton.</p>'}</div>
    <div class="row" style="margin-top:12px"><input type="text" id="nb-name" placeholder="Nom du nouveau bouton (ex : Passe réussie)" class="grow">
      <input type="number" id="nb-pts" value="1" style="width:80px" title="Points"><button class="btn green" data-action="addBtn" ${C.buttons.length >= MAX_BUTTONS ? 'disabled' : ''}>＋ Ajouter</button></div>
    <p class="muted">⚠️ Changer l'ordre des boutons change leurs numéros (O1, A1…) : vérifiez ensuite les formules du récapitulatif.</p></div>
    <div class="card"><h3>Modèles de boutons</h3><div class="btn-row">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="btn small" data-action="loadTpl" data-k="${k}">${esc(t.name)}</button>`).join('')}</div>
    <p class="muted">Remplace les boutons actuels (la disposition, les indicateurs et les conseils sont remis à zéro).</p></div>`;
}

function pLayout(){
  const C = CFG(), L = C.layout, cells = L.cells, placed = new Set(Object.values(cells));
  const pal = C.buttons.filter(b => !placed.has(b.id));
  const total = L.cols * L.rows;
  let grid = '';
  for (let k = 0; k < total; k++) { const b = cfgButton(cells[k]);
    grid += `<button class="lcell ${b ? 'full' : ''} ${UI.lsel === 'c' + k ? 'sel' : ''}" data-action="lcell" data-k="${k}" style="${b ? `--bc:${L.btnColor === 'button' && b.color ? b.color : '#1E5FD8'}` : ''}">${b ? esc(b.name) : '<span class="muted">+</span>'}</button>`; }
  return `<div class="card"><h3>Grille des boutons</h3><div class="row">
      <label class="field inline">Colonnes <select data-cfg="layout.cols" data-t="num" data-rr="1">${[1,2,3,4,5,6].map(n => `<option ${L.cols === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field inline">Lignes <select data-cfg="layout.rows" data-t="num" data-rr="1">${[1,2,3,4,5,6].map(n => `<option ${L.rows === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field inline">Couleur des boutons <select data-cfg="layout.btnColor" data-t="text" data-rr="1"><option value="team" ${L.btnColor === 'team' ? 'selected' : ''}>Couleur de l'équipe (chasuble)</option><option value="button" ${L.btnColor === 'button' ? 'selected' : ''}>Couleur propre à chaque bouton</option></select></label></div>
    <div class="row">${chk('layout.counter', 'Afficher le compteur sur les boutons')}${chk('layout.pts', 'Afficher les points')}</div>
    <p class="muted"><b>Touchez un bouton de la réserve</b>, puis <b>une case</b> de la grille. Touchez une case remplie pour la sélectionner (puis une autre case pour déplacer, ou la réserve pour la vider).
      ${Object.keys(cells).length ? (pal.length ? `<br><b class="err">⚠️ ${pal.length} bouton(s) dans la réserve ne seront pas visibles par les élèves.</b>` : '') : '<br>Grille vide : les boutons seront placés automatiquement dans l\'ordre de la liste.'}</p>
    <div class="palette" data-action="lpal">${pal.map(b => `<button class="pbtn ${UI.lsel === b.id ? 'sel' : ''}" data-action="lpick" data-id="${b.id}">${esc(b.name)}</button>`).join('') || '<span class="muted">Tous les boutons sont placés. (Touchez ici pour retirer le bouton sélectionné)</span>'}</div>
    <div class="lgrid-wrap">${L.bg ? `<div class="obs-bg" style="background-image:url(${L.bg})"></div>` : ''}<div class="lgrid" style="grid-template-columns:repeat(${L.cols},1fr)">${grid}</div></div>
    <div class="btn-row" style="margin-top:10px"><button class="btn small" data-action="lauto">⚡ Placer automatiquement</button><button class="btn small ghost" data-action="lclear">Vider la grille</button></div></div>
  <div class="card"><h3>🖼 Image de fond (terrain, tapis, table…)</h3><div class="row">${L.bg ? `<img src="${L.bg}" class="thumb">` : ''}
      <label class="btn small">Choisir une image<input type="file" accept="image/*" data-file="bgImage" hidden></label>${L.bg ? `<button class="btn small ghost" data-action="clearImg" data-k="layout.bg">Retirer</button>` : ''}
      <label class="field inline">Avec 2 observés <select data-cfg="layout.bgMode" data-t="text"><option value="identical" ${L.bgMode === 'identical' ? 'selected' : ''}>Identique sur les deux espaces</option><option value="mirror" ${L.bgMode === 'mirror' ? 'selected' : ''}>En miroir (image et boutons inversés)</option></select></label></div></div>`;
}

function pListes(){
  const C = CFG();
  return `<div class="card"><h3>Listes déroulantes (${C.dropdowns.length}/${MAX_DD})</h3><p class="muted">Informations complémentaires choisies pour chaque observé (ex : poste, niveau de l'adversaire, partenaire). Exportées dans Excel.</p>
    ${C.dropdowns.map((d, i) => `<div class="bitem"><input type="text" data-cfg="dropdowns.${i}.label" data-t="text" value="${esc(d.label)}" placeholder="Libellé" style="width:200px">
      <select data-cfg="dropdowns.${i}.type" data-t="text" data-rr="1"><option value="simple" ${d.type === 'simple' ? 'selected' : ''}>Options personnalisées</option><option value="eleve" ${d.type === 'eleve' ? 'selected' : ''}>Un élève de la classe</option></select>
      ${d.type === 'simple' ? `<input type="text" class="grow" data-field="ddOptions" data-i="${i}" value="${esc(d.options.join(', '))}" placeholder="Options séparées par des virgules">` : '<span class="grow muted">Ex : partenaire, adversaire</span>'}
      <button class="btn small red" data-action="delDD" data-i="${i}">✕</button></div>`).join('')}
    <button class="btn green small" data-action="addDD" ${C.dropdowns.length >= MAX_DD ? 'disabled' : ''}>＋ Ajouter une liste</button></div>`;
}

function formulaHelp(){
  return `<div class="help"><b>Variables :</b> <b>OA</b> total des appuis · <b>SA</b> total des points · <b>N</b> nombre d'élèves dans l'équipe · <b>T</b> durée (min) ·
    ${CFG().buttons.map((b, i) => `<b>O${i+1}</b>/<b>A${i+1}</b> ${esc(b.name)}`).join(' · ')}<br><b>Opérateurs :</b> + − * / ( ) · <b>Exemples :</b> <code>SA / N</code>, <code>O1 / (O1 + O2) * 100</code>, <code>OA / T</code></div>`;
}
function pRecap(){
  const C = CFG(), V = varsOf(Object.fromEntries(C.buttons.map(b => [b.id, 2])), 1, 120);
  return `<div class="card"><h3>Récapitulatif affiché en direct (et dans les résultats)</h3>${formulaHelp()}
    ${C.recap.map((r, i) => { let err = ''; try { if (r.formula) compileFormula(r.formula); } catch(e){ err = e.message; }
      return `<div class="bitem"><b>Champ ${i+1}</b><input type="text" data-cfg="recap.${i}.label" data-t="text" value="${esc(r.label)}" placeholder="Nom (ex : Score)" style="width:180px">
        <input type="text" class="grow mono" data-cfg="recap.${i}.formula" data-t="text" data-rr="1" value="${esc(r.formula)}" placeholder="Formule (ex : SA)">
        <span class="${err ? 'err' : 'ok'}">${r.formula ? (err ? '⚠️ ' + esc(err) : '✓ test : ' + fmt(evalFormula(r.formula, V))) : ''}</span>
        <button class="btn small red" data-action="delRecap" data-i="${i}">✕</button></div>`; }).join('')}
    <button class="btn small green" data-action="addRecap" ${C.recap.length >= 3 ? 'disabled' : ''}>＋ Ajouter un champ</button>
    <p class="muted">Test calculé avec 2 appuis sur chaque bouton et 2 min de durée.</p></div>`;
}

function pIndic(){
  const C = CFG();
  return `<div class="help">Un indicateur regroupe plusieurs boutons et affiche la <b>part de chacun</b> (en % des appuis) dans un graphique.
    Sa <b>valeur</b> = boutons « réussite » ÷ tous les boutons de l'indicateur × 100. Elle choisit le <b>conseil</b> et sert au <b>suivi</b> d'une leçon à l'autre.</div>
    ${C.indicators.map((ind, i) => `<div class="card"><div class="row"><h3 class="grow" style="margin:0">Indicateur ${i+1}</h3><button class="btn small red" data-action="delInd" data-i="${i}">✕ Supprimer</button></div>
      <div class="grid2"><label class="field">Titre <input type="text" data-cfg="indicators.${i}.title" data-t="text" value="${esc(ind.title)}"></label>
        <label class="field">Graphique <select data-cfg="indicators.${i}.chart" data-t="text"><option value="pie" ${ind.chart === 'pie' ? 'selected' : ''}>Camembert</option><option value="bar" ${ind.chart === 'bar' ? 'selected' : ''}>Barres</option></select></label></div>
      <label class="field">Interprétation (affichée à l'élève) <input type="text" data-cfg="indicators.${i}.interp" data-t="text" value="${esc(ind.interp)}"></label>
      <table class="simple"><tr><th>Bouton</th><th>Dans l'indicateur</th><th>Compte comme « réussite »</th><th>Couleur</th></tr>
      ${C.buttons.map((b, k) => { const inI = ind.btns.includes(b.id); return `<tr><td>${btnRef(b)} ${esc(b.name)}</td>
        <td class="center"><input type="checkbox" data-action="indBtn" data-i="${i}" data-id="${b.id}" ${inI ? 'checked' : ''}></td>
        <td class="center">${inI ? `<input type="checkbox" data-action="indNum" data-i="${i}" data-id="${b.id}" ${ind.num.includes(b.id) ? 'checked' : ''}>` : ''}</td>
        <td class="center">${inI ? `<input type="color" data-field="indColor" data-i="${i}" data-id="${b.id}" value="${ind.colors[b.id] || CHART_COLORS[ind.btns.indexOf(b.id) % 10]}">` : ''}</td></tr>`; }).join('')}</table>
      <h4>💡 Conseils selon la valeur</h4>
      <label class="field inline">Seuils en % (séparés par des virgules) <input type="text" data-field="intervals" data-i="${i}" value="${ind.intervals.join(', ')}" style="width:220px"></label>
      ${ind.intervals.map((x, k) => `<div class="cons-row"><span class="cons-l" style="${heat((x + (ind.intervals[k+1] ?? 100)) / 2)}">${intervalLabel(ind, k)}</span>
        <textarea rows="2" data-field="conseil" data-i="${i}" data-x="${x}" placeholder="Conseil affiché quand la valeur est dans cet intervalle">${esc(ind.conseils[x] || '')}</textarea></div>`).join('')}</div>`).join('')}
    <button class="btn green" data-action="addInd" ${C.indicators.length >= MAX_INDIC ? 'disabled' : ''}>＋ Ajouter un indicateur (${C.indicators.length}/${MAX_INDIC})</button>`;
}

function pRoles(){
  const C = CFG();
  return `<div class="help">Rôles sociaux tenus par d'autres élèves pendant l'observation (arbitre, observateur, coach, chronométreur…). À la fin, le niveau atteint (0 à 4) est choisi pour chacun et suivi au fil des leçons. Seuls les niveaux décrits sont proposés.</div>
    ${C.roles.map((r, i) => `<div class="card"><div class="row"><label class="field grow">Nom du rôle <input type="text" data-cfg="roles.${i}.name" data-t="text" value="${esc(r.name)}"></label><button class="btn small red" data-action="delRole" data-i="${i}" style="align-self:flex-end">✕ Supprimer</button></div>
      ${r.levels.map((t, k) => `<div class="cons-row"><span class="cons-l" style="${heat(k, 4)}">Niveau ${k}</span><input type="text" class="grow" data-cfg="roles.${i}.levels.${k}" data-t="text" value="${esc(t)}" placeholder="${k === 0 ? '(vide = non proposé)' : 'Description du niveau ' + k}"></div>`).join('')}</div>`).join('')}
    <button class="btn green" data-action="addRole" ${C.roles.length >= MAX_ROLES ? 'disabled' : ''}>＋ Ajouter un rôle (${C.roles.length}/${MAX_ROLES})</button>`;
}

function pResultats(){
  return `<div class="card"><h3>Ce que l'élève voit à la fin d'une observation</h3>
    ${chk('results.recap', 'Récapitulatif (champs calculés)')}${chk('results.table', 'Tableau des boutons (nombre et points)')}
    ${chk('results.indicators', 'Indicateurs avec graphiques')}${chk('results.conseils', 'Conseils personnalisés')}
    ${chk('results.compare', 'Comparaison avec la leçon précédente (mêmes élèves)')}${chk('results.roles', 'Évaluation des rôles')}</div>`;
}

function pFichier(){
  return `<div class="card"><h3>💾 Exporter ce paramétrage</h3><p class="muted">Fichier .json à importer sur les autres tablettes (élèves ou collègues) : rien à reparamétrer.</p>
      <div class="btn-row"><button class="btn green" data-action="cfgExport">📤 Fichier .json (avec images)</button><button class="btn" data-action="cfgQR">▦ Afficher en QR (sans images)</button></div></div>
    <div class="card"><h3>📥 Importer un paramétrage</h3><p class="muted">Fichier .json d'Obs'EPS <b>ou</b> fichier de configuration de l'appli <b>Gain EPS CA4</b> (repris automatiquement).</p>
      <div class="btn-row"><label class="btn primary">📂 Choisir un fichier<input type="file" accept=".json,application/json" data-file="json" hidden></label><button class="btn" data-action="cfgScan">📷 Scanner un QR de paramétrage</button></div>
      <div id="cfg-scan"></div></div>
    <div class="card"><h3>Repartir de zéro</h3><button class="btn small ghost" data-action="cfgReset">↺ Paramétrage d'exemple (handball)</button>
      <p class="muted">Astuce : le QR de la leçon peut aussi transmettre le paramétrage aux tablettes élèves (case à cocher dans « Leçon du jour »).</p></div>`;
}

/* ---------- Actions du paramétrage ---------- */
Object.assign(A, {
  ptab: d => { UI.ptab = d.t; UI.lsel = null; render(); },
  setNbObs: d => { CFG().nbObs = +d.n; cfgChanged(); },
  setCfg: d => { setPath(CFG(), d.p, d.v); cfgChanged(); },
  clearImg: d => { setPath(CFG(), d.k, ''); cfgChanged(); },
  addBtn: () => { const n = $('#nb-name').value.trim(); if (!n) return toast('Nom du bouton ?');
    CFG().buttons.push({ id: bid(), name: n, pts: +$('#nb-pts').value || 0, color: CHART_COLORS[CFG().buttons.length % 10], exp: true }); cfgChanged(); setTimeout(() => $('#nb-name')?.focus(), 50); },
  delBtn: async d => { const b = CFG().buttons[+d.i]; if (!(await confirmBox('Supprimer ce bouton ?', `« ${esc(b.name)} » sera retiré de la grille et des indicateurs.`, 'Supprimer', true))) return;
    CFG().buttons.splice(+d.i, 1); CFG().indicators.forEach(ind => { ind.btns = ind.btns.filter(x => x !== b.id); ind.num = ind.num.filter(x => x !== b.id); }); cfgChanged(); },
  moveBtn: d => { const B = CFG().buttons, i = +d.i, j = i + +d.d; [B[i], B[j]] = [B[j], B[i]]; cfgChanged(); },
  loadTpl: async d => { const t = TEMPLATES[d.k]; if (!(await confirmBox('Charger le modèle ' + t.name + ' ?', 'Les boutons, la disposition, les indicateurs et les conseils actuels seront remplacés.', 'Charger'))) return;
    const C = CFG(); C.name = t.name; C.libelle = t.libelle; C.buttons = t.b.map(([name, pts], i) => ({ id: bid(), name, pts, color: CHART_COLORS[i % 10], exp: true }));
    C.layout.cells = {}; C.layout.cols = 4; C.layout.rows = Math.ceil(C.buttons.length / 4); C.indicators = []; C.recap = [{ label: 'Actions', formula: 'OA' }, { label: 'Score', formula: 'SA' }]; cfgChanged(); toast('Modèle chargé : pensez aux indicateurs'); },
  lpick: d => { UI.lsel = UI.lsel === d.id ? null : d.id; render(); },
  lpal: () => { if (UI.lsel && UI.lsel[0] === 'c' && /^c\d+$/.test(UI.lsel)) { delete CFG().layout.cells[UI.lsel.slice(1)]; UI.lsel = null; cfgChanged(); } },
  lcell: d => { const L = CFG().layout, k = d.k;
    if (UI.lsel && !/^c\d+$/.test(UI.lsel)) { Object.keys(L.cells).forEach(x => { if (L.cells[x] === UI.lsel) delete L.cells[x]; }); L.cells[k] = UI.lsel; UI.lsel = null; return cfgChanged(); }
    if (UI.lsel && /^c\d+$/.test(UI.lsel)) { const from = UI.lsel.slice(1); if (from !== k) { const a = L.cells[from], b = L.cells[k]; if (a) L.cells[k] = a; else delete L.cells[k]; if (b) L.cells[from] = b; else delete L.cells[from]; } UI.lsel = null; return cfgChanged(); }
    if (L.cells[k]) { UI.lsel = 'c' + k; render(); } },
  lauto: () => { const L = CFG().layout; L.cells = {}; const n = CFG().buttons.length; if (n > L.cols * L.rows) L.rows = Math.min(6, Math.ceil(n / L.cols)); CFG().buttons.forEach((b, i) => { if (i < L.cols * L.rows) L.cells[i] = b.id; }); cfgChanged(); },
  lclear: () => { CFG().layout.cells = {}; UI.lsel = null; cfgChanged(); },
  addDD: () => { CFG().dropdowns.push({ id: 'd' + rnd(4), label: 'Liste ' + (CFG().dropdowns.length + 1), type: 'simple', options: ['Option 1', 'Option 2'] }); cfgChanged(); },
  delDD: d => { CFG().dropdowns.splice(+d.i, 1); cfgChanged(); },
  addRecap: () => { CFG().recap.push({ label: '', formula: '' }); cfgChanged(); },
  delRecap: d => { CFG().recap.splice(+d.i, 1); cfgChanged(); },
  addInd: () => { CFG().indicators.push({ id: 'i' + rnd(4), title: 'Indicateur ' + (CFG().indicators.length + 1), btns: [], num: [], chart: 'pie', colors: {}, interp: '', intervals: [0, 50], conseils: {} }); cfgChanged(); },
  delInd: async d => { if (await confirmBox('Supprimer cet indicateur ?', 'Ses conseils seront aussi supprimés.', 'Supprimer', true)) { CFG().indicators.splice(+d.i, 1); cfgChanged(); } },
  indBtn: d => { const ind = CFG().indicators[+d.i]; if (ind.btns.includes(d.id)) { ind.btns = ind.btns.filter(x => x !== d.id); ind.num = ind.num.filter(x => x !== d.id); } else ind.btns.push(d.id); cfgChanged(); },
  indNum: d => { const ind = CFG().indicators[+d.i]; ind.num = ind.num.includes(d.id) ? ind.num.filter(x => x !== d.id) : [...ind.num, d.id]; cfgChanged(); },
  addRole: () => { CFG().roles.push({ id: 'r' + rnd(4), name: 'Nouveau rôle', levels: ['', 'Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4'] }); cfgChanged(); },
  delRole: async d => { if (await confirmBox('Supprimer ce rôle ?', '', 'Supprimer', true)) { CFG().roles.splice(+d.i, 1); cfgChanged(); } },
  cfgExport: () => downloadFile(JSON.stringify({ app: 'obseps-config', v: 1, exportDate: new Date().toISOString(), cfg: CFG() }, null, 1), `parametrage-${slug(CFG().name)}-${stamp()}.json`),
  cfgQR: () => { const m = modal(`<h2>▦ Paramétrage « ${esc(CFG().name)} »</h2><p class="muted">À scanner depuis « 📷 Recevoir la leçon » (tablette élève) ou « Modèles & JSON » (tablette enseignant). Les images ne passent pas par QR.</p><div id="qr-cfg"></div><div class="btn-row center-row"><button class="btn" data-action="closeModal">Fermer</button></div>`, { wide: true });
    showPacketQR(buildCfg(true), 'C', m.querySelector('#qr-cfg'), ''); },
  cfgScan: () => startScan($('#cfg-scan'), ['C'], async p => { const r = await applyPacket(p); if (r !== 'continue') render(); return r; }),
  cfgReset: async () => { if (await confirmBox('Revenir au paramétrage d\'exemple ?', 'Le paramétrage actuel sera remplacé (pensez à l\'exporter avant).', 'Remplacer', true)) { ROOT.cfg = normConfig(defaultConfig()); save(); render(); } },
  previewObs: () => { const C = CFG(); const z = Array.from({ length: C.nbObs }, (_, i) => ({ s: [], col: [COLORS[0].c, COLORS[1].c][i], c: {}, dd: {} }));
    modal(`<h2>👁 Aperçu de l'écran d'observation</h2><div class="zones ${z.length > 1 ? 'two' : ''}">${z.map((zz, zi) => `<section class="zone"><div class="zone-h" style="background:${zz.col};color:${textOn(zz.col)}"><b>${esc(C.libelle)} ${C.nbObs > 1 ? zi + 1 : ''}</b></div>${zoneGrid(zi, zz, false)}${ddHTML(zi, zz)}</section>`).join('')}</div>
      <div class="btn-row center-row"><button class="btn" data-action="closeModal">Fermer</button></div>`, { wide: true }); }
});
Object.assign(F, {
  timerMin: el => { CFG().timer.sec = Math.max(30, Math.round(parseFloat(el.value.replace(',', '.')) * 60) || 300); cfgChanged(false); },
  ddOptions: el => { CFG().dropdowns[+el.dataset.i].options = el.value.split(',').map(s => s.trim()).filter(Boolean); cfgChanged(false); },
  indColor: el => { CFG().indicators[+el.dataset.i].colors[el.dataset.id] = el.value; cfgChanged(false); },
  intervals: el => { const ind = CFG().indicators[+el.dataset.i]; const v = [...new Set(el.value.split(/[,;\s]+/).map(Number).filter(x => !isNaN(x)))].sort((a, b) => a - b);
    if (!v.length) return toast('Au moins un seuil'); if (v[0] > 0) v.unshift(0); ind.intervals = v; cfgChanged(); },
  conseil: el => { CFG().indicators[+el.dataset.i].conseils[el.dataset.x] = el.value; cfgChanged(false); }
});
Object.assign(FILES, {
  cfgImage: async f => { try { CFG().image = await readImage(f, 600); cfgChanged(); } catch(e){ toast(e.message); } },
  bgImage: async f => { try { CFG().layout.bg = await readImage(f, 1100); cfgChanged(); } catch(e){ toast(e.message); } }
});
