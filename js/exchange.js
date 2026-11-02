/* =====================================================================
   Échanges entre tablettes (principe de l'appli Biathlon)
   - QR « Leçon »   : enseignant → tablettes élèves (classe, leçon, appel, paramétrage)
   - QR « Saisies » : tablette élève → enseignant (observations faites sur la tablette)
   - QR « Historique » : enseignant → autre tablette enseignant
   - QR « Paramétrage » : paramétrage seul (n'importe quelle tablette)
   Secours : fichiers .json (AirDrop, Partage à proximité, clé USB, ENT…)
   Format : JSON → deflate → base45 → morceaux « OE:type:id:i:n:données »
   ===================================================================== */
'use strict';

/* Paramétrage sans images (trop lourdes pour un QR) */
function cfgLite(cfg = CFG()){ const c = clone(cfg); c.image = ''; c.layout.bg = ''; c._lite = true; return c; }

function buildSeance(withCfg){
  const n = curLesson();
  return { k:'seance', cid: S.id, className: S.name, nbLessons: S.nbLessons, n, title: lesson(n).title, at: now(),
    students: sortedStudents().map(s => ({ id: s.id, disp: nameOf(s.id), grp: s.grp || 0 })),
    att: lesson(n).att, cfg: withCfg ? cfgLite() : null };
}
function buildMine(){
  const obs = allObs().filter(o => o.d === ROOT.deviceId);
  const del = Object.values(S.obs).filter(o => o.del && o.d === ROOT.deviceId).map(o => ({ id: o.id, del: 1, ts: o.ts, d: o.d, n: o.n, z: [] }));
  return { k:'res', cid: S.id, className: S.name, from: ROOT.deviceId, at: now(), obs: [...obs, ...del] };
}
function buildFull(withNames){
  return { k:'full', cid: S.id, className: S.name, nbLessons: S.nbLessons, current: S.current, at: now(),
    students: S.students.map(s => withNames ? { ...s } : { id: s.id, disp: nameOf(s.id), grp: s.grp || 0 }),
    lessons: S.lessons, obs: Object.values(S.obs), cfg: null };
}
function buildCfg(lite){ return { k:'cfg', at: now(), cfg: lite ? cfgLite() : clone(CFG()) }; }

/* Fusion d'observations : la plus récente gagne */
function mergeObs(c, list){
  let n = 0;
  (list || []).forEach(o => { if (!o || !o.id) return; const cur = c.obs[o.id];
    if (!cur || (o.ts || 0) > (cur.ts || 0) || (o.del && !cur.del)) { c.obs[o.id] = o; n++; } });
  return n;
}
function classFor(cid, name, create){
  if (cid && ROOT.classes[cid]) return ROOT.classes[cid];
  if (create) { const c = newClass(name, cid); ROOT.classes[c.id] = c; return c; }
  return null;
}
/* Application d'un paramétrage reçu (on garde les images locales si c'est le même paramétrage) */
function applyCfg(cfg){
  const old = CFG(), c = normConfig(cfg);
  if (cfg._lite && old.uid === c.uid) { c.image = old.image; c.layout.bg = old.layout.bg; }
  delete c._lite;
  ROOT.cfg = c;
}
const hasFullNames = c => c.students.some(s => s.nom);

async function applyPacket(p){
  if (!p || !p.k) throw new Error('Données non reconnues');
  if (p.k === 'seance') {
    if (isProf()) throw new Error('QR de la leçon : à scanner sur les tablettes élèves');
    const c = classFor(p.cid, p.className, true);
    c.name = p.className || c.name; c.nbLessons = p.nbLessons || c.nbLessons; c.current = p.n;
    c.students = p.students.map(s => ({ id: s.id, disp: s.disp, grp: s.grp || 0 }));
    const L = lesson(p.n, c); L.title = p.title || ''; L.att = p.att || {};
    if (p.cfg) applyCfg(p.cfg);
    ROOT.seance = { cid: c.id, n: p.n, at: now() };
    useClass(c.id); save();
    toast(`✓ ${c.name} · leçon ${p.n} reçue${p.cfg ? ' (avec le paramétrage)' : ''}`, 3500);
    return 'done';
  }
  if (p.k === 'res') {
    const c = classFor(p.cid, p.className, false);
    if (!c) throw new Error('Classe inconnue sur cette tablette (' + (p.className || p.cid) + ')');
    const n = mergeObs(c, p.obs); save();
    toast(`✓ ${c.name} · tablette ${p.from} : ${n} observation(s) récupérée(s)`, 3500);
    return n;
  }
  if (p.k === 'full') {
    const c = classFor(p.cid, p.className, true);
    if (!hasFullNames(c) || p.students.some(s => s.nom)) {
      c.students = p.students.map(s => ({ ...s })); c.name = p.className || c.name;
      c.nbLessons = p.nbLessons || c.nbLessons; c.current = p.current || c.current;
      Object.entries(p.lessons || {}).forEach(([n, L]) => c.lessons[n] = { ...(c.lessons[n] || {}), ...L });
    }
    const n = mergeObs(c, p.obs);
    if (p.cfg) applyCfg(p.cfg);
    useClass(c.id); save(); toast(`✓ Historique ${c.name} : ${n} observation(s) ajoutée(s)`, 3500);
    return n;
  }
  if (p.k === 'cfg') {
    if (!(await confirmBox('Remplacer le paramétrage ?', `Paramétrage reçu : <b>${esc(p.cfg.name || '')}</b>. Le paramétrage actuel de cette tablette sera remplacé (les élèves et observations sont conservés).`, 'Remplacer'))) return 'continue';
    applyCfg(p.cfg); save(); toast('✓ Paramétrage « ' + (CFG().name) + ' » installé', 3000);
    return 'done';
  }
  if (p.k === 'backup') {
    if (!(await confirmBox('Restaurer la sauvegarde ?', 'Toutes les classes, observations et le paramétrage de cet appareil seront remplacés.', 'Restaurer', true))) return 'continue';
    const dev = ROOT.deviceId, role = ROOT.role; ROOT = p.root; ROOT.deviceId = dev; ROOT.role = role;
    ROOT.cfg = normConfig(ROOT.cfg); Object.values(ROOT.classes).forEach(normClass);
    useClass(ROOT.classes[ROOT.active] ? ROOT.active : Object.keys(ROOT.classes)[0]); save(); toast('✓ Sauvegarde restaurée');
    return 'done';
  }
  throw new Error('Type de données inconnu');
}

/* Fichier .json : paquet d'échange, paramétrage seul (format Obs'EPS ou Gain EPS) ou sauvegarde */
async function importJSONFile(file){
  try {
    const obj = JSON.parse(await file.text());
    let r;
    if (obj.k) r = await applyPacket(obj);
    else if (obj.app === 'obseps-config' && obj.cfg) r = await applyPacket({ k:'cfg', cfg: obj.cfg });
    else if (obj.data && (obj.data.indicators || obj.data.configActivite)) r = await applyPacket({ k:'cfg', cfg: fromGainConfig(obj.data) });
    else throw new Error('Fichier non reconnu');
    render();
    return r;
  } catch(e){ toast('⚠️ ' + e.message, 4000); }
}

/* Reprise d'un fichier de configuration de l'appli Gain EPS CA4 */
function fromGainConfig(d){
  const c = defaultConfig();
  const act = d.configActivite || {};
  c.name = act.activite || 'Activité'; c.libelle = act.libelle || 'Équipe'; c.nbObs = +act.nbObserve === 2 ? 2 : 1;
  c.image = act.image || ''; c.guidance = d.guidanceText || '';
  const ind = (d.indicators || []).map(x => typeof x === 'string' ? { name: x, points: 1 } : x);
  c.buttons = ind.map(x => ({ id: bid(), name: x.name, pts: +x.points || 0, color: '', exp: x.includeInExport !== false }));
  const byName = n => c.buttons.find(b => b.name === n);
  const L = d.layoutConfig || {};
  c.layout = { ...c.layout, cols: 5, rows: 4, cells: {}, bg: L.backgroundImage || '', bgMode: L.backgroundMode === 'mirror' ? 'mirror' : 'identical' };
  (L.gridLayout || []).forEach(it => { const b = byName(it.button?.name); if (b) c.layout.cells[it.cellIndex] = b.id; });
  if (!Object.keys(c.layout.cells).length) { c.layout.cols = 4; c.layout.rows = Math.max(1, Math.ceil(c.buttons.length / 4)); }
  c.dropdowns = (d.dropdownButtons || []).map(x => ({ id: 'd' + rnd(4), label: x.label, type: x.type === 'classe-eleve' ? 'eleve' : 'simple', options: x.options || [] }));
  const R = d.observationRecapConfig;
  if (R) c.recap = [R.recap1 || R.recapA, R.recap2 || R.recapB].filter(Boolean).map(x => ({ label: x.label || '', formula: x.formula || '' }));
  const ref = s => { const m = /^A(\d+)$/i.exec(String(s).trim()); return m ? c.buttons[+m[1] - 1] : null; };
  c.indicators = (d.calculatedIndicators || []).slice(0, MAX_INDIC).map((x, i) => {
    const btns = String(x.buttons || '').split(',').map(ref).filter(Boolean);
    const cc = (d.conseilsConfig || {})['calc_' + i] || {};
    const num = String(cc.calculButtons || '').split(',').map(s => { const m = /^A(\d+)$/i.exec(s.trim()); return m ? btns[+m[1] - 1] : null; }).filter(Boolean);
    const conseils = {}; Object.entries(cc.conseils || {}).forEach(([k, t]) => conseils[parseFloat(k.split('_')[0])] = t);
    const colors = {}; Object.entries(x.buttonColors || {}).forEach(([n, col]) => { const b = byName(n); if (b) colors[b.id] = col; });
    return { id: 'i' + rnd(4), title: x.title || 'Indicateur ' + (i + 1), btns: btns.map(b => b.id), num: num.map(b => b.id), chart: x.chartType === 'histogramme' || x.chartType === 'bar' ? 'bar' : 'pie',
      colors, interp: x.interpretation || '', intervals: cc.intervals || [0, 20, 40, 60], conseils };
  });
  const A = d.arbitrageConfig || {};
  c.roles = ['roleA', 'roleB'].map(k => A[k]).filter(r => r && r.nom).map(r => ({ id: 'r' + rnd(4), name: r.nom, levels: Array.from({ length: 5 }, (_, k) => (r.niveaux || [])[k] || '') }));
  return c;
}

/* ---------- Encodage : base45 + compression ---------- */
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function b45enc(u8){ let s = '';
  for (let i = 0; i < u8.length; i += 2) {
    if (i + 1 < u8.length) { let x = u8[i] * 256 + u8[i+1]; const c = x % 45; x = (x - c) / 45; const d = x % 45; const e = (x - d) / 45; s += B45[c] + B45[d] + B45[e]; }
    else { const x = u8[i], c = x % 45, d = (x - c) / 45; s += B45[c] + B45[d]; }
  } return s; }
function b45dec(s){ const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const c = B45.indexOf(s[i]), d = B45.indexOf(s[i+1]);
    if (i + 2 < s.length) { const x = c + d * 45 + B45.indexOf(s[i+2]) * 2025; out.push(x >> 8, x & 255); }
    else out.push(c + d * 45);
  } return new Uint8Array(out); }
async function streamBytes(u8, ts){ const st = new Blob([u8]).stream().pipeThrough(ts); return new Uint8Array(await new Response(st).arrayBuffer()); }
async function encodePacket(obj){
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { try { return 'Z' + b45enc(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch(e){} }
  return 'J' + b45enc(raw);
}
async function decodePacket(str){
  let raw = b45dec(str.slice(1));
  if (str[0] === 'Z') { if (!window.DecompressionStream) throw new Error('Appareil trop ancien pour décompresser'); raw = await streamBytes(raw, new DecompressionStream('deflate-raw')); }
  return JSON.parse(new TextDecoder().decode(raw));
}
function chunkQR(payload, type, max=QR_CHUNK){
  const id = rnd(3).toUpperCase(), parts = [], n = Math.max(1, Math.ceil(payload.length / max)), per = Math.ceil(payload.length / n);
  for (let i = 0; i < n; i++) parts.push(`OE:${type}:${id}:${i+1}:${n}:` + payload.slice(i * per, (i + 1) * per));
  return parts;
}
function parsePart(txt){
  if (!txt || !txt.startsWith('OE:')) return null;
  const f = txt.split(':'); if (f.length < 6) return null;
  return { type: f[1], id: f[2], i: +f[3], n: +f[4], data: f.slice(5).join(':') };
}
function qrDataURL(text){ const qr = qrcode(0, 'L'); qr.addData(text, 'Alphanumeric'); qr.make(); return qr.createDataURL(10, 40); }

/* Série de QR (défilement automatique, 1 par seconde) */
let qrTimer = null;
function showQRSeries(parts, container, title){
  let i = 0, auto = parts.length > 1;
  const imgs = parts.map(qrDataURL);
  const draw = () => {
    container.innerHTML = `<div class="qr-box">${title ? `<h3 class="center">${title}</h3>` : ''}
      <img src="${imgs[i]}" alt="QR code ${i+1}/${parts.length}">
      <div class="qr-part">${parts.length > 1 ? `QR ${i+1} / ${parts.length}` : 'QR unique'}</div>
      ${parts.length > 1 ? `<div class="qr-nums">${parts.map((_, k) => `<button class="${k === i ? 'on' : ''}" data-q="${k}">${k+1}</button>`).join('')}</div>
        <div class="btn-row center-row"><button class="btn small" data-q="prev">←</button><button class="btn small ${auto ? 'orange' : ''}" data-q="auto">${auto ? '⏸ Pause' : '▶ Défilement'}</button><button class="btn small" data-q="next">→</button></div>` : ''}</div>`;
    container.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = b.dataset.q;
      if (q === 'auto') auto = !auto; else if (q === 'prev') { auto = false; i = (i - 1 + parts.length) % parts.length; }
      else if (q === 'next') { auto = false; i = (i + 1) % parts.length; } else { auto = false; i = +q; } draw(); });
  };
  clearInterval(qrTimer);
  qrTimer = setInterval(() => { if (!document.body.contains(container)) return clearInterval(qrTimer); if (auto) { i = (i + 1) % parts.length; draw(); } }, 1000);
  draw();
}
async function showPacketQR(obj, type, container, title, chunk=QR_CHUNK){
  container.innerHTML = '<p class="center muted">Préparation…</p>';
  const payload = await encodePacket(obj);
  showQRSeries(chunkQR(payload, type, chunk), container, title);
}

/* ---------- Lecture des QR : caméra (détecteur natif, ZXing, jsQR) + photo ---------- */
let scan = null;
function stopScan(){ if (!scan) return; scan.stopped = true; clearTimeout(scan.timer); if (scan.stream) scan.stream.getTracks().forEach(t => t.stop()); scan = null; }
let nativeDetector, scanCamIdx = 0, scanCamId = null;
async function getNativeDetector(){
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) nativeDetector = new BarcodeDetector({ formats:['qr_code'] }); } catch(e){}
  return nativeDetector;
}
const SCAN_SCALES = [0.4, 0.3, 0.5, 0.24, 0.62, 0.35, 0.8, 0.45];
function grabGray(ctx, cv, src, sx, sy, sw, sh, maxSide){
  const k = Math.min(1, maxSide / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
  cv.width = w; cv.height = h; ctx.imageSmoothingEnabled = true; ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.3 + d[j+1] * 0.59 + d[j+2] * 0.11;
  return { g, w, h };
}
function boxDown(G, f){
  const { g, w, h } = G; if (f >= 0.999) return G;
  const nw = Math.max(1, Math.round(w * f)), nh = Math.max(1, Math.round(h * f)), o = new Float32Array(nw * nh), c = new Float32Array(nw * nh);
  for (let y = 0; y < h; y++) { const row = Math.min(nh - 1, (y * f) | 0) * nw; for (let x = 0; x < w; x++) { const i = row + Math.min(nw - 1, (x * f) | 0); o[i] += g[y * w + x]; c[i]++; } }
  for (let i = 0; i < o.length; i++) o[i] /= c[i] || 1;
  return { g: o, w: nw, h: nh };
}
function jsqrGray(G, both){
  if (!window.jsQR) return null;
  const { g, w, h } = G, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { d[j] = d[j+1] = d[j+2] = g[i]; d[j+3] = 255; }
  const c = jsQR(d, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
  return c && c.data ? c.data : null;
}
let zxReady = false;
try { if (window.ZXingWASM) ZXingWASM.prepareZXingModule({ overrides: { locateFile: (path, prefix) => path.endsWith('.wasm') ? new URL('lib/' + path, document.baseURI).href : prefix + path }, fireImmediately: true })
  .then(() => { zxReady = true; }).catch(e => console.warn('ZXing', e)); } catch(e){}
async function zxRead(imgData, hard=true){
  if (!zxReady) return null;
  try { const r = await ZXingWASM.readBarcodes(imgData, { formats:['QRCode'], tryHarder: hard, maxNumberOfSymbols: 1 }); const ok = r.find(x => x.isValid && x.text); return ok ? ok.text : null; } catch(e){ return null; }
}
async function decodeImageSource(src, sw, sh, cv, ctx, frame, all=false){
  const det = await getNativeDetector();
  if (det) { try { const r = await det.detect(src); if (r && r.length) return r.map(x => x.rawValue); } catch(e){} }
  const side = Math.min(sw, sh) * 0.92, sx = (sw - side) / 2, sy = (sh - side) / 2;
  if (zxReady) {
    const k = Math.min(1, (all ? 1000 : 800) / side), w = Math.round(side * k);
    cv.width = w; cv.height = w; ctx.drawImage(src, sx, sy, side, side, 0, 0, w, w);
    let t = await zxRead(ctx.getImageData(0, 0, w, w), all || frame % 3 !== 1); if (t) return [t];
    if (all || frame % 3 === 2) { const k2 = Math.min(1, 1280 / Math.max(sw, sh)), w2 = Math.round(sw * k2), h2 = Math.round(sh * k2);
      cv.width = w2; cv.height = h2; ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w2, h2); t = await zxRead(ctx.getImageData(0, 0, w2, h2)); if (t) return [t]; }
    if (!all && frame % 2 === 0) return [];
  }
  const G = grabGray(ctx, cv, src, sx, sy, side, side, 1100);
  const scales = all ? SCAN_SCALES : [SCAN_SCALES[frame % SCAN_SCALES.length], SCAN_SCALES[(frame + 3) % SCAN_SCALES.length]];
  for (const f of scales) { const t = jsqrGray(boxDown(G, f * side / G.w), all || frame % 5 === 4); if (t) return [t]; }
  if (all || frame % 4 === 3) { const F = grabGray(ctx, cv, src, 0, 0, sw, sh, 1100); for (const f of (all ? [0.35, 0.5, 0.7] : [0.5])) { const t = jsqrGray(boxDown(F, f), all); if (t) return [t]; } }
  return [];
}
const QR_TYPES = { S:'QR de la leçon', R:'QR des saisies d\'une tablette élève', F:'QR historique', C:'QR de paramétrage' };
async function startScan(container, expect, onDone){
  stopScan();
  container.innerHTML = `<div class="scan-wrap"><video playsinline webkit-playsinline muted autoplay></video><div class="scan-frame"></div></div>
    <div class="scan-info"><div class="scan-parts"></div><p class="center scan-msg" id="scan-msg">Démarrage de la caméra…</p>
      <div class="btn-row center-row"><button class="btn small" data-cam>🔄 Caméra</button><label class="btn small orange">📷 Photo du QR<input type="file" accept="image/*" capture="environment" hidden class="scan-photo"></label></div></div>`;
  const video = container.querySelector('video'), msg = container.querySelector('#scan-msg'), partsEl = container.querySelector('.scan-parts');
  const me = scan = { stopped: false, parts: {}, id: null, n: 0, frame: 0 };
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const showParts = () => { const got = Object.keys(me.parts).length, p = me.n ? Math.round(got / me.n * 100) : 0;
    partsEl.innerHTML = me.n > 1 ? `<div class="scan-prog"><div class="scan-bar" style="width:${p}%"></div><span>${got}/${me.n} QR</span></div>` : ''; };
  let finished = false;
  const handle = async texts => {
    for (const txt of texts) {
      const pt = parsePart(txt);
      if (!pt) { msg.textContent = 'QR non reconnu (ce n\'est pas un QR Obs\'EPS).'; continue; }
      if (expect.length && !expect.includes(pt.type)) { msg.textContent = `Ce QR est un « ${QR_TYPES[pt.type] || '?'} » : il ne se scanne pas ici.`; continue; }
      if (pt.id === me.doneId) continue;
      if (me.id !== pt.id) { me.id = pt.id; me.parts = {}; me.n = pt.n; }
      if (!me.parts[pt.i]) { me.parts[pt.i] = pt.data; if (navigator.vibrate) navigator.vibrate(40); }
      const got = Object.keys(me.parts).length; showParts();
      msg.textContent = me.n > 1 ? (got < me.n ? `Lecture : ${got}/${me.n} · laissez défiler les QR devant la caméra` : 'Lecture terminée') : 'QR reçu !';
      if (got === me.n && !finished) {
        finished = true;
        const payload = Array.from({ length: me.n }, (_, k) => me.parts[k+1]).join('');
        me.doneId = me.id; me.id = null; me.parts = {};
        let r;
        try { r = await onDone(await decodePacket(payload)); } catch(e){ console.warn(e); toast('⚠️ ' + e.message, 4000); r = 'continue'; }
        if (r === 'continue' && scan === me && !me.stopped) { finished = false; showParts(); msg.textContent = '✓ Reçu — QR suivant ?'; me.timer = setTimeout(tick, 400); }
        else if (scan === me) stopScan();
        return;
      }
    }
  };
  container.querySelector('.scan-photo').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    msg.textContent = 'Lecture de la photo…';
    try { const bmp = await createImageBitmap(f); const pcv = document.createElement('canvas'), pctx = pcv.getContext('2d', { willReadFrequently: true });
      const r = await decodeImageSource(bmp, bmp.width, bmp.height, pcv, pctx, 0, true);
      if (r.length) await handle(r); else msg.textContent = '⚠️ QR non trouvé sur la photo : cadrez le QR bien net, en entier.';
    } catch(err){ msg.textContent = '⚠️ Photo illisible'; }
  });
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = '⚠️ Caméra indisponible : utilisez 📷 Photo du QR (ou un fichier).'; return; }
  container.querySelector('[data-cam]').onclick = async () => {
    try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (cams.length < 2) return toast('Une seule caméra'); scanCamIdx = (scanCamIdx + 1) % cams.length; scanCamId = cams[scanCamIdx].deviceId; startScan(container, expect, onDone); } catch(e){}
  };
  const attempts = scanCamId ? [{ deviceId: { exact: scanCamId } }] : [{ facingMode: 'environment' }, { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, true];
  let lastErr = null;
  for (const vc of attempts) { try { me.stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }); break; } catch(e){ lastErr = e; } }
  if (!me.stream) { const n = lastErr && lastErr.name;
    msg.textContent = n === 'NotAllowedError' ? '⚠️ Caméra refusée : autorisez la caméra dans les réglages, ou utilisez 📷 Photo du QR.' : '⚠️ Caméra impossible à ouvrir : utilisez 📷 Photo du QR.'; return; }
  if (me.stopped) { me.stream.getTracks().forEach(t => t.stop()); return; }
  const track = me.stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch(e){}
  video.muted = true; video.srcObject = me.stream; const playIt = () => video.play().catch(() => {}); video.onloadedmetadata = playIt; playIt();
  msg.textContent = 'Visez le QR code (30 à 40 cm, écran de l\'autre tablette au maximum de luminosité)…';
  const t0 = Date.now();
  const tick = async () => {
    if (me.stopped || finished) return;
    if (video.readyState >= 2 && video.videoWidth) { me.frame++;
      try { const r = await decodeImageSource(video, video.videoWidth, video.videoHeight, cv, ctx, me.frame); if (r.length) await handle(r); } catch(e){ console.warn(e); }
    } else if (Date.now() - t0 > 4000 && me.frame === 0) { msg.textContent = '⚠️ La caméra ne renvoie pas d\'image : touchez 🔄 Caméra ou utilisez 📷 Photo du QR.'; playIt(); }
    if (!me.stopped && !finished) me.timer = setTimeout(tick, 60);
  };
  tick();
}
