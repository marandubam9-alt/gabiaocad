/* ===== GabiãoCAD — interface ===== */
const DEFAULTS = {
  nome: 'Muro de gabião, trecho 1',
  L: 20, boxLen: 2, boxW: 1, stagger: false, faceMode: 'externa', batter: 6, D: 0.5,
  layers: [{ b: 3, h: 1, cf: true }, { b: 2, h: 1, cf: false }, { b: 2, h: 1, cf: false }, { b: 1, h: 1, cf: false }],
  soil: { gamma: 17.658, phi: 30, delta: 27, beta: 0, q: 9.81 },
  found: { phi: 30, c: 0, sadm: 196.2 },
  gab: { gs: 25.997, n: 0.30 },
  exc: { scenario: 'corte', folga: 0.5, m: 1.0, fill: { on: true, a: 2, m: 1.0, emp: 1.25, cap: 14 } },
  geo: { base: false, overlap: 10 },
  fs: { desl: 1.5, tomb: 2.0, glob: 1.5, globOn: true },
  units: 't',
  water: { on: false, gsat: 19.62, hw: 1.5 },
  river: { on: false, hn: 0.8, hc: 2.5, v: 3.5, ds: 1.0, apron: true, lc: 3, esp: 0.23 },
};
const LS_KEY = 'gabiaocad.v2';
const clone = o => JSON.parse(JSON.stringify(o));
function merge(base, extra) {
  const out = clone(base);
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(out)) {
    if (!(k in extra)) continue;
    if (k === 'layers') {
      if (Array.isArray(extra.layers) && extra.layers.length) {
        const ls = extra.layers.map(l => ({ b: +l.b, h: +l.h, cf: !!l.cf })).filter(l => l.b > 0 && l.h > 0);
        if (ls.length) out.layers = ls;
      }
    } else if (typeof out[k] === 'object') {
      for (const kk of Object.keys(out[k])) if (kk in (extra[k] || {})) out[k][kk] = extra[k][kk];
    } else out[k] = extra[k];
  }
  return out;
}
function sanitize(s) {
  if (typeof LIMITS === 'undefined') return s;
  for (const k of Object.keys(LIMITS)) {
    const [lo, hi] = LIMITS[k];
    let v; try { v = getK(s, k); } catch (e) { continue; }
    const d = getK(DEFAULTS, k);
    if (!Number.isFinite(+v)) v = d;
    setK(s, k, Math.min(hi, Math.max(lo, +v)));
  }
  s.layers = s.layers.slice(0, 30).map(l => {
    const cf = !!l.cf, step = cf ? 0.5 : 1;
    const b = Math.min(8, Math.max(1, Math.round((+l.b || 1) / step + 1e-9) * step));
    return { b, h: [0.5, 1].includes(+l.h) ? +l.h : 1, cf };
  });
  if (![1.5, 2, 3, 4].includes(+s.boxLen)) s.boxLen = 2;
  return s;
}
let st = clone(DEFAULTS);

try { const s = localStorage.getItem(LS_KEY); if (s) st = merge(DEFAULTS, JSON.parse(s)); else { const o = localStorage.getItem('gabiaocad.v1'); if (o) { st = merge(DEFAULTS, JSON.parse(o)); st.stagger = false; } } } catch (e) {}
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = (n, d = 2) => (n === Infinity ? '∞' : Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const isT = () => st.units === 't';
const UF = () => (isT() ? 9.81 : 1);
const UL = q => ({ dens: isT() ? 't/m³' : 'kN/m³', press: isT() ? 'tf/m²' : 'kPa', force: isT() ? 'tf/m' : 'kN/m', mom: isT() ? 'tf·m/m' : 'kN·m/m' }[q]);
const uN = (v, d) => (Number.isFinite(v) ? +(v / UF()).toFixed(d ?? (isT() ? 3 : 2)) : v);
const uf = (v, q, d) => fmt(v / UF(), d ?? (isT() ? 2 : (q === 'dens' ? 1 : 0))) + ' ' + UL(q);
const getK = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const setK = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3200); }

/* ---------- valores de referência ---------- */
const PRESETS = {
  aterro: [
    ['Areia compacta', 1.90, 35], ['Areia média', 1.80, 32], ['Solo arenoso compactado', 1.85, 30],
    ['Silte', 1.75, 27], ['Argila compactada', 1.80, 25], ['Saibro / pedregulho', 2.00, 35],
  ].map(([n, g, p]) => ({ n, apply: () => { st.soil.gamma = +(g * 9.81).toFixed(3); st.soil.phi = p; st.soil.delta = Math.round(0.9 * p); }, is: () => Math.abs(st.soil.gamma - g * 9.81) < 0.05 && st.soil.phi === p })),
  fundacao: [
    ['Argila mole', 20, 5], ['Argila média a rija', 25, 15], ['Areia média', 30, 25], ['Areia compacta / saibro', 33, 35], ['Rocha alterada', 35, 60],
  ].map(([n, p, s]) => ({ n, apply: () => { st.found.phi = p; st.found.c = 0; st.found.sadm = +(s * 9.81).toFixed(3); }, is: () => st.found.phi === p && Math.abs(st.found.sadm - s * 9.81) < 0.05 })),
  agua: [
    ['Boa: 1/3 da altura', 1 / 3], ['Ruim: 2/3 da altura', 2 / 3], ['Entupida: até o topo', 1],
  ].map(([n, k]) => ({ n, apply: () => { st.water.on = true; st.water.hw = +(st.layers.reduce((s, l) => s + l.h, 0) * k).toFixed(2); }, is: () => st.water.on && Math.abs(st.water.hw - st.layers.reduce((s, l) => s + l.h, 0) * k) < 0.01 })),
  rocha: [
    ['Granito / gnaisse', 2.65], ['Basalto', 2.85], ['Calcário', 2.55], ['Quartzito', 2.60],
  ].map(([n, g]) => ({ n, apply: () => { st.gab.gs = +(g * 9.81).toFixed(3); }, is: () => Math.abs(st.gab.gs - g * 9.81) < 0.05 })),
};
function renderPresets() {
  $$('[data-preset-group]').forEach(box => {
    const g = box.dataset.presetGroup, lab = box.querySelector('span').outerHTML;
    box.innerHTML = lab + PRESETS[g].map((p, k) => `<button type="button" data-preset="${g}:${k}" aria-pressed="${p.is()}">${p.n}</button>`).join('');
  });
}

/* ---------- entradas ---------- */
function fillInputs() {
  $('#projName').value = st.nome;
  $$('[data-k]').forEach(el => {
    const v = getK(st, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.dataset.u) { el.value = +(v / UF()).toFixed(3); el.step = el.dataset.u === 'dens' ? (isT() ? 0.05 : 0.5) : (isT() ? 0.5 : 5); }
    else el.value = v;
  });
  $$('.inp.bad').forEach(b => { b.classList.remove('bad'); b.title = ''; });
  $$('.errmsg').forEach(m => (m.hidden = true));
  $$('[data-units]').forEach(b => b.setAttribute('aria-pressed', b.dataset.units === st.units));
  $$('[data-unit]').forEach(s => (s.textContent = UL(s.dataset.unit)));
  $$('.uv').forEach(s => (s.textContent = fmt(+s.dataset.v * 9.81 / UF(), isT() ? 1 : 0) + (s.dataset.unitShow ? ' ' + UL(s.dataset.q) : '')));
  $('#scenHelp').textContent = st.exc.scenario === 'corte'
    ? 'Corte: o terreno natural está na altura do topo do muro e vai ser cortado para encaixar o muro.'
    : 'Aterro: o terreno natural está na base do muro. Escava-se só a vala da fundação, monta-se o gabião e depois aterra-se atrás.';
  if (!(st.exc.fill.cap > 0)) st.exc.fill.cap = 14;
  if (!(st.exc.fill.emp > 0)) st.exc.fill.emp = 1.25;
  $('#fillBox').hidden = st.exc.scenario !== 'aterro';
  $('#fillFields').hidden = !st.exc.fill.on;
  $('#waterFields').hidden = !st.water.on;
  $('#riverFields').hidden = !st.river.on;
  $('#apronFields').hidden = !st.river.apron;
  renderPresets();
  $$('[data-face]').forEach(b => b.setAttribute('aria-pressed', b.dataset.face === st.faceMode));
  $$('[data-scen]').forEach(b => b.setAttribute('aria-pressed', b.dataset.scen === st.exc.scenario));
  renderLayers();
}
function renderLayers() {
  const n = st.layers.length, bw = st.boxW;
  const opts = step => { const o = []; for (let v = bw; v <= 8 + 1e-9; v += step) o.push(+v.toFixed(2)); return o; };
  let html = '';
  for (let i = n - 1; i >= 0; i--) {
    const l = st.layers[i];
    const base = opts(l.cf ? 0.5 : bw);
    const wo = base.includes(l.b) ? base : [...base, l.b].sort((a, b) => a - b);
    const cls = i === n - 1 && n > 1 ? 'top' : i === 0 ? 'bot' : '';
    html += `<div class="lrow"><span class="tag ${cls}">C${i + 1}</span>
      <div class="inp"><select aria-label="Largura da camada ${i + 1}" data-li="${i}" data-lk="b">${wo.map(v => `<option value="${v}" ${v === l.b ? 'selected' : ''}>${fmt(v, 1)}</option>`).join('')}</select></div>
      <div class="inp"><select aria-label="Altura da camada ${i + 1}" data-li="${i}" data-lk="h">${[0.5, 1].map(v => `<option value="${v}" ${v === l.h ? 'selected' : ''}>${fmt(v, 1)}</option>`).join('')}</select></div>
      <div class="inp ${l.cf ? 'cfsel' : ''}"><select aria-label="Disposição das caixas da camada ${i + 1}" data-li="${i}" data-lk="cf"><option value="0" ${l.cf ? '' : 'selected'}>Em fila</option><option value="1" ${l.cf ? 'selected' : ''}>Contraforte</option></select></div>
      <button class="x" type="button" data-del="${i}" aria-label="Remover camada ${i + 1}" ${n === 1 ? 'disabled' : ''}>×</button></div>`;
  }
  $('#layers').innerHTML = html;
}
/* limites de cada campo (em kN/kPa internamente) — evitam valores que travam o desenho */
const LIMITS = {
  L: [1, 500, 'm'], D: [0, 10, 'm'], batter: [0, 15, '°'],
  'soil.gamma': [10, 25, 'dens'], 'soil.phi': [15, 45, '°'], 'soil.delta': [0, 45, '°'], 'soil.beta': [0, 40, '°'], 'soil.q': [0, 100, 'press'],
  'found.phi': [10, 45, '°'], 'found.c': [0, 200, 'press'], 'found.sadm': [10, 2000, 'press'],
  'gab.gs': [20, 32, 'dens'], 'gab.n': [0.2, 0.45, ''], 'exc.folga': [0, 3, 'm'], 'exc.m': [0, 3, 'H:1V'], 'geo.overlap': [0, 50, '%'],
  'fs.desl': [1, 3, ''], 'fs.tomb': [1, 4, ''], 'fs.glob': [1, 3, ''], 'water.gsat': [15, 24, 'dens'], 'water.hw': [0, 30, 'm'],
  'exc.fill.a': [0, 50, 'm'], 'exc.fill.m': [0, 5, 'H:1V'], 'exc.fill.emp': [1, 2, ''], 'exc.fill.cap': [1, 40, 'm³'],
  'river.hn': [0, 30, 'm'], 'river.hc': [0, 30, 'm'], 'river.v': [0, 10, 'm/s'], 'river.ds': [0, 10, 'm'], 'river.lc': [0, 20, 'm'],
};
function limitText(k) {
  const [lo, hi, u] = LIMITS[k];
  const conv = v => (u === 'dens' || u === 'press') ? fmt(v / UF(), isT() ? 2 : 0) + ' ' + UL(u) : fmt(v, v % 1 ? 2 : 0) + (u ? ' ' + u : '');
  return `entre ${conv(lo)} e ${conv(hi)}`;
}
let updTimer = null;
function scheduleUpdate() { clearTimeout(updTimer); updTimer = setTimeout(update, 180); }
$('#inputs').addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.k && el.type !== 'checkbox' && el.tagName === 'INPUT') {
    const raw = parseFloat(String(el.value).replace(',', '.'));
    const box = el.closest('.inp'), lim = LIMITS[el.dataset.k];
    const v = el.dataset.u ? raw * UF() : raw;
    const bad = !Number.isFinite(raw) || (lim && (v < lim[0] - 1e-9 || v > lim[1] + 1e-9));
    if (box) { box.classList.toggle('bad', bad); box.title = bad ? (lim ? 'Use um valor ' + limitText(el.dataset.k) : 'Digite um número') : ''; }
    let msg = box && box.parentElement.querySelector('.errmsg');
    if (bad && box && !msg) { msg = document.createElement('small'); msg.className = 'errmsg'; box.after(msg); }
    if (msg) { msg.textContent = bad ? (lim ? 'Use um valor ' + limitText(el.dataset.k) + '.' : 'Digite um número.') : ''; msg.hidden = !bad; }
    if (bad) return;
    setK(st, el.dataset.k, v); renderPresets(); scheduleUpdate();
    return;
  }
  if (el.dataset.k) {
    if (el.type === 'checkbox') { setK(st, el.dataset.k, el.checked); if (el.id === 'fon') $('#fillFields').hidden = !el.checked; if (el.id === 'won') { $('#waterFields').hidden = !el.checked; renderPresets(); } if (el.id === 'ron') $('#riverFields').hidden = !el.checked; if (el.id === 'rap') $('#apronFields').hidden = !el.checked; }
    else { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; setK(st, el.dataset.k, el.dataset.u ? v * UF() : v); renderPresets(); }
    update();
  }
});
$('#inputs').addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.lk) { const v = parseFloat(el.value); const L0 = st.layers[+el.dataset.li]; L0[el.dataset.lk] = el.dataset.lk === 'cf' ? v === 1 : v;
    if (el.dataset.lk === 'cf') { if (!L0.cf) { const nb = Math.max(st.boxW, Math.round(L0.b / st.boxW) * st.boxW); if (nb !== L0.b) toast(`Em fila a largura é em metros inteiros: ${fmt(L0.b, 1)} m virou ${fmt(nb, 1)} m.`); L0.b = nb; } renderLayers(); }
    update(); }
  else if (el.dataset.k && el.tagName === 'SELECT') { setK(st, el.dataset.k, parseFloat(el.value)); update(); }
});
$('#inputs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.del != null) { st.layers.splice(+b.dataset.del, 1); renderLayers(); update(); }
  if (b.dataset.face) { st.faceMode = b.dataset.face; fillInputs(); update(); }
  if (b.dataset.scen) { st.exc.scenario = b.dataset.scen; fillInputs(); update(); }
  if (b.dataset.units) { st.units = b.dataset.units; fillInputs(); update(); }
  if (b.dataset.preset) { const [g, k] = b.dataset.preset.split(':'); PRESETS[g][+k].apply(); fillInputs(); update(); toast('Valores de referência aplicados: ' + PRESETS[g][+k].n + '.'); }
});
$('#addLayer').onclick = () => {
  if (st.layers.length >= 30) { toast('Limite de 30 camadas.'); return; } const t = st.layers[st.layers.length - 1]; st.layers.push({ b: Math.max(st.boxW, t.b - st.boxW), h: t.h, cf: false }); renderLayers(); update(); };
$('#autoGen').onclick = () => {
  const H = parseFloat($('#agH').value), h = parseFloat($('#agh').value);
  if (!(H >= 0.5 && H <= 15)) { toast('Informe uma altura entre 0,5 e 15 m.'); return; }
  st.layers = autoLayers(H, h, st.boxW); renderLayers(); update(); toast(`${st.layers.length} camadas geradas.`);
};
$('#projName').addEventListener('input', e => { st.nome = e.target.value; persist(); });
$('#resetBtn').onclick = () => { $('#resetConfirm').hidden = false; };
$('#resetNo').onclick = () => { $('#resetConfirm').hidden = true; };
$('#resetYes').onclick = () => { st = clone(DEFAULTS); $('#resetConfirm').hidden = true; fillInputs(); update(); toast('Exemplo restaurado.'); };

/* ---------- cores ---------- */
const LIGHT = { bg: '#FFFFFF', panel: '#FFFFFF', ink: '#16212B', muted: '#596772', line: '#C6CFD6', accent: '#A9611B', steel: '#2F6A80', stone: '#8F999F', stone2: '#BCC4C8', soil: '#B39467', soilbg: '#EFE5D4', bad: '#B0352C', ok: '#2C7A4B' };
function themeColors() {
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue('--' + k).trim();
  return { bg: g('panel'), panel: g('panel'), ink: g('ink'), muted: g('muted'), line: g('line'), accent: g('accent'), steel: g('steel'), stone: g('stone'), stone2: g('stone2'), soil: g('soil'), soilbg: g('soilbg'), bad: g('bad'), ok: g('ok') };
}

/* ---------- desenho: corte transversal ---------- */
function svgCorte(st, R, C) {
  const g = R.geo, q = R.q, ext = R.ext, D2 = Math.PI / 180, a = st.batter * D2;
  const fp = q.fill ? q.fill.poly : [];
  const allX = [...q.poly.map(p => p.x), ...g.corners.map(p => p.x), ...fp.map(p => p.x)], allY = [...q.poly.map(p => p.y), ...g.corners.map(p => p.y), ...fp.map(p => p.y)];
  const RV = st.river.on ? st.river : null;
  let fD = g.toe.x;
  g.R.forEach(r => { const A = rot(st, r.x0, r.y0), B = rot(st, r.x0, r.y1); if (st.D >= A.y && st.D <= B.y) fD = A.x + (B.x - A.x) * (st.D - A.y) / (B.y - A.y); });
  if (RV) { allX.push(fD - (RV.apron ? RV.lc : 0) - 1.2); allY.push(Math.max(RV.hc, RV.hn) + 0.3, st.D - Math.max(RV.ds, RV.apron ? RV.esp : 0) - 0.3); }
  if (R.glob) { allX.push(R.glob.xL - 0.3, R.glob.xR + 0.3); allY.push(R.glob.yc - R.glob.R - 0.6); }
  const x0 = Math.min(...allX) - 1.6, xR = Math.max(...allX) + 1.4;
  const tb = g.topBack, tanB = Math.tan(st.soil.beta * D2);
  const ySurfR = tb.y + (xR - tb.x) * tanB;
  const y0 = Math.min(...allY) - 0.9, y1 = Math.max(...allY, ySurfR) + (st.soil.q > 0 ? 1.0 : 0.6);
  const m = 34, Wmax = 960, Hmax = 600;
  let s = (Wmax - 2 * m) / (xR - x0); if ((y1 - y0) * s + 2 * m > Hmax) s = (Hmax - 2 * m) / (y1 - y0);
  const W = Math.round((xR - x0) * s + 2 * m), H = Math.round((y1 - y0) * s + 2 * m);
  const X = x => (m + (x - x0) * s).toFixed(1), Y = y => (H - m - (y - y0) * s).toFixed(1);
  const pts = arr => arr.map(p => X(p.x) + ',' + Y(p.y)).join(' ');
  const fs = Math.max(10, Math.min(13, s * 0.2));
  const font = `font-family="IBM Plex Mono, ui-monospace, Consolas, monospace" font-size="${fs}"`;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Corte transversal do muro de gabião">`;
  const sp = Math.max(8, s * 0.28);
  o += `<defs>
    <pattern id="stone" patternUnits="userSpaceOnUse" width="${sp * 2}" height="${sp * 2}" patternTransform="rotate(${-st.batter})">
      <rect width="${sp * 2}" height="${sp * 2}" fill="${C.stone2}"/>
      <ellipse cx="${sp * .5}" cy="${sp * .5}" rx="${sp * .42}" ry="${sp * .32}" fill="${C.stone}" />
      <ellipse cx="${sp * 1.45}" cy="${sp * .6}" rx="${sp * .36}" ry="${sp * .4}" fill="${C.stone}" opacity=".8"/>
      <ellipse cx="${sp * .9}" cy="${sp * 1.45}" rx="${sp * .48}" ry="${sp * .34}" fill="${C.stone}" opacity=".9"/>
      <ellipse cx="${sp * 1.85}" cy="${sp * 1.6}" rx="${sp * .3}" ry="${sp * .28}" fill="${C.stone}" opacity=".7"/>
      <path d="M0 ${sp} L${sp} 0 L${sp * 2} ${sp} L${sp} ${sp * 2} Z" fill="none" stroke="${C.ink}" stroke-width=".6" opacity=".35"/>
    </pattern>
    <pattern id="soil" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
      <rect width="14" height="14" fill="${C.soilbg}"/><line x1="0" y1="0" x2="0" y2="14" stroke="${C.soil}" stroke-width="1.1" opacity=".55"/>
    </pattern>
    <pattern id="fillnew" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(-45)">
      <rect width="10" height="10" fill="${C.soilbg}"/><line x1="0" y1="0" x2="0" y2="10" stroke="${C.ok}" stroke-width="1.6" opacity=".45"/>
    </pattern>
    <marker id="arR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.bad}"/></marker>
    <marker id="arW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#3a86c8"/></marker>
    <marker id="arK" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.ink}"/></marker>
    <marker id="arS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.muted}"/></marker>
    <marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" stroke="${C.muted}" stroke-width="1.4"/></marker>
  </defs>`;
  o += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  const soilPoly = [{ x: x0, y: y0 }, { x: xR, y: y0 }, { x: xR, y: ySurfR }, tb, { x: fD, y: st.D }, { x: x0, y: st.D }];
  o += `<polygon points="${pts(soilPoly)}" fill="url(#soil)"/>`;
  o += `<polyline points="${pts([{ x: x0, y: st.D }, { x: fD, y: st.D }])}" stroke="${C.soil}" stroke-width="2" fill="none"/>`;
  o += `<polyline points="${pts([tb, { x: xR, y: ySurfR }])}" stroke="${C.soil}" stroke-width="2" fill="none"/>`;
  if (q.fill) {
    const F = q.fill;
    o += `<polygon points="${pts(F.poly)}" fill="url(#fillnew)" stroke="${C.ok}" stroke-width="1.4"/>`;
    o += `<polyline points="${pts([{ x: F.xb0, y: st.D }, { x: F.xbT, y: F.Ytop }])}" stroke="${C.ink}" stroke-width="2" fill="none"/>`;
  }
  // camadas de gabião
  g.R.forEach((r, i) => {
    const P = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].map(p => rot(st, p[0], p[1]));
    o += `<polygon points="${pts(P)}" fill="url(#stone)" stroke="${C.ink}" stroke-width="1.6"/>`;
    const cfL = !!st.layers[i].cf;
    const cuts = cfL ? (() => { let t = 0; return splitWidth(r.b, st.boxLen).slice(0, -1).map(p => (t += p)); })() : (() => { const nT = Math.max(1, Math.round(r.b / st.boxW)); return Array.from({ length: nT - 1 }, (_, k) => (k + 1) * r.b / nT); })();
    cuts.forEach(cx => { const A = rot(st, r.x0 + cx, r.y0), B = rot(st, r.x0 + cx, r.y1); o += `<line x1="${X(A.x)}" y1="${Y(A.y)}" x2="${X(B.x)}" y2="${Y(B.y)}" stroke="${C.ink}" stroke-width="${cfL ? 1.4 : .9}" opacity=".75"/>`; });
    if (cfL) o += `<polygon points="${pts(P)}" fill="none" stroke="${C.accent}" stroke-width="2.2"/>`;
    const c = rot(st, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    const lab = `C${i + 1}${cfL ? ' CF' : ''} · ${fmt(r.b, 1)} × ${fmt(r.h, 1)}`, lfs = Math.min(fs, (r.b * s - 10) / (lab.length * 0.62));
    if (r.h * s > 18 && lfs >= 8) o += `<text x="${X(c.x)}" y="${Y(c.y)}" font-family="IBM Plex Mono, ui-monospace, Consolas, monospace" font-size="${lfs.toFixed(1)}" fill="${C.ink}" text-anchor="middle" dominant-baseline="middle" font-weight="500" paint-order="stroke" stroke="${C.stone2}" stroke-width="3" transform="rotate(${st.batter} ${X(c.x)} ${Y(c.y)})">${lab}</text>`;
  });
  // geotêxtil
  const geoPts = [...g.back];
    o += `<polyline points="${pts(geoPts.map(p => ({ x: p.x + 0.04, y: p.y })))}" fill="none" stroke="${C.steel}" stroke-width="2.4" stroke-dasharray="7 4"/>`;
  if (st.geo.base) o += `<polyline points="${pts([g.toe, g.heel].map(p => ({ x: p.x, y: p.y - 0.05 })))}" fill="none" stroke="${C.steel}" stroke-width="2.4" stroke-dasharray="7 4"/>`;
  // escavação
  o += `<polygon points="${pts(q.poly)}" fill="none" stroke="${C.accent}" stroke-width="1.6" stroke-dasharray="9 5"/>`;
  // sobrecarga
  if (st.soil.q > 0) {
    const n = Math.max(2, Math.floor((xR - tb.x - 0.3) / 0.5));
    for (let k = 0; k <= n; k++) {
      const xx = tb.x + 0.3 + k * (xR - tb.x - 0.5) / n, yy = tb.y + (xx - tb.x) * tanB;
      o += `<line x1="${X(xx)}" y1="${Y(yy + 0.7)}" x2="${X(xx)}" y2="${Y(yy + 0.04)}" stroke="${C.muted}" stroke-width="1.2" marker-end="url(#arS)"/>`;
    }
    o += `<line x1="${X(tb.x + 0.3)}" y1="${Y(tb.y + 0.7)}" x2="${X(xR - 0.2)}" y2="${Y(tb.y + (xR - 0.2 - tb.x) * tanB + 0.7)}" stroke="${C.muted}" stroke-width="1.2"/>`;
    o += `<text x="${X(xR - 0.25)}" y="${Y(ySurfR + 0.82)}" ${font} fill="${C.muted}" text-anchor="end">q = ${uf(st.soil.q, 'press')}</text>`;
  }
  // rio na frente do muro
  if (RV) {
    const WC = '#3a86c8';
    const faceX = y => { const fr = g.front; for (let i = 0; i < fr.length - 1; i++) { const p = fr[i], q2 = fr[i + 1]; if ((p.y - y) * (q2.y - y) <= 0 && Math.abs(q2.y - p.y) > 1e-9) return p.x + (q2.x - p.x) * (y - p.y) / (q2.y - p.y); } return y > fr[fr.length - 1].y ? null : fr[0].x; };
    const drawLevel = (yl, label, dash, filled) => {
      if (yl <= st.D + 1e-6) return;
      const fx = faceX(yl);
      const topY = Math.max(...g.corners.map(p => p.y));
      const xEnd = fx !== null ? fx : g.topFront.x;
      if (filled) {
        const P = [{ x: x0, y: st.D }, { x: x0, y: yl }, { x: xEnd, y: Math.min(yl, topY) }];
        g.front.slice().reverse().forEach(p => { if (p.y < Math.min(yl, topY) - 1e-6 && p.y > st.D + 1e-6) P.push(p); });
        P.push({ x: fD, y: st.D });
        o += `<polygon points="${pts(P)}" fill="${WC}" opacity=".18"/>`;
      }
      o += `<line x1="${X(x0)}" y1="${Y(yl)}" x2="${X(xEnd)}" y2="${Y(yl)}" stroke="${WC}" stroke-width="${dash ? 1.6 : 2.2}" ${dash ? 'stroke-dasharray="8 5"' : ''}/>`;
      const lx = +X(x0 + 1.5), ly = +Y(yl);
      o += `<path d="M${lx - 6} ${ly - 11} h12 l-6 10 Z" fill="${WC}"/><text x="${lx + 10}" y="${ly - 4}" ${font} fill="${WC}" font-weight="500" paint-order="stroke" stroke="${C.bg}" stroke-width="4">${label} ${fmt(yl, 2)} m</text>`;
    };
    drawLevel(RV.hn, 'N.A. normal', false, true);
    if (RV.hc > RV.hn + 0.05) drawLevel(RV.hc, 'N.A. cheia', true, false);
    // erosão prevista
    const xA = RV.apron ? fD - RV.lc : fD;
    if (RV.ds > 0) {
      o += `<path d="M${X(x0)} ${Y(st.D - RV.ds)} L${X(xA - 0.3)} ${Y(st.D - RV.ds)} Q${X(xA)} ${Y(st.D - RV.ds)} ${X(xA)} ${Y(st.D)}" fill="none" stroke="${C.bad}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
      o += `<text x="${+X(x0 + 1.5)}" y="${+Y(st.D - RV.ds) + fs + 3}" ${font} fill="${C.bad}">erosão prevista ${fmt(RV.ds, 2)} m</text>`;
    }
    if (RV.apron && RV.lc > 0) {
      const P = [{ x: fD - RV.lc, y: st.D - RV.esp }, { x: fD, y: st.D - RV.esp }, { x: fD, y: st.D }, { x: fD - RV.lc, y: st.D }];
      o += `<polygon points="${pts(P)}" fill="url(#stone)" stroke="${C.accent}" stroke-width="1.8"/>`;
      o += `<line x1="${X(fD - RV.lc)}" y1="${+Y(st.D - RV.esp) + 2}" x2="${X(fD)}" y2="${+Y(st.D - RV.esp) + 2}" stroke="${C.steel}" stroke-width="2" stroke-dasharray="6 3"/>`;
      o += `<text x="${X(fD - RV.lc / 2)}" y="${+Y(st.D - RV.esp) + fs + 6}" ${font} fill="${C.accent}" text-anchor="middle" font-weight="500" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">colchão de gabião ${fmt(RV.lc, 1)} × ${fmt(RV.esp, 2)} m</text>`;
    }
  }
  // água da chuva
  if (ext.wet && Number.isFinite(ext.Yw) && ext.Yw > g.heel.y) {
    const WC = '#3a86c8', Yw = ext.Yw;
    let xw = tb.x;
    for (let i = 0; i < g.back.length - 1; i++) { const p = g.back[i], q2 = g.back[i + 1]; if ((p.y - Yw) * (q2.y - Yw) <= 0 && Math.abs(q2.y - p.y) > 1e-9) { xw = p.x + (q2.x - p.x) * (Yw - p.y) / (q2.y - p.y); break; } }
    o += `<line x1="${X(xw)}" y1="${Y(Yw)}" x2="${X(xR)}" y2="${Y(Yw)}" stroke="${WC}" stroke-width="2.2"/>`;
    o += `<line x1="${X(xw + 0.6)}" y1="${+Y(Yw) + 5}" x2="${X(xR - 0.6)}" y2="${+Y(Yw) + 5}" stroke="${WC}" stroke-width="1" stroke-dasharray="10 8"/>`;
    const tx = +X(Math.min(xw + 2.8, xR - 4)), ty = +Y(Yw);
    o += `<path d="M${tx - 7} ${ty - 12} h14 l-7 11 Z" fill="${WC}"/><text x="${tx + 12}" y="${ty - 4}" ${font} fill="${WC}" font-weight="500" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">${RV ? 'N.A. no aterro ' : 'água '}${fmt(ext.Yw, 2)} m</text>`;
    if (ext.Uw > 0) {
      const P = ext.PU, Lr = 0.9;
      o += `<line x1="${X(P.x + Lr)}" y1="${Y(P.y)}" x2="${X(P.x + 0.05)}" y2="${Y(P.y)}" stroke="${WC}" stroke-width="2.6" marker-end="url(#arW)"/>`;
    }
    if (ext.U > 0) {
      const P = ext.PUb;
      o += `<line x1="${X(P.x)}" y1="${Y(P.y - 0.75)}" x2="${X(P.x)}" y2="${Y(P.y - 0.05)}" stroke="${WC}" stroke-width="2.6" marker-end="url(#arW)"/>`;
      o += `<text x="${+X(P.x) + 8}" y="${Y(P.y - 0.6)}" ${font} fill="${WC}" font-weight="500" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">subpressão ${uf(ext.U, 'force')}</text>`;
    }
  }
  // círculo crítico da estabilidade global
  if (R.glob) {
    const G = R.glob, GC = '#7b4fc9', N = 60, P = [];
    const a0 = Math.atan2(G.yL - G.yc, G.xL - G.xc), a1 = Math.atan2(G.yR - G.yc, G.xR - G.xc);
    let da = a1 - a0; if (da < 0) da += 2 * Math.PI;   // arco por baixo do centro, da esquerda para a direita
    for (let k = 0; k <= N; k++) { const t = a0 + da * k / N; P.push({ x: G.xc + G.R * Math.cos(t), y: G.yc + G.R * Math.sin(t) }); }
    o += `<polyline points="${pts(P)}" fill="none" stroke="${GC}" stroke-width="2" stroke-dasharray="10 4 2 4"/>`;
    const low = P.reduce((m, p) => (p.y < m.y ? p : m), P[0]);
    o += `<text x="${X(low.x)}" y="${+Y(low.y) + 2.6 * fs + 10}" ${font} fill="${GC}" text-anchor="middle" font-weight="500" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">ruptura global crítica · FS = ${fmt(G.FS, 2)}</text>`;
  }
  // forças
  if (Number.isFinite(ext.Ka)) {
    const Lr = 1.1, dx = -ext.Eh / ext.Ea, dy = -ext.Ev / ext.Ea, P = ext.P;
    o += `<line x1="${X(P.x - dx * Lr)}" y1="${Y(P.y - dy * Lr)}" x2="${X(P.x)}" y2="${Y(P.y)}" stroke="${C.bad}" stroke-width="2.6" marker-end="url(#arR)"/>`;
    o += `<text x="${X(P.x - dx * Lr + 0.08)}" y="${Y(P.y - dy * Lr + 0.18)}" ${font} fill="${C.bad}" font-weight="500">Ea = ${uf(ext.Ea, 'force')}</text>`;
    const cg = ext.cg;
    o += `<line x1="${X(cg.x)}" y1="${Y(cg.y + 0.35)}" x2="${X(cg.x)}" y2="${Y(cg.y - 0.55)}" stroke="${C.ink}" stroke-width="2.4" marker-end="url(#arK)"/>`;
    o += `<circle cx="${X(cg.x)}" cy="${Y(cg.y + 0.35)}" r="3" fill="${C.ink}"/>`;
    o += `<text x="${+X(cg.x) - 6}" y="${Y(cg.y - 0.45)}" ${font} fill="${C.ink}" font-weight="500" text-anchor="end" paint-order="stroke" stroke="${C.stone2}" stroke-width="3">W = ${uf(ext.W, 'force')}</text>`;
    if (ext.sPos > 0 && ext.sPos < ext.B) {
      const Rp = { x: g.toe.x + ext.sPos * Math.cos(a), y: g.toe.y - ext.sPos * Math.sin(a) };
      const rx = +X(Rp.x), ry = +Y(Rp.y);
      o += `<path d="M${rx} ${ry} l-6 11 h12 Z" fill="${C.ink}"/><text x="${rx}" y="${ry + 24}" ${font} fill="${C.ink}" text-anchor="middle">R · e = ${fmt(Math.abs(ext.e), 2)} m</text>`;
    }
  }
  if (q.fill) {
    const F = q.fill;
    const cy = st.D + (F.Ytop - st.D) * 0.72, cx = (tb.x + F.xb0 + Math.max(0, st.exc.fill.m) * (cy - st.D)) / 2;
    o += `<text x="${X(cx)}" y="${Y(cy)}" ${font} fill="${C.ok}" font-weight="500" text-anchor="middle" paint-order="stroke" stroke="${C.bg}" stroke-width="4">Aterro depois do muro</text>`;
    o += `<text x="${X(cx)}" y="${+Y(cy) + fs + 4}" ${font} fill="${C.ok}" text-anchor="middle" paint-order="stroke" stroke="${C.bg}" stroke-width="4">${fmt(F.area, 2)} m² por metro</text>`;
    const by = st.D + (F.Ytop - st.D) * 0.3, bx = F.xb0 + Math.max(0, st.exc.fill.m) * (by - st.D);
    o += `<text x="${+X(bx) + 8}" y="${Y(by)}" ${font} fill="${C.muted}" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">barranco existente</text>`;
  }
  // cotas
  const topY = Math.max(...g.corners.map(p => p.y)), xd = x0 + 0.55;
  o += `<line x1="${X(xd)}" y1="${Y(0)}" x2="${X(xd)}" y2="${Y(topY)}" stroke="${C.muted}" stroke-width="1" marker-start="url(#tick)" marker-end="url(#tick)"/>`;
  o += `<line x1="${X(xd - 0.1)}" y1="${Y(0)}" x2="${X(g.toe.x)}" y2="${Y(0)}" stroke="${C.muted}" stroke-width=".6" stroke-dasharray="2 3"/>`;
  o += `<line x1="${X(xd - 0.1)}" y1="${Y(topY)}" x2="${X(g.topFront.x)}" y2="${Y(topY)}" stroke="${C.muted}" stroke-width=".6" stroke-dasharray="2 3"/>`;
  o += `<text transform="translate(${+X(xd) - 6} ${Y(topY / 2)}) rotate(-90)" ${font} fill="${C.ink}" text-anchor="middle">H = ${fmt(q.altura * Math.cos(a), 2)} m</text>`;
  if (st.D > 0.05) {
    const xd2 = xd + 0.45;
    o += `<line x1="${X(xd2)}" y1="${Y(0)}" x2="${X(xd2)}" y2="${Y(st.D)}" stroke="${C.muted}" stroke-width="1" marker-start="url(#tick)" marker-end="url(#tick)"/>`;
    o += `<text x="${+X(xd2) + 5}" y="${(+Y(0) + +Y(st.D)) / 2 + 4}" ${font} fill="${C.muted}">D = ${fmt(st.D, 2)}</text>`;
  }
  const bm = { x: (g.toe.x + g.heel.x) / 2, y: (g.toe.y + g.heel.y) / 2 };
  o += `<text x="${X(bm.x)}" y="${+Y(Math.min(...q.poly.map(p => p.y))) + 34}" ${font} fill="${C.ink}" text-anchor="middle">B = ${fmt(st.layers[0].b, 2)} m</text>`;
  if (st.batter > 0) o += `<text x="${X(g.topFront.x - 0.1)}" y="${Y(topY + 0.22)}" ${font} fill="${C.muted}" text-anchor="end">α = ${fmt(st.batter, 0)}°</text>`;
  // notas de solo
  const nx = xR - 0.15;
  o += `<text x="${X(nx)}" y="${Y(tb.y - 0.4)}" ${font} fill="${C.ink}" text-anchor="end" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">Aterro · γ ${uf(st.soil.gamma, 'dens')} · φ ${fmt(st.soil.phi, 0)}° · δ ${fmt(st.soil.delta, 0)}°</text>`;
  o += `<text x="${X(nx)}" y="${Y(y0 + 0.25)}" ${font} fill="${C.ink}" text-anchor="end" paint-order="stroke" stroke="${C.soilbg}" stroke-width="4">Fundação · φ ${fmt(st.found.phi, 0)}° · σadm ${uf(st.found.sadm, 'press', isT() ? 1 : 0)}</text>`;
  o += `</svg>`;
  return o;
}

/* ---------- desenho: vista frontal ---------- */
function svgVista(st, R, C) {
  const Ht = R.q.altura, L = st.L;
  const ppm = Math.max(16, Math.min(80, 230 / Ht));
  const mL = 78, mR = 36, mT = 22, mB = 64;
  const W = Math.round(L * ppm + mL + mR), H = Math.round(Ht * ppm + mT + mB);
  const X = x => (mL + x * ppm).toFixed(1), Y = y => (mT + (Ht - y) * ppm).toFixed(1);
  const fs = 12, font = `font-family="IBM Plex Mono, ui-monospace, Consolas, monospace" font-size="${fs}"`;
  const sp = Math.max(8, ppm * 0.28);
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Vista frontal do muro de gabião">`;
  o += `<defs><pattern id="stoneV" patternUnits="userSpaceOnUse" width="${sp * 2}" height="${sp * 2}">
      <rect width="${sp * 2}" height="${sp * 2}" fill="${C.stone2}"/>
      <ellipse cx="${sp * .5}" cy="${sp * .5}" rx="${sp * .42}" ry="${sp * .32}" fill="${C.stone}"/>
      <ellipse cx="${sp * 1.45}" cy="${sp * .6}" rx="${sp * .36}" ry="${sp * .4}" fill="${C.stone}" opacity=".8"/>
      <ellipse cx="${sp * .9}" cy="${sp * 1.45}" rx="${sp * .48}" ry="${sp * .34}" fill="${C.stone}" opacity=".9"/>
      <path d="M0 ${sp} L${sp} 0 L${sp * 2} ${sp} L${sp} ${sp * 2} Z" fill="none" stroke="${C.ink}" stroke-width=".6" opacity=".35"/></pattern>
    <pattern id="soilV" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)"><rect width="14" height="14" fill="${C.soilbg}"/><line x1="0" y1="0" x2="0" y2="14" stroke="${C.soil}" stroke-width="1.1" opacity=".55"/></pattern>
    <marker id="tickV" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" stroke="${C.muted}" stroke-width="1.4"/></marker></defs>`;
  o += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  let y = 0;
  st.layers.forEach((l, i) => {
    const seen = new Set();
    layerBoxes(st, i).forEach(bx => {
      if (seen.has(bx.s0)) return; seen.add(bx.s0);
      o += `<rect x="${X(bx.s0)}" y="${Y(y + l.h)}" width="${(bx.len * ppm).toFixed(1)}" height="${(l.h * ppm).toFixed(1)}" fill="url(#stoneV)" stroke="${l.cf ? C.accent : C.ink}" stroke-width="${l.cf ? 1.6 : 1.3}"/>`;
    });
    if (l.cf) o += `<text x="${+X(L) + 6}" y="${(+Y(y) + +Y(y + l.h)) / 2 + 4}" ${font} fill="${C.accent}" font-weight="500">CF</text>`;
    y += l.h;
  });
  // terreno à frente
  if (st.D > 0) {
    o += `<rect x="${X(-0.6)}" y="${Y(st.D)}" width="${((L + 1.2) * ppm).toFixed(1)}" height="${(st.D * ppm).toFixed(1)}" fill="url(#soilV)" opacity=".82"/>`;
  }
  o += `<line x1="${X(-0.6)}" y1="${Y(st.D)}" x2="${X(L + 0.3)}" y2="${Y(st.D)}" stroke="${C.soil}" stroke-width="2"/>`;
  // cotas verticais por camada
  y = 0; const xd = -0.75;
  o += `<line x1="${X(xd)}" y1="${Y(0)}" x2="${X(xd)}" y2="${Y(Ht)}" stroke="${C.muted}" stroke-width="1"/>`;
  st.layers.forEach((l, i) => {
    o += `<line x1="${+X(xd) - 5}" y1="${Y(y)}" x2="${+X(xd) + 5}" y2="${Y(y)}" stroke="${C.muted}" stroke-width="1"/>`;
    if (l.h * ppm > 14) o += `<text x="${+X(xd) - 8}" y="${(+Y(y) + +Y(y + l.h)) / 2 + 4}" ${font} fill="${C.muted}" text-anchor="end">${fmt(l.h, 1)}</text>`;
    y += l.h;
  });
  o += `<line x1="${+X(xd) - 5}" y1="${Y(Ht)}" x2="${+X(xd) + 5}" y2="${Y(Ht)}" stroke="${C.muted}" stroke-width="1"/>`;
  // cota horizontal
  const yd = +Y(0) + 26;
  o += `<line x1="${X(0)}" y1="${yd}" x2="${X(L)}" y2="${yd}" stroke="${C.muted}" stroke-width="1" marker-start="url(#tickV)" marker-end="url(#tickV)"/>`;
  o += `<line x1="${X(0)}" y1="${+Y(0) + 4}" x2="${X(0)}" y2="${yd + 6}" stroke="${C.muted}" stroke-width=".6"/><line x1="${X(L)}" y1="${+Y(0) + 4}" x2="${X(L)}" y2="${yd + 6}" stroke="${C.muted}" stroke-width=".6"/>`;
  o += `<text x="${(+X(0) + +X(L)) / 2}" y="${yd - 6}" ${font} fill="${C.ink}" text-anchor="middle">L = ${fmt(L, 2)} m</text>`;
  o += `<text x="${X(0)}" y="${yd + 22}" ${font} fill="${C.muted}">Caixas enfileiradas de ${fmt(st.boxLen, 1)} m${st.stagger ? ' · juntas desencontradas nas camadas pares' : ' · juntas alinhadas'}${st.layers.some(l => l.cf) ? ' · CF = contraforte (caixas atravessadas, vista pela ponta de 1,0 m)' : ''}</text>`;
  o += `</svg>`;
  return o;
}

/* ---------- 3D ---------- */
const V3 = { ready: false, loading: false };
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); }); }
async function init3D() {
  if (V3.ready || V3.loading) return;
  V3.loading = true;
  try {
    if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    if (!THREE.OrbitControls) await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
  } catch (e) { $('#view3d').insertAdjacentHTML('beforeend', '<p class="note" style="padding:20px">Não foi possível carregar o visualizador 3D. Verifique a conexão e reabra a aba.</p>'); V3.loading = false; return; }
  const host = $('#view3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => render3D());
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-8, 14, 12); scene.add(sun);
  Object.assign(V3, { renderer, scene, camera, controls, host, ready: true, loading: false, tex: makeStoneTexture() });
  new ResizeObserver(() => resize3D()).observe(host);
  build3D(true);
}
function makeStoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#9aa2a6'; x.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const g = 110 + Math.floor(rnd() * 90); x.fillStyle = `rgb(${g},${g + 4},${g + 6})`;
    x.beginPath(); x.ellipse(rnd() * 256, rnd() * 256, 10 + rnd() * 18, 8 + rnd() * 14, rnd() * 3, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(40,45,50,.35)'; x.lineWidth = 1.5; x.stroke();
  }
  x.strokeStyle = 'rgba(55,60,64,.65)'; x.lineWidth = 2;
  for (let i = -256; i < 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function resize3D() {
  if (!V3.ready) return; const w = V3.host.clientWidth, h = V3.host.clientHeight; if (!w || !h) return;
  V3.renderer.setSize(w, h, false); V3.camera.aspect = w / h; V3.camera.updateProjectionMatrix(); render3D();
}
function render3D() { if (V3.ready) V3.renderer.render(V3.scene, V3.camera); }
/* caixa com a textura em metros em todas as faces (1 repetição = 1 m), sem esticar no topo nem nas pontas */
function boxMetricUV(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
/* caixas do muro em 3D (usado pela aba 3D e pela montagem na foto) */
function wallGroup3D(tex, edgeMat, o) {
  const L = st.L, Rr = rects(st), grp = new THREE.Group(), mats = {};
  st.layers.forEach((l, i) => {
    const r = Rr[i];
    layerBoxes(st, i).forEach(bx => {
      const key = String(bx.cf && o.cf !== false);
      if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: .95, metalness: .05, color: key === 'true' ? 0xf2d2b0 : 0xffffff }, o.mat || {}));
      const geo = boxMetricUV(bx.len - 0.01, l.h - 0.01, bx.tw - 0.01);
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.position.set(bx.s0 + bx.len / 2 - L / 2, (r.y0 + r.y1) / 2, -(bx.t0 + bx.tw / 2));
      if (o.order !== undefined) mesh.renderOrder = o.order;
      grp.add(mesh);
      const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat); ed.position.copy(mesh.position);
      if (o.order !== undefined) ed.renderOrder = o.order + 1;
      grp.add(ed);
    });
  });
  grp.rotation.x = -st.batter * Math.PI / 180;
  return grp;
}
function build3D(resetCam) {
  if (!V3.ready) return;
  const { scene } = V3;
  const disposeAll = obj => obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { if (m.map && m.map !== V3.tex) m.map.dispose(); if (m !== V3.edgeMat) m.dispose(); });
  });
  if (V3.group) { scene.remove(V3.group); disposeAll(V3.group); }
  if (V3.env) { scene.remove(V3.env); disposeAll(V3.env); }
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(cs.getPropertyValue('--panel2').trim() || '#eef2f4');
  const L = st.L, Rr = rects(st), env = new THREE.Group();
  const edgeMat = V3.edgeMat || (V3.edgeMat = new THREE.LineBasicMaterial({ color: 0x2b3238 }));
  const grp = wallGroup3D(V3.tex, edgeMat, {});
  const g = geometryGlobal(st);
  const soilCol = new THREE.Color(cs.getPropertyValue('--soil').trim() || '#b39467');
  const front = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, 6), new THREE.MeshStandardMaterial({ color: soilCol, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  front.rotation.x = -Math.PI / 2; front.position.set(0, st.D, 3 - g.xmin + 0.01); env.add(front);
  const tb = g.topBack, depth = 5;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, depth), new THREE.MeshStandardMaterial({ color: soilCol, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  back.rotation.x = -Math.PI / 2 - st.soil.beta * Math.PI / 180;
  back.position.set(0, tb.y + Math.sin(st.soil.beta * Math.PI / 180) * depth / 2, -tb.x - Math.cos(st.soil.beta * Math.PI / 180) * depth / 2);
  env.add(back);
  if (st.river.on) {
    let fD3 = g.toe.x;
    Rr.forEach(r => { const A = rot(st, r.x0, r.y0), B = rot(st, r.x0, r.y1); if (st.D >= A.y && st.D <= B.y) fD3 = A.x + (B.x - A.x) * (st.D - A.y) / (B.y - A.y); });
    if (st.river.apron && st.river.lc > 0) {
      const t = V3.tex.clone(); t.needsUpdate = true; t.repeat.set(L / 2, st.river.lc / 2);
      const ap = new THREE.Mesh(new THREE.BoxGeometry(L, st.river.esp, st.river.lc), new THREE.MeshStandardMaterial({ map: t, roughness: .95, color: 0xf2d2b0 }));
      ap.position.set(0, st.D - st.river.esp / 2 + 0.02, -(fD3 - st.river.lc / 2)); env.add(ap);
    }
    if (st.river.hn > st.D) {
      const wpl = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, 6), new THREE.MeshStandardMaterial({ color: 0x3a86c8, transparent: true, opacity: .45, side: THREE.DoubleSide }));
      wpl.rotation.x = -Math.PI / 2; wpl.position.set(0, st.river.hn, -(fD3 - 3)); env.add(wpl);
    }
  }
  scene.add(grp); scene.add(env); V3.group = grp; V3.env = env;
  const Ht = st.layers.reduce((s, l) => s + l.h, 0);
  if (resetCam || !V3.camSet) {
    const span = Math.max(L * 0.55, Ht * 2.2, 6);
    V3.camera.position.set(-span * 0.55, Ht * 0.9 + span * 0.25, span * 0.95);
    V3.controls.target.set(0, Ht * 0.45, -st.layers[0].b * 0.5); V3.controls.update(); V3.camSet = true;
  }
  resize3D(); render3D();
}

/* ---------- muro na foto (o muro calculado desenhado sobre a foto do local) ---------- */
const FOTO = { pending: null, file: null, url: null, w: 0, h: 0, pts: null, cam: null, fUser: 0, op: 1, edit: true, T: null, aiPts: new Map(), drag: -1, dirty: true };
const FOTO_ROT = ['pé esq.', 'pé dir.', 'topo dir.', 'topo esq.'];

function fotoStoneTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#2b2824'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) {
    const cx = rnd() * S, cy = rnd() * S, rx = 15 + rnd() * 22, ry = 11 + rnd() * 15, ang = rnd() * Math.PI;
    const base = 105 + rnd() * 80, warm = rnd() * 22;
    const col = k => `rgb(${Math.min(255, base * k + warm) | 0},${Math.min(255, base * k + warm * 0.55) | 0},${Math.min(255, base * k) | 0})`;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const px = cx + ox, py = cy + oy; if (px < -60 || px > S + 60 || py < -60 || py > S + 60) continue;
      const g = x.createRadialGradient(px - rx * 0.35, py - ry * 0.45, 2, px, py, Math.max(rx, ry) * 1.15);
      g.addColorStop(0, col(1.22)); g.addColorStop(0.55, col(0.97)); g.addColorStop(1, col(0.6));
      x.fillStyle = g; x.beginPath(); x.ellipse(px, py, rx, ry, ang, 0, Math.PI * 2); x.fill();
    }
  }
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const nz = (rnd() - 0.5) * 24; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz; }
  x.putImageData(id, 0, 0);
  // tela hexagonal de dupla torção (malha ~ 8 × 10 cm)
  const cw = S / 10, ch = S / 8, tw = ch * 0.32;
  const wire = (w, col) => {
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
    for (let r = -1; r <= 8; r++) for (let k = -1; k <= 10; k++) {
      const X = k * cw + (r % 2 ? cw / 2 : 0), Y = r * ch;
      x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y + tw); x.stroke();
      x.beginPath(); x.moveTo(X, Y + tw); x.lineTo(X - cw / 2, Y + ch); x.moveTo(X, Y + tw); x.lineTo(X + cw / 2, Y + ch); x.stroke();
    }
  };
  wire(4.5, 'rgba(25,27,29,.75)'); wire(1.6, 'rgba(205,210,214,.85)');
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
}
function fotoShadowTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c);
}

async function fotoInit() {
  if (FOTO.T) return true;
  try {
    if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  } catch (e) { toast('Não foi possível carregar o desenho 3D. Verifique a conexão.'); return false; }
  const canvas = $('#fotoCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0); renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.05, 3000);
  const hemi = new THREE.HemisphereLight(0xf2f5ff, 0x5c4c3c, 0.95), sun = new THREE.DirectionalLight(0xfff0da, 0.85);
  scene.add(hemi, sun, sun.target);
  const tex = fotoStoneTexture(); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  FOTO.T = { renderer, scene, camera, sun, tex, shadowTex: fotoShadowTexture(), edgeMat: new THREE.LineBasicMaterial({ color: 0x1d2022, transparent: true, opacity: 0.5 }), group: null };
  new ResizeObserver(() => fotoLayout()).observe($('#viewFoto'));
  return true;
}

/* monta o muro, o terreno invisível que esconde as partes enterradas e a sombra no pé */
function fotoBuild() {
  const T = FOTO.T; if (!T) return;
  if (T.group) { T.scene.remove(T.group); T.group.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map && m.map !== T.tex && m.map !== T.shadowTex) m.map.dispose(); if (m !== T.edgeMat) m.dispose(); }); }); }
  const grp = new THREE.Group(), a = fotoAnchor(st), g = geometryGlobal(st), L = st.L;
  const occ = new THREE.MeshBasicMaterial({ colorWrite: false });
  // terreno da frente (abaixo da cota D)
  const front = new THREE.Mesh(new THREE.BoxGeometry(L + 400, 60, 400), occ);
  front.position.set(0, st.D - 30, a.O[2] + 200 - 0.005); front.renderOrder = 0; grp.add(front);
  // aterro atrás do muro (do tardoz até o topo)
  const back = g.back, tb = g.topBack, yb = Math.min(...back.map(p => p.y)) - 40;
  const sh = new THREE.Shape(); sh.moveTo(back[0].x + 0.02, yb);
  back.forEach(p => sh.lineTo(p.x + 0.02, p.y)); sh.lineTo(tb.x + 400, tb.y); sh.lineTo(tb.x + 400, yb); sh.lineTo(back[0].x + 0.02, yb);
  const fill = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: L + 400, bevelEnabled: false }), occ);
  fill.rotation.y = Math.PI / 2; fill.position.x = -(L + 400) / 2; fill.renderOrder = 0; grp.add(fill);
  // muro
  const op = FOTO.op;
  const wall = wallGroup3D(T.tex, T.edgeMat, { cf: false, order: 1, mat: { roughness: .9, metalness: 0, transparent: op < 1, opacity: op } });
  T.edgeMat.opacity = 0.5 * op;
  grp.add(wall);
  // sombra no pé
  const shM = new THREE.MeshBasicMaterial({ map: T.shadowTex, transparent: true, depthWrite: false, opacity: op });
  const shp = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.1, 0.7), shM);
  shp.rotation.x = -Math.PI / 2; shp.position.set(0, st.D + 0.004, a.O[2] + 0.35); shp.renderOrder = 3; grp.add(shp);
  T.scene.add(grp); T.group = grp; FOTO.dirty = false;
}

function fotoCalibrate() {
  if (!FOTO.pts) return false;
  const c = cameraFromPoints(st, FOTO.pts, FOTO.w, FOTO.h, FOTO.fUser);
  if (!c) return false;
  FOTO.cam = c; FOTO.key = fotoKey(); return true;
}
/* pontos acompanham o muro quando o projeto muda */
const fotoKey = () => JSON.stringify([st.L, st.D, st.batter, st.faceMode, st.layers]);
function fotoSyncPts() {
  if (!FOTO.cam || FOTO.drag >= 0 || FOTO.key === fotoKey()) return;
  FOTO.key = fotoKey();
  const cam = cameraAt(FOTO.cam, st), q = fotoCorners(fotoAnchor(st)).map(P => projectPoint(cam, P));
  if (q.every(Boolean)) FOTO.pts = q.map(p => [p[0], p[1]]);
}
function fotoRender(target) {
  const T = FOTO.T; if (!T || !FOTO.cam) return;
  if (FOTO.dirty) fotoBuild();
  const cam = cameraAt(FOTO.cam, st), Rw = cam.Rw, C = cam.C, a = fotoAnchor(st);
  T.camera.position.set(C[0], C[1], C[2]);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...Rw[0]), new THREE.Vector3(...Rw[1]).negate(), new THREE.Vector3(...Rw[2]).negate());
  T.camera.quaternion.setFromRotationMatrix(m);
  T.camera.fov = 2 * Math.atan(FOTO.h / 2 / cam.f) * 180 / Math.PI; T.camera.aspect = FOTO.w / FOTO.h; T.camera.updateProjectionMatrix();
  // sol vindo do alto, um pouco à esquerda da câmera
  T.sun.position.set(C[0] - 6, a.O[1] + 14, C[2] * 0.6 + 4); T.sun.target.position.set(0, a.O[1] + a.Hs / 2, a.O[2]);
  if (target) { T.renderer.setPixelRatio(1); T.renderer.setSize(target.w, target.h, false); }
  T.renderer.render(T.scene, T.camera);
}

function fotoLayout() {
  if (!FOTO.w || $('#viewFoto').hidden) return;
  const view = $('#viewFoto'), maxW = Math.max(200, view.clientWidth - 20), maxH = Math.max(260, window.innerHeight * 0.72);
  const k = Math.min(maxW / FOTO.w, maxH / FOTO.h), W = Math.round(FOTO.w * k), H = Math.round(FOTO.h * k);
  const stg = $('#fotoStage'); stg.style.width = W + 'px'; stg.style.height = H + 'px';
  if (FOTO.T) { FOTO.T.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); FOTO.T.renderer.setSize(W, H, false); }
  fotoDraw();
}
function fotoDraw() {
  if (!FOTO.pts) return;
  fotoRender();
  const svg = $('#fotoSvg'), stg = $('#fotoStage'), k = FOTO.w / Math.max(1, stg.clientWidth), r = 11 * k, P = FOTO.pts;
  svg.setAttribute('viewBox', `0 0 ${FOTO.w} ${FOTO.h}`);
  const poly = P.map(p => p.join(',')).join(' ');
  svg.innerHTML = FOTO.edit ? `<polygon points="${poly}" fill="none" stroke="#fff" stroke-width="${2.5 * k}" stroke-dasharray="${8 * k} ${6 * k}" opacity=".9"/>
    <polygon points="${poly}" fill="none" stroke="#000" stroke-width="${1 * k}" stroke-dasharray="${8 * k} ${6 * k}" stroke-dashoffset="${7 * k}" opacity=".5"/>` +
    P.map((p, i) => `<g class="fh" data-i="${i}" tabindex="0" role="slider" aria-label="Ponto ${FOTO_ROT[i]}: arraste ou use as setas" aria-valuetext="${Math.round(p[0])}, ${Math.round(p[1])}">
      <circle cx="${p[0]}" cy="${p[1]}" r="${r * 2.2}" fill="transparent"/>
      <circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="#D86A1B" stroke="#fff" stroke-width="${2.5 * k}"/>
      <text x="${p[0]}" y="${p[1] + (i < 2 ? 2.6 : -1.9) * r}" font-size="${13 * k}" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="${3 * k}" paint-order="stroke" font-family="system-ui,sans-serif" font-weight="600">${FOTO_ROT[i]}</text></g>`).join('') : '';
  const e = FOTO.cam ? FOTO.cam.erro : 0, bad = FOTO.edit && e > 0.025 && FOTO.drag < 0;
  $('#fotoFit').hidden = !bad;
  if (bad) {
    const a = fotoAnchor(st), fl = fitLength(st, FOTO.pts, FOTO.w, FOTO.h, FOTO.fUser);
    const sug = fl && fl.erro < e * 0.6 ? ` Pelos pontos, o trecho marcado tem cerca de <b>${fmt(fl.L, fl.L < 10 ? 1 : 0)} m</b> de comprimento; o projeto tem ${fmt(st.L, 1)} m. Se a foto mostra só uma parte do muro, ajuste o comprimento no projeto ou marque o muro inteiro.` : '';
    $('#fotoFit').innerHTML = `Os pontos não combinam com o tamanho do muro (${fmt(st.L, 1)} m de comprimento × ${fmt(a.Hs * a.e2[1], 1)} m de altura acima do chão).${sug} Confira também se marcou os pés no chão da frente e o topo do muro.`;
  }
  $('#fotoLens').value = (FOTO.cam ? FOTO.cam.f : 0.8 * Math.max(FOTO.w, FOTO.h)) / Math.max(FOTO.w, FOTO.h);
}

/* carrega uma foto (File) e posiciona os pontos: os da IA, os já marcados ou um retângulo inicial */
async function fotoSet(file, ptsNorm) {
  if (!(await fotoInit())) return;
  const nova = FOTO.file !== file;
  if (nova) {
    if (FOTO.url) URL.revokeObjectURL(FOTO.url);
    const url = URL.createObjectURL(file), img = $('#fotoImg');
    img.src = url; try { await img.decode(); } catch (e) { toast('Não foi possível abrir essa foto.'); return; }
    Object.assign(FOTO, { file, url, w: img.naturalWidth, h: img.naturalHeight, pts: null, cam: null, fUser: 0 });
  }
  const pn = ptsNorm || (nova ? FOTO.aiPts.get(file) : null);
  if (pn) FOTO.pts = pn.map(p => [p[0] * FOTO.w, p[1] * FOTO.h]);
  else if (!FOTO.pts) {
    const a = fotoAnchor(st), wPx = 0.6 * FOTO.w, hPx = Math.min(0.55 * FOTO.h, wPx * a.Hs / Math.max(0.1, a.L)), x0 = 0.2 * FOTO.w, yb = 0.78 * FOTO.h;
    FOTO.pts = [[x0, yb], [x0 + wPx, yb], [x0 + wPx, yb - hPx], [x0, yb - hPx]];
  }
  FOTO.dirty = true; fotoCalibrate();
  $('#fotoEmpty').hidden = true; $('#fotoStage').hidden = false; $('#fotoTools').hidden = false;
  fotoThumbs(); fotoLayout();
}
function fotoThumbs() {
  const box = $('#fotoThumbs'); box.innerHTML = '';
  AI.files.forEach((f, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fthumb'; b.setAttribute('aria-pressed', f === FOTO.file); b.setAttribute('aria-label', 'Usar a foto ' + (i + 1));
    const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(f); im.onload = () => URL.revokeObjectURL(im.src);
    b.append(im); b.onclick = () => fotoSet(f); box.append(b);
  });
}
async function fotoShow() {
  if (FOTO.pending) { const pd = FOTO.pending; FOTO.pending = null; await fotoSet(pd.file, pd.pts); }
  else if (!FOTO.file && AI.files.length) await fotoSet(AI.files[0]);
  else { fotoThumbs(); fotoSyncPts(); fotoLayout(); }
}

/* arrastar os pontos (mouse, dedo ou teclado) */
(function fotoPointer() {
  const svg = $('#fotoSvg');
  const toImg = e => { const r = svg.getBoundingClientRect(); return [Math.min(FOTO.w, Math.max(0, (e.clientX - r.left) * FOTO.w / r.width)), Math.min(FOTO.h, Math.max(0, (e.clientY - r.top) * FOTO.h / r.height))]; };
  let raf = 0;
  const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; fotoCalibrate(); fotoDraw(); }); };
  svg.addEventListener('pointerdown', e => {
    const h = e.target.closest('.fh'); if (!h) return;
    e.preventDefault(); FOTO.drag = +h.dataset.i; svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => { if (FOTO.drag < 0) return; FOTO.pts[FOTO.drag] = toImg(e); redraw(); });
  const end = () => { if (FOTO.drag < 0) return; FOTO.drag = -1; fotoCalibrate(); fotoDraw(); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('keydown', e => {
    const h = e.target.closest('.fh'); if (!h) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
    e.preventDefault(); const i = +h.dataset.i, st8 = (e.shiftKey ? 0.02 : 0.004) * Math.max(FOTO.w, FOTO.h);
    FOTO.pts[i] = [Math.min(FOTO.w, Math.max(0, FOTO.pts[i][0] + d[0] * st8)), Math.min(FOTO.h, Math.max(0, FOTO.pts[i][1] + d[1] * st8))];
    fotoCalibrate(); fotoDraw(); const n = $(`#fotoSvg .fh[data-i="${i}"]`); if (n) n.focus();
  });
})();

/* imagem final: foto + muro + faixa com o aviso */
async function fotoComposite(maxSide) {
  if (!FOTO.T || !FOTO.cam) return null;
  const k = Math.min(1, (maxSide || 2000) / Math.max(FOTO.w, FOTO.h)), W = Math.round(FOTO.w * k), H = Math.round(FOTO.h * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.drawImage($('#fotoImg'), 0, 0, W, H);
  fotoRender({ w: W, h: H }); x.drawImage(FOTO.T.renderer.domElement, 0, 0, W, H);
  fotoLayout();
  const Ht = st.layers.reduce((s, l) => s + l.h, 0), fs = Math.max(12, Math.round(W / 70)), bh = Math.round(fs * 2.4);
  x.fillStyle = 'rgba(18,27,35,.82)'; x.fillRect(0, H - bh, W, bh);
  x.fillStyle = '#fff'; x.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`; x.textBaseline = 'middle';
  x.fillText(`GabiãoCAD · ${st.nome || 'muro de gabião'} · H ${fmt(Ht, 1)} m · L ${fmt(st.L, 1)} m`, fs, H - bh / 2);
  x.font = `400 ${Math.round(fs * 0.85)}px "IBM Plex Sans", system-ui, sans-serif`; x.textAlign = 'right'; x.fillStyle = '#C9D3DA';
  x.fillText('Ilustração. As medidas valem pelo projeto.', W - fs, H - bh / 2);
  return { canvas: c, w: W, h: H };
}

$('#fotoFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f && /^image\/(jpeg|png|webp)$/.test(f.type)) fotoSet(f); else if (f) toast('Use uma foto JPG, PNG ou WebP.'); });
$('#fotoEdit').onclick = () => { FOTO.edit = !FOTO.edit; $('#fotoEdit').setAttribute('aria-pressed', FOTO.edit); $('#fotoEdit').textContent = FOTO.edit ? 'Esconder pontos' : 'Ajustar pontos'; fotoDraw(); };
$('#fotoOp').oninput = e => { FOTO.op = +e.target.value; FOTO.dirty = true; fotoDraw(); };
$('#fotoLens').oninput = e => { FOTO.fUser = +e.target.value * Math.max(FOTO.w, FOTO.h); fotoCalibrate(); fotoDraw(); };
$('#fotoLensAuto').onclick = () => { FOTO.fUser = 0; fotoCalibrate(); fotoDraw(); };
$('#fotoReset').onclick = () => { if (!FOTO.file) return; FOTO.pts = null; FOTO.fUser = 0; FOTO.aiPts.delete(FOTO.file); fotoSet(FOTO.file); };
$('#fotoSave').onclick = async () => {
  const r = await fotoComposite(2400); if (!r) return;
  const blob = await new Promise(res => r.canvas.toBlob(res, 'image/jpeg', 0.9));
  await saveFile(slug() + '-na-foto.jpg', blob);
};

/* ---------- casos de água / rio ---------- */
function renderCases() {
  const card = $('#casesCard'), { cases, gov, scour } = RES, F = st.fs;
  card.hidden = !(cases.length > 1 || scour);
  if (card.hidden) return;
  const P = c => `<span class="pill ${c}">${c === 'ok' ? 'OK' : c === 'warn' ? 'ATENÇÃO' : 'NÃO'}</span>`;
  const rows = cases.map(cs => {
    const r = cs.res, ok = r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim, okE = Math.abs(r.e) <= r.B / 6;
    const c = ok ? (okE ? 'ok' : 'warn') : 'bad';
    return `<tr${cs === gov ? ' class="gov"' : ''}><td><b>${cs.nome}</b>${cs === gov ? ' <span class="pill cf">pior caso</span>' : ''}<br><span class="help">${cs.desc} · frente ${Number.isFinite(cs.cond.Yf) && cs.cond.Yf > 0 ? fmt(cs.cond.Yf, 2) + ' m' : 'seca'} · atrás ${fmt(cs.cond.Yw, 2)} m</span></td>
      <td class="n">${fmt(r.FSd)}</td><td class="n">${fmt(r.FSt)}</td><td class="n">${fmt(Math.abs(r.e), 2)} m</td><td class="n">${uf(r.smax, 'press', isT() ? 1 : 0)}</td><td>${P(c)}</td></tr>`;
  }).join('');
  let sc = '';
  if (scour) {
    const txt = st.river.apron
      ? (scour.ok ? `Colchão de ${fmt(scour.Lc, 1)} m cobre a erosão prevista (mínimo 1,5 × ${fmt(scour.ds, 2)} = ${fmt(scour.Lreq, 2)} m).` : `Colchão curto: use pelo menos ${fmt(scour.Lreq, 2)} m (1,5 × a erosão prevista de ${fmt(scour.ds, 2)} m).`)
      : (scour.ok ? `O embutimento de ${fmt(st.D, 2)} m é maior que a erosão prevista de ${fmt(scour.ds, 2)} m.` : `A erosão de ${fmt(scour.ds, 2)} m passa da base do muro (embutimento ${fmt(st.D, 2)} m). Use colchão de gabião ou aprofunde a base.`);
    const espTxt = scour.espRec >= 0.5 ? 'gabião caixa de 0,5 m' : `colchão de ${fmt(scour.espRec, 2)} m`;
    sc = `<tr><td><b>Erosão no pé do muro</b><br><span class="help">${txt}</span></td><td colspan="4"></td><td>${P(scour.ok ? 'ok' : 'bad')}</td></tr>
      <tr><td><b>Velocidade da água ${fmt(scour.v, 1)} m/s</b><br><span class="help">Proteção indicada: ${espTxt} ou mais.${st.river.apron && !scour.espOk ? ` O colchão de ${fmt(st.river.esp, 2)} m é fino para essa velocidade.` : ''}</span></td><td colspan="4"></td><td>${P(scour.espOk ? 'ok' : 'warn')}</td></tr>`;
  }
  $('#tblCases').innerHTML = `<thead><tr><th>Caso</th><th class="n">FS desliz.</th><th class="n">FS tomb.</th><th class="n">Excentr.</th><th class="n">Tensão máx.</th><th></th></tr></thead><tbody>${rows}${sc}</tbody>`;
}

/* ---------- transporte de terra ---------- */
function transporte(q) {
  const f = st.exc.fill, emp = f.emp > 0 ? f.emp : 1.25, cap = f.cap > 0 ? f.cap : 14;
  const solto = (q.reaterro + (q.fill ? q.fill.vol : 0)) * emp;
  return { emp, cap, solto, viagens: Math.ceil(solto / cap - 1e-9) };
}

/* ---------- resultados ---------- */
let RES = null;
function cls(ok, warn) { return ok ? 'ok' : warn ? 'warn' : 'bad'; }
function update() {
  clearTimeout(updTimer);
  try { updateCore(); }
  catch (err) {
    console.error(err);
    const b = $('#banner'); b.className = 'banner bad';
    b.innerHTML = 'Não foi possível calcular <span class="txt">Algum dado está fora do comum. Confira os últimos valores alterados. Detalhe: ' + esc(err.message || err) + '</span>';
  }
}
function updateCore() {
  persist();
  $('#hGeo').textContent = `H ${fmt(st.layers.reduce((s, l) => s + l.h, 0), 1)} m · B ${fmt(st.layers[0].b, 1)} m`;
  const pg = propsGabiao(st);
  $('#hRiver').textContent = st.river.on ? `N.A. ${fmt(st.river.hn, 1)} / cheia ${fmt(st.river.hc, 1)} m` : 'desligado';
  $('#hWater').textContent = st.water.on ? `com chuva · água a ${fmt(st.water.hw, 2)} m` : 'seco (drenado)';
  $('#wHt').textContent = fmt(st.layers.reduce((s, l) => s + l.h, 0), 2) + ' m';
  $('#hGab').textContent = `γ gabião ${uf(pg.gg, 'dens')}`;
  $('#gabDerived').innerHTML = `<span>Peso do gabião cheio <b>${uf(pg.gg, 'dens')}</b></span><span>Atrito entre camadas φ* <b>${fmt(pg.phiStar, 1)}°</b></span><span>Resistência do gabião τ <b>${uf(pg.tauAdm, 'press', isT() ? 1 : 0)}</b></span>`;
  // β precisa ser menor que φ (senão o empuxo de Coulomb não existe): calcula com β limitado e avisa
  const betaBad = st.soil.beta >= st.soil.phi;
  ['sbeta', 'sphi'].forEach(id => { const box = document.getElementById(id).closest('.inp'); box.classList.toggle('bad', betaBad); box.title = betaBad ? 'β precisa ser menor que φ' : ''; });
  let calcSt = st;
  if (betaBad) { calcSt = clone(st); calcSt.soil.beta = Math.max(0, st.soil.phi - 1); }
  RES = fullCalc(calcSt);
  renderResults(); renderDrawings();
  if (typeof optRenderBar === 'function') setTimeout(optRenderBar, 0);
  if (betaBad) {
    const b = $('#banner'); b.className = 'banner bad';
    b.innerHTML = `Corrija o solo do aterro <span class="txt">A inclinação do terreno acima do muro (β = ${fmt(st.soil.beta, 0)}°) precisa ser menor que o ângulo de atrito do aterro (φ = ${fmt(st.soil.phi, 0)}°). Um terreno mais inclinado que isso escorrega sozinho, sem muro nenhum. Os resultados abaixo usam β = ${fmt(calcSt.soil.beta, 0)}° só para não deixar a tela vazia. <button class="btn" type="button" id="fixBeta">Usar β = 0° (terreno plano)</button></span>`;
    $('#fixBeta').onclick = () => { st.soil.beta = 0; fillInputs(); update(); document.getElementById('sbeta').closest('details').open = true; };
  }
  if (V3.ready && !$('#view3dWrap').hidden) { clearTimeout(update._t); update._t = setTimeout(() => build3D(false), 150); }
  if (FOTO.cam) { FOTO.dirty = true; if (!$('#viewFoto').hidden) { clearTimeout(FOTO._t); FOTO._t = setTimeout(() => { fotoSyncPts(); fotoDraw(); }, 120); } }
}
/* motivos para manter a estabilidade global ligada (usado quando ela está desligada) */
function globRisk() {
  if (st.fs.globOn !== false) return [];
  const H = st.layers.reduce((s, l) => s + l.h, 0), r = [];
  if (H >= 3) r.push(`muro com ${fmt(H, 1)} m de altura`);
  if (st.found.phi < 25 && st.found.c < 10) r.push('fundação fraca');
  if (st.soil.beta > 0) r.push('terreno inclinado acima do muro');
  if (st.water.on || st.river.on) r.push(st.river.on ? 'margem de rio' : 'água no aterro');
  if (st.D < 0.3) r.push('base pouco enterrada');
  return r;
}
function renderResults() {
  const { ext, seco, internas, q } = RES, F = st.fs;
  const gov = RES.gov, chuva = gov ? ` (${gov.nome.toLowerCase()})` : '';
  const eLim = ext.B / 6;
  const items = [
    { k: 'Deslizamento', v: ext.FSd, r: `FS ≥ ${fmt(F.desl, 1)}`, c: cls(ext.FSd >= F.desl) },
    { k: 'Tombamento', v: ext.FSt, r: `FS ≥ ${fmt(F.tomb, 1)}`, c: cls(ext.FSt >= F.tomb) },
    { k: 'Excentricidade', v: Math.abs(ext.e), u: ' m', r: `≤ ${fmt(eLim, 2)} m`, c: cls(Math.abs(ext.e) <= eLim, Math.abs(ext.e) <= ext.B / 4) },
    { k: 'Tensão máx. no solo', v: ext.smax / UF(), d: isT() ? 1 : 0, u: ' ' + UL('press'), r: `≤ ${uf(st.found.sadm, 'press', isT() ? 1 : 0)}`, c: cls(ext.smax <= st.found.sadm) },
    ...(F.globOn !== false ? [{ k: 'Estabilidade global', v: RES.glob ? RES.glob.FS : NaN, r: `FS ≥ ${fmt(F.glob || 1.5, 1)}`, c: RES.glob ? cls(RES.glob.FS >= (F.glob || 1.5)) : 'warn' }] : []),
  ];
  $('#chips').classList.toggle('four', F.globOn === false);
  $('#chips').innerHTML = items.map(i => `<div class="chip ${i.c}"><span class="k">${i.k}</span><span class="v">${fmt(i.v, i.d ?? 2)}<small style="font-size:14px">${i.u || ''}</small></span><span class="r">${i.r}</span></div>`).join('');
  const intFail = internas.filter(r => !(r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim));
  const fails = items.filter(i => i.c === 'bad').map(i => i.k.toLowerCase());
  const warns = items.filter(i => i.c === 'warn').map(i => i.k.toLowerCase());
  const b = $('#banner');
  if (fails.length || intFail.length) {
    b.className = 'banner bad';
    const parts = []; if (fails.length) parts.push(fails.join(', ')); if (intFail.length) parts.push(`${intFail.length} seção(ões) interna(s)`);
    const onlyGlob = fails.length === 1 && fails[0] === 'estabilidade global' && !intFail.length;
    b.innerHTML = `Revisar o muro${chuva} <span class="txt">Não atende: ${parts.join('; ')}. ${onlyGlob ? 'O problema é o terreno em volta, não o muro: aprofunde o embutimento, melhore o solo da fundação, diminua a inclinação do terreno ou rebaixe o nível d\'água. Alargar o muro ajuda pouco.' : (gov ? 'Melhore a drenagem (nível d\'água mais baixo), aumente ' : 'Aumente ') + 'a largura das camadas inferiores ou a inclinação do muro.'}</span>`;
  } else if (warns.length) {
    b.className = 'banner warn';
    b.innerHTML = (!RES.glob && F.globOn !== false)
      ? `Atende com ressalva${chuva} <span class="txt">Não foi possível achar uma superfície de ruptura global para esta geometria. Confira a estabilidade global em um programa de taludes.</span>`
      : `Atende com ressalva${chuva} <span class="txt">A resultante saiu do terço central da base (base parcialmente sem compressão). Considere alargar a base.</span>`;
  } else {
    b.className = 'banner ok'; b.innerHTML = `Muro estável${chuva} <span class="txt">Atende deslizamento, tombamento, excentricidade, tensão no solo${F.globOn !== false ? ', estabilidade global' : ''} e as ${internas.length} seções internas${gov ? `, no pior caso (${gov.nome.toLowerCase()})` : ''}.${F.globOn === false ? ' Estabilidade global desligada: não foi verificada.' : ''}${globRisk().length ? ` <b>Recomendado ligar a estabilidade global:</b> ${globRisk().join('; ')}.` : ''}</span>`;
  }
  const pill = c => `<span class="pill ${c}">${c === 'ok' ? 'OK' : c === 'warn' ? 'ATENÇÃO' : 'NÃO'}</span>`;
  const sv = seco ? [seco.FSd, seco.FSt, Math.abs(seco.e), seco.smax / UF(), RES.globSeco ? RES.globSeco.FS : NaN] : null;
  $('#tblExt').innerHTML = `<thead><tr><th>Verificação</th>${seco ? '<th class="n">Seco</th>' : ''}<th class="n">${seco ? (RES.cases.length > 1 ? 'Pior caso' : gov.nome) : 'Obtido'}</th><th class="n">Exigido</th><th></th></tr></thead><tbody>
    ${items.map((i, k) => `<tr><td>${i.k}</td>${seco ? `<td class="n muted">${fmt(sv[k], i.d ?? 2)}${i.u || ''}</td>` : ''}<td class="n">${fmt(i.v, i.d ?? 2)}${i.u || ''}</td><td class="n">${i.r.replace('FS ', '')}</td><td>${pill(i.c)}</td></tr>`).join('')}</tbody>`;
  $('#forces').innerHTML = [
    ['Coeficiente de empuxo Ka', fmt(ext.Ka, 3)],
    ['Inclinação do plano de empuxo', fmt(ext.omega, 1) + '°'],
    ['Peso do gabião', uf(ext.Wg, 'force')],
    ['Peso do solo sobre degraus', uf(ext.Ws, 'force')],
    ...(ext.wet ? [['Empuxo da água no tardoz', uf(ext.Uw, 'force')], ['Subpressão na base', uf(ext.U, 'force')]] : []),
    ['Empuxo ativo Ea', uf(ext.Ea, 'force')],
    ['Componente horizontal Eh', uf(ext.Eh, 'force')],
    ['Componente vertical Ev', uf(ext.Ev, 'force')],
    ['Momento resistente', uf(ext.Mr, 'mom')],
    ['Momento de tombamento', uf(ext.Mo, 'mom')],
    ['Resultante a partir da ponta', fmt(ext.sPos, 2) + ' m'],
    ['Tensão mínima no solo', uf(ext.smin, 'press', isT() ? 1 : 0)],
    ...(RES.glob ? [['Círculo crítico (global): raio', fmt(RES.glob.R, 2) + ' m'], ['Círculo crítico: largura afetada', fmt(RES.glob.xR - RES.glob.xL, 2) + ' m']] : []),
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('#tblInt').innerHTML = `<thead><tr><th>Seção</th><th class="n">Altura acima</th><th class="n">Base</th><th class="n">FS desliz.</th><th class="n">FS tomb.</th><th class="n">Tensão máx.</th><th class="n">Resist. gabião</th><th></th></tr></thead><tbody>
    ${internas.length ? internas.slice().reverse().map(r => { const c = cls(r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim); return `<tr><td>Topo da C${r.j}</td><td class="n">${fmt(r.H, 2)} m</td><td class="n">${fmt(r.B, 1)} m</td><td class="n">${fmt(r.FSd)}</td><td class="n">${fmt(r.FSt)}</td><td class="n">${uf(r.smax, 'press', isT() ? 1 : 0)}</td><td class="n">${uf(r.sLim, 'press', isT() ? 1 : 0)}</td><td>${pill(c)}</td></tr>`; }).join('') : '<tr><td colspan="8" class="note">Muro com uma camada só: não há seções internas.</td></tr>'}</tbody>`;
  $('#qtSub').textContent = `para L = ${fmt(st.L, 1)} m`;
  $('#legFill').hidden = !q.fill;
  $('#legWater').hidden = !ext.wet;
  $('#legGlob').hidden = !RES.glob;
  $('#fsg').disabled = st.fs.globOn === false;
  renderCases();
  const anyOff = q.tipos.some(t => !t.catalogo);
  const TR = transporte(q);
  $('#tblQt').innerHTML = `<thead><tr><th>Item</th><th class="n">Quant.</th><th>Un.</th></tr></thead><tbody>
    ${q.tipos.map(t => `<tr><td>Gabião caixa ${fmt(t.c, 1)} × ${fmt(t.l, 1)} × ${fmt(t.h, 1)} m ${t.cf ? '<span class="pill cf">contraforte</span>' : ''} ${t.catalogo ? '' : '<span class="pill warn">sob medida</span>'}</td><td class="n">${t.qtd}</td><td>un</td></tr>`).join('')}
    <tr class="total"><td>Total de caixas</td><td class="n">${q.nCaixas}</td><td>un</td></tr>
    <tr><td>Volume de gabião</td><td class="n">${fmt(q.vol, 1)}</td><td>m³</td></tr>
    <tr><td>Pedra de mão (enchimento)</td><td class="n">${fmt(q.pedraM3, 1)}</td><td>m³</td></tr>
    <tr><td>Peso estimado de pedra</td><td class="n">${fmt(q.pedraT, 1)}</td><td>t</td></tr>
    <tr><td>Geotêxtil no tardoz</td><td class="n">${fmt(q.geoTardoz, 1)}</td><td>m²</td></tr>
    ${RES.scour && RES.scour.qtd ? (() => { const k = RES.scour.qtd; return `<tr class="riverrow"><td>Colchão de gabião ${fmt(k.comp, 1)} × ${fmt(k.larg, 1)} × ${fmt(k.esp, 2)} m <span class="pill cf">pé do muro</span></td><td class="n">${k.n}</td><td>un</td></tr>
    <tr class="riverrow"><td class="sub">pedra para o colchão</td><td class="n">${fmt(k.vol, 1)}</td><td>m³</td></tr>
    <tr class="riverrow"><td class="sub">peso da pedra do colchão</td><td class="n">${fmt(k.vol * propsGabiao(st).gg / 9.81, 1)}</td><td>t</td></tr>
    <tr class="riverrow"><td class="sub">geotêxtil sob o colchão</td><td class="n">${fmt(k.area * (1 + st.geo.overlap / 100), 1)}</td><td>m²</td></tr>`; })() : ''}
    ${st.geo.base ? `<tr><td>Geotêxtil na base</td><td class="n">${fmt(q.geoBase, 1)}</td><td>m²</td></tr>` : ''}
    <tr><td>Escavação (${st.exc.scenario})</td><td class="n">${fmt(q.escav, 1)}</td><td>m³</td></tr>
    <tr><td>Reaterro da vala, compactado</td><td class="n">${fmt(q.reaterro, 1)}</td><td>m³</td></tr>
    <tr><td class="sub">peso do reaterro</td><td class="n">${fmt(q.reaterroT, 1)}</td><td>t</td></tr>
    ${q.fill ? `<tr class="fillrow"><td>Aterro do vazio atrás do muro, compactado</td><td class="n">${fmt(q.fill.vol, 1)}</td><td>m³</td></tr>
    <tr class="fillrow"><td class="sub">terra solta a trazer (empolamento ${fmt(st.exc.fill.emp, 2)})</td><td class="n">${fmt(q.fill.solto, 1)}</td><td>m³</td></tr>
    <tr class="fillrow"><td class="sub">peso do aterro</td><td class="n">${fmt(q.fill.peso, 1)}</td><td>t</td></tr>` : ''}
    <tr class="total"><td>Total de viagens de caminhão (${fmt(TR.cap, 0)} m³)</td><td class="n">${TR.viagens}</td><td>viag.</td></tr></tbody>
    ${anyOff ? '<caption style="caption-side:bottom;text-align:left;padding-top:8px" class="note">Peças sob medida surgem quando o comprimento do muro ou a largura da camada não fecha com as caixas de catálogo. Ajuste o comprimento do muro ou corte e costure caixas padrão.</caption>' : ''}`;
}
function renderDrawings() {
  if (!RES) return;
  const C = themeColors();
  $('#corteWrap').innerHTML = svgCorte(st, RES, C);
  $('#vistaWrap').innerHTML = svgVista(st, RES, C);
}

/* ---------- abas ---------- */
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
  const v = t.dataset.view;
  $('#viewCorte').hidden = v !== 'corte'; $('#viewVista').hidden = v !== 'vista'; $('#view3dWrap').hidden = v !== '3d'; $('#viewFoto').hidden = v !== 'foto';
  if (v === '3d') { if (!V3.ready) init3D(); else { build3D(false); resize3D(); } }
  if (v === 'foto') fotoShow();
});

/* ---------- tema ---------- */
const reTheme = () => { renderDrawings(); if (V3.ready) build3D(false); };
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reTheme); } catch (e) {}
new MutationObserver(reTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- exportação ---------- */
let DL;
async function downloads() { if (DL !== undefined) return DL; try { DL = window.claude ? await window.claude.use('downloads') : null; } catch (e) { DL = null; } return DL; }
async function saveFile(filename, data) {
  const dl = await downloads();
  if (!dl) { toast('Exportar não está disponível nesta visualização. Abra o GabiãoCAD pelo claude.ai.'); return; }
  try { await dl.save({ filename, data }); toast('Arquivo salvo: ' + filename); }
  catch (e) {
    const c = e && e.code;
    if (c === 'declined') toast('Download cancelado.');
    else if (c === 'rate_limited') toast('Já existe um download aguardando confirmação.');
    else toast('Não foi possível salvar o arquivo (' + (c || 'erro') + ').');
  }
}
const slug = () => (st.nome || 'muro-gabiao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'muro-gabiao';
function svgToPng(svg, scale = 2) {
  return new Promise((res, rej) => {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), w = +m[1], h = +m[2];
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? res({ blob: b, canvas: c, w, h }) : rej(new Error('png')), 'image/png'); };
    img.onerror = () => rej(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
/* ===== Relatório PDF e planilha Excel ===== */
const APP_VERSION = '0.5';
const STATUS_TXT = { ok: 'OK', warn: 'ATENÇÃO', bad: 'NÃO ATENDE', na: '—' };
const REP_COL = { ink: '#16212B', muted: '#596772', line: '#C6CFD6', accent: '#A9611B', head: '#16212B', zebra: '#F3F5F7', group: '#E6EBEE',
  ok: '#2C7A4B', okBg: '#DCEFE3', bad: '#B0352C', badBg: '#F7DEDB', warn: '#9A6512', warnBg: '#F6E8CC' };

function reportModel() {
  const { ext, seco, internas, q, props, cases, gov, scour, glob, globSeco } = RES, F = st.fs;
  const H = q.altura, T = transporte(q), P = isT() ? 2 : 1;
  const st3 = (ok, warn) => (ok ? 'ok' : warn ? 'warn' : 'bad');
  const nn = (v, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '—');
  const pr = v => nn(v / UF(), P), prU = ' ' + UL('press');
  const checks = [
    { item: 'Deslizamento (FS)', seco: seco ? nn(seco.FSd) : null, pior: nn(ext.FSd), exig: '≥ ' + fmt(F.desl, 1), s: st3(ext.FSd >= F.desl) },
    { item: 'Tombamento (FS)', seco: seco ? nn(seco.FSt) : null, pior: nn(ext.FSt), exig: '≥ ' + fmt(F.tomb, 1), s: st3(ext.FSt >= F.tomb) },
    { item: 'Excentricidade (m)', seco: seco ? nn(Math.abs(seco.e)) : null, pior: nn(Math.abs(ext.e)), exig: '≤ ' + fmt(ext.B / 6, 2) + ' (B/6)', s: st3(Math.abs(ext.e) <= ext.B / 6, Math.abs(ext.e) <= ext.B / 4) },
    { item: 'Tensão máxima no solo (' + UL('press') + ')', seco: seco ? pr(seco.smax) : null, pior: pr(ext.smax), exig: '≤ ' + pr(st.found.sadm), s: st3(ext.smax <= st.found.sadm) },
    F.globOn === false
      ? { item: 'Estabilidade global (FS)', seco: seco ? '—' : null, pior: 'não verificada', exig: 'desligada', s: 'na' }
      : { item: 'Estabilidade global (FS, Bishop)', seco: seco ? (globSeco ? nn(globSeco.FS) : '—') : null, pior: glob ? nn(glob.FS) : '—', exig: '≥ ' + fmt(F.glob || 1.5, 1), s: glob ? st3(glob.FS >= (F.glob || 1.5)) : 'warn' },
  ];
  const intOk = internas.every(r => r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim);
  if (internas.length) checks.push({ item: `Seções internas (${internas.length})`, seco: seco ? '' : null, pior: intOk ? 'todas OK' : 'falha', exig: 'FS e tensão', s: intOk ? 'ok' : 'bad' });
  if (scour) checks.push({ item: 'Erosão no pé do muro', seco: seco ? '' : null, pior: st.river.apron ? `colchão ${fmt(scour.Lc, 1)} m` : `D = ${fmt(st.D, 2)} m`, exig: st.river.apron ? `≥ ${fmt(scour.Lreq, 2)} m` : `≥ ${fmt(scour.ds, 2)} m`, s: scour.ok ? 'ok' : 'bad' });
  const fails = checks.filter(c => c.s === 'bad').map(c => c.item.replace(/ \(.*$/, '').toLowerCase());
  const warns = checks.filter(c => c.s === 'warn');
  const status = fails.length ? { s: 'bad', title: 'NÃO ATENDE', text: 'Revisar: ' + fails.join(', ') + '.' }
    : warns.length ? { s: 'warn', title: 'ATENDE COM RESSALVA', text: warns.map(w => w.item).join(', ') + ' em atenção.' }
    : { s: 'ok', title: 'ATENDE A TODAS AS VERIFICAÇÕES', text: gov ? `Inclusive no pior caso com água (${gov.nome.toLowerCase()}).` : 'Condição seca (aterro drenado).' };
  if (F.globOn === false && status.s === 'ok') status.text += ' Estabilidade global não verificada (desligada).';
  const casesRows = cases.map(cs => {
    const r = cs.res, okc = r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim;
    return { nome: cs.nome + (cs === gov ? ' (pior)' : ''), frente: Number.isFinite(cs.cond.Yf) && cs.cond.Yf > 0 ? fmt(cs.cond.Yf, 2) : 'seca', atras: fmt(cs.cond.Yw, 2), FSd: nn(r.FSd), FSt: nn(r.FSt), e: nn(Math.abs(r.e)), smax: pr(r.smax), s: okc ? (Math.abs(r.e) <= r.B / 6 ? 'ok' : 'warn') : 'bad' };
  });
  const intRows = internas.slice().reverse().map(r => ({ sec: `Topo da C${r.j}`, H: fmt(r.H, 2), B: fmt(r.B, 1), FSd: nn(r.FSd), FSt: nn(r.FSt), smax: pr(r.smax), lim: pr(r.sLim), s: (r.FSd >= F.desl && r.FSt >= F.tomb && r.smax <= r.sLim) ? 'ok' : 'bad' }));
  const fU = ' ' + UL('force'), mU = ' ' + UL('mom');
  const forces = [
    ['Coeficiente de empuxo ativo Ka', fmt(ext.Ka, 3)], ['Empuxo ativo Ea', fmt(ext.Ea / UF(), 2) + fU],
    ['Componente horizontal Eh', fmt(ext.Eh / UF(), 2) + fU], ['Componente vertical Ev', fmt(ext.Ev / UF(), 2) + fU],
    ['Peso do gabião', fmt(ext.Wg / UF(), 2) + fU], ['Peso do solo sobre os degraus', fmt(ext.Ws / UF(), 2) + fU],
    ...(ext.wet ? [['Empuxo da água no tardoz', fmt(ext.Uw / UF(), 2) + fU], ['Subpressão na base', fmt(ext.U / UF(), 2) + fU]] : []),
    ['Momento resistente', fmt(ext.Mr / UF(), 2) + mU], ['Momento de tombamento', fmt(ext.Mo / UF(), 2) + mU],
    ['Resultante a partir da ponta', fmt(ext.sPos, 2) + ' m'], ['Tensão mínima no solo', pr(ext.smin) + prU],
    ...(glob ? [['Círculo crítico: raio', fmt(glob.R, 2) + ' m'], ['Círculo crítico: largura afetada', fmt(glob.xR - glob.xL, 2) + ' m']] : []),
  ];
  const dU = UL('dens'), pU = UL('press');
  const entrada = [
    { t: 'Geometria', rows: [['Comprimento do muro', st.L, 'm'], ['Altura total', H, 'm'], ['Inclinação do muro', st.batter, '°'], ['Embutimento (terreno à frente)', st.D, 'm'], ['Degraus', st.faceMode === 'externa' ? 'na face (frente)' : 'no tardoz (atrás)', ''], ['Comprimento da caixa', st.boxLen, 'm'], ['Juntas', st.stagger ? 'desencontradas' : 'alinhadas', '']] },
    { t: 'Solo do aterro', rows: [['Peso específico γ', +(st.soil.gamma / UF()).toFixed(3), dU], ['Ângulo de atrito φ', st.soil.phi, '°'], ['Atrito solo-muro δ', st.soil.delta, '°'], ['Inclinação do terreno β', st.soil.beta, '°'], ['Sobrecarga q', +(st.soil.q / UF()).toFixed(3), pU]] },
    { t: 'Fundação', rows: [['Ângulo de atrito φ', st.found.phi, '°'], ['Coesão c (2/3 c como adesão no deslizamento)', +(st.found.c / UF()).toFixed(3), pU], ['Tensão admissível σadm', +(st.found.sadm / UF()).toFixed(2), pU]] },
    { t: 'Gabião', rows: [['Peso específico da rocha', +(st.gab.gs / UF()).toFixed(3), dU], ['Porosidade', st.gab.n, ''], ['Peso do gabião cheio γg', +(props.gg / UF()).toFixed(3), dU], ['Atrito entre camadas φ*', +props.phiStar.toFixed(1), '°'], ['Resistência do gabião τ', +(props.tauAdm / UF()).toFixed(1), pU]] },
    ...(st.water.on ? [{ t: 'Chuva', rows: [['Peso do solo encharcado γsat', +(st.water.gsat / UF()).toFixed(3), dU], ['Altura da água atrás do muro', st.water.hw, 'm']] }] : []),
    ...(st.river.on ? [{ t: 'Leito de rio', rows: [['Nível normal do rio', st.river.hn, 'm'], ['Nível na cheia', st.river.hc, 'm'], ['Velocidade da água', st.river.v, 'm/s'], ['Erosão prevista', st.river.ds, 'm'], ['Colchão de gabião', st.river.apron ? `${fmt(st.river.lc, 1)} × ${fmt(st.river.esp, 2)}` : 'não', st.river.apron ? 'm' : '']] }] : []),
    { t: 'Escavação e transporte', rows: [['Situação', st.exc.scenario, ''], ['Folga de trabalho', st.exc.folga, 'm'], ['Talude da vala', st.exc.m, 'H:1V'], ['Empolamento', st.exc.fill.emp, ''], ['Capacidade do caminhão', T.cap, 'm³'], ...(q.fill ? [['Distância até o barranco', st.exc.fill.a, 'm'], ['Inclinação do barranco', st.exc.fill.m, 'H:1V']] : [])] },
    { t: 'Critérios (NBR 11682)', rows: [['FS mínimo deslizamento', F.desl, ''], ['FS mínimo tombamento', F.tomb, ''], ['FS mínimo estabilidade global', F.globOn === false ? 'desligada' : (F.glob || 1.5), '']] },
  ];
  const camadas = st.layers.map((l, i) => ({ c: `C${i + 1}`, b: l.b, h: l.h, disp: l.cf ? 'Contraforte (' + splitWidth(l.b, st.boxLen).map(v => fmt(v, 1)).join(' + ') + ' m)' : 'Em fila', vol: l.b * l.h * st.L })).reverse();
  // quantitativos agrupados; price=true -> entra no orçamento
  const gq = [];
  gq.push({ t: 'Gabiões', rows: [...q.tipos.map(t => ({ item: `Gabião caixa ${fmt(t.c, 1)} × ${fmt(t.l, 1)} × ${fmt(t.h, 1)} m${t.cf ? ' (contraforte)' : ''}${t.catalogo ? '' : ' (sob medida)'}`, u: 'un', v: t.qtd, d: 0, price: true })),
    { item: 'Total de caixas', u: 'un', v: q.nCaixas, d: 0, info: true }, { item: 'Volume de gabião', u: 'm³', v: q.vol, d: 1, info: true }] });
  gq.push({ t: 'Materiais', rows: [{ item: 'Pedra de mão (enchimento)', u: 'm³', v: q.pedraM3, d: 1, price: true }, { item: 'Peso estimado da pedra', u: 't', v: q.pedraT, d: 1, info: true },
    { item: 'Geotêxtil no tardoz', u: 'm²', v: q.geoTardoz, d: 1, price: true }, ...(st.geo.base ? [{ item: 'Geotêxtil na base', u: 'm²', v: q.geoBase, d: 1, price: true }] : [])] });
  if (scour && scour.qtd) { const k = scour.qtd; gq.push({ t: 'Proteção do pé (leito de rio)', rows: [{ item: `Colchão de gabião ${fmt(k.comp, 1)} × ${fmt(k.larg, 1)} × ${fmt(k.esp, 2)} m`, u: 'un', v: k.n, d: 0, price: true }, { item: 'Pedra para o colchão', u: 'm³', v: k.vol, d: 1, price: true }, { item: 'Geotêxtil sob o colchão', u: 'm²', v: k.area * (1 + st.geo.overlap / 100), d: 1, price: true }] }); }
  gq.push({ t: 'Terraplenagem e transporte', rows: [{ item: `Escavação (${st.exc.scenario})`, u: 'm³', v: q.escav, d: 1, price: true }, { item: 'Reaterro da vala, compactado', u: 'm³', v: q.reaterro, d: 1, price: true }, { item: 'Peso do reaterro', u: 't', v: q.reaterroT, d: 1, info: true },
    ...(q.fill ? [{ item: 'Aterro do vazio atrás do muro, compactado', u: 'm³', v: q.fill.vol, d: 1, price: true }, { item: `Terra solta a trazer (empolamento ${fmt(st.exc.fill.emp, 2)})`, u: 'm³', v: q.fill.solto, d: 1, info: true }, { item: 'Peso do aterro', u: 't', v: q.fill.peso, d: 1, info: true }] : []),
    { item: `Viagens de caminhão (${fmt(T.cap, 0)} m³)`, u: 'viag.', v: T.viagens, d: 0, price: true }] });
  const premissas = [
    'Empuxo ativo pela teoria de Coulomb, aplicado num plano virtual que liga o calcanhar ao canto superior do tardoz; o solo sobre os degraus soma-se ao peso do muro.',
    'Empuxo passivo do embutimento desprezado, a favor da segurança.',
    'Seções internas: atrito entre camadas φ* = 25·γg − 10 e resistência do gabião τ = 50·γg − 30 (γg em tf/m³, τ em tf/m²), conforme a prática dos fabricantes.',
    'Com chuva: solo saturado acima e submerso abaixo do nível d\'água, pressão da água no tardoz e subpressão na base. No leito de rio, verificados os casos de rio normal, cheia e rebaixamento rápido; adotado o pior.',
    F.globOn === false ? 'Estabilidade global NÃO verificada (opção desligada pelo usuário).' : 'Estabilidade global pelo método de Bishop simplificado, com busca automática do círculo crítico passando sob o muro; fundação considerada homogênea.',
    'Quantitativos estimados a partir da geometria; confirmar em campo antes da compra.',
    'Este documento é de pré-dimensionamento. O projeto executivo exige engenheiro responsável e Anotação de Responsabilidade Técnica (ART).',
  ];
  return { nome: st.nome || 'Muro de gabião', data: new Date().toLocaleDateString('pt-BR'), unidades: isT() ? 'toneladas-força (tf) e metros' : 'quilonewtons (kN) e metros',
    status, kpis: [['Altura', fmt(H, 1) + ' m'], ['Comprimento', fmt(st.L, 1) + ' m'], ['Volume de gabião', fmt(q.vol, 1) + ' m³'], ['Caixas', String(q.nCaixas)], ['Viagens de caminhão', String(T.viagens)]],
    checks, hasSeco: !!seco, govNome: gov ? gov.nome : null, casesRows, intRows, forces, entrada, camadas, gq, premissas };
}

/* ---------- PDF ---------- */
async function ensurePdfLibs() {
  if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
}
async function exportPdf() {
  await ensurePdfLibs();
  const M = reportModel(), C = REP_COL;
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Plex-R.ttf', PDF_FONTS.regular); doc.addFont('Plex-R.ttf', 'Plex', 'normal');
  doc.addFileToVFS('Plex-B.ttf', PDF_FONTS.semibold); doc.addFont('Plex-B.ttf', 'Plex', 'bold');
  const PW = 210, PH = 297, ML = 16, MR = 16, CW = PW - ML - MR, TOP = 24, BOT = 20;
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const font = (w, size, color) => { doc.setFont('Plex', w); doc.setFontSize(size); doc.setTextColor(...rgb(color || C.ink)); };
  let y = TOP, sec = 0;
  const need = h => { if (y + h > PH - BOT) { doc.addPage(); y = TOP; } };
  const heading = (t, space = 16) => {
    need(space); sec++;
    font('bold', 12.5, C.ink); doc.text(`${sec}. ${t}`, ML, y + 5);
    doc.setDrawColor(...rgb(C.accent)); doc.setLineWidth(0.6); doc.line(ML, y + 7.2, ML + CW, y + 7.2);
    y += 11;
  };
  const sFill = { ok: C.okBg, warn: C.warnBg, bad: C.badBg, na: C.group }, sText = { ok: C.ok, warn: C.warn, bad: C.bad, na: C.muted };
  const table = (head, body, opts = {}) => {
    doc.autoTable({
      startY: y, head: [head], body, margin: { left: ML, right: MR, top: TOP, bottom: BOT }, theme: 'grid',
      styles: { font: 'Plex', fontSize: 8.6, cellPadding: { top: 1.6, bottom: 1.6, left: 2.2, right: 2.2 }, lineColor: rgb(C.line), lineWidth: 0.15, textColor: rgb(C.ink), valign: 'middle' },
      headStyles: { fillColor: rgb(C.head), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
      alternateRowStyles: { fillColor: rgb(C.zebra) },
      ...opts,
      didParseCell: d => {
        if (opts.statusCol !== undefined && d.section === 'body' && d.column.index === opts.statusCol) {
          const s = d.cell.raw && d.cell.raw.s; if (s) { d.cell.text = [STATUS_TXT[s]]; d.cell.styles.fillColor = rgb(sFill[s]); d.cell.styles.textColor = rgb(sText[s]); d.cell.styles.fontStyle = 'bold'; d.cell.styles.halign = 'center'; }
        }
        if (d.section === 'body' && d.row.raw && d.row.raw.group) { d.cell.styles.fillColor = rgb(C.group); d.cell.styles.fontStyle = 'bold'; }
        if (d.section === 'body' && d.row.raw && d.row.raw.info && d.column.index === 0) { d.cell.styles.textColor = rgb(C.muted); }
        if (opts.extraParse) opts.extraParse(d);
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  };
  const S = s => ({ content: '', s });

  // título
  font('bold', 20, C.ink); doc.text(doc.splitTextToSize(M.nome, CW), ML, y + 6);
  y += 6 + 8 * (doc.splitTextToSize(M.nome, CW).length - 1);
  font('normal', 10, C.muted); doc.text('Memorial de cálculo e quantitativos · muro de gabião', ML, y + 6);
  font('normal', 8.5, C.muted); doc.text(`Emitido em ${M.data} · Unidades: ${M.unidades} · GabiãoCAD ${APP_VERSION}`, ML, y + 11.5);
  y += 17;
  // resultado
  const bg = { ok: C.okBg, warn: C.warnBg, bad: C.badBg }[M.status.s], fg = { ok: C.ok, warn: C.warn, bad: C.bad }[M.status.s];
  doc.setFillColor(...rgb(bg)); doc.setDrawColor(...rgb(fg)); doc.setLineWidth(0.5); doc.roundedRect(ML, y, CW, 15, 1.5, 1.5, 'FD');
  font('bold', 11.5, fg); doc.text(M.status.title, ML + 5, y + 6.3);
  font('normal', 8.8, C.ink); doc.text(doc.splitTextToSize(M.status.text, CW - 10)[0], ML + 5, y + 11.5);
  y += 20;
  // indicadores
  const kw = (CW - 4 * 3) / 5;
  M.kpis.forEach((k, i) => {
    const x = ML + i * (kw + 3);
    doc.setFillColor(...rgb(C.zebra)); doc.setDrawColor(...rgb(C.line)); doc.setLineWidth(0.2); doc.roundedRect(x, y, kw, 15, 1.2, 1.2, 'FD');
    font('normal', 7.2, C.muted); doc.text(k[0].toUpperCase(), x + 3, y + 5);
    font('bold', 12, C.ink); doc.text(k[1], x + 3, y + 11.6);
  });
  y += 21;
  // corte
  heading('Seção transversal');
  const corte = await svgToPng(svgCorte(st, RES, LIGHT), 2.5);
  let ih = Math.min(105, CW * corte.h / corte.w), iw = ih * corte.w / corte.h;
  need(ih + 6);
  doc.addImage(corte.canvas.toDataURL('image/jpeg', 0.92), 'JPEG', ML + (CW - iw) / 2, y, iw, ih); y += ih + 2;
  font('normal', 7.5, C.muted); doc.text('Corte transversal com camadas, empuxo, peso, escavação, geotêxtil e superfície crítica de ruptura global.', ML, y + 3); y += 8;
  // verificações
  heading('Verificações de estabilidade');
  const head = ['Verificação', ...(M.hasSeco ? ['Seco'] : []), M.hasSeco ? 'Pior caso' : 'Obtido', 'Exigido', 'Situação'];
  table(head, M.checks.map(c => [c.item, ...(M.hasSeco ? [c.seco ?? ''] : []), c.pior, c.exig, S(c.s)]),
    { statusCol: head.length - 1, columnStyles: { 0: { cellWidth: 68 }, [head.length - 1]: { cellWidth: 26 } }, extraParse: d => { if (d.section !== 'head' && d.column.index > 0 && d.column.index < head.length - 1) d.cell.styles.halign = 'right'; } });
  if (M.govNome) { font('normal', 7.8, C.muted); doc.text(`Pior caso adotado: ${M.govNome.toLowerCase()}.`, ML, y - 2.5); y += 2; }
  if (M.casesRows.length > 1) {
    heading('Casos com água', 40);
    table(['Caso', 'Água frente (m)', 'Água atrás (m)', 'FS desl.', 'FS tomb.', 'Excentr. (m)', 'Tensão máx.', 'Situação'],
      M.casesRows.map(r => [r.nome, r.frente, r.atras, r.FSd, r.FSt, r.e, r.smax, S(r.s)]), { statusCol: 7, columnStyles: { 0: { cellWidth: 44 }, 7: { cellWidth: 25 } }, extraParse: d => { if (d.column.index > 0 && d.column.index < 7) d.cell.styles.halign = 'right'; } });
  }
  if (M.intRows.length) {
    heading('Verificação interna (entre camadas)', 40);
    table(['Seção', 'Altura acima (m)', 'Base (m)', 'FS desl.', 'FS tomb.', 'Tensão máx.', 'Resist. gabião', 'Situação'],
      M.intRows.map(r => [r.sec, r.H, r.B, r.FSd, r.FSt, r.smax, r.lim, S(r.s)]), { statusCol: 7, columnStyles: { 7: { cellWidth: 25 } }, extraParse: d => { if (d.column.index > 0 && d.column.index < 7) d.cell.styles.halign = 'right'; } });
  }
  heading('Esforços no pior caso', 50);
  const half = Math.ceil(M.forces.length / 2);
  table(['Grandeza', 'Valor', 'Grandeza', 'Valor'], Array.from({ length: half }, (_, i) => [M.forces[i][0], M.forces[i][1], ...(M.forces[i + half] || ['', ''])]),
    { columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 30 } } });
  // vista
  heading('Vista frontal');
  const vista = await svgToPng(svgVista(st, RES, LIGHT), 2);
  let vw = CW, vh = vw * vista.h / vista.w; if (vh > 70) { vh = 70; vw = vh * vista.w / vista.h; }
  need(vh + 4);
  doc.addImage(vista.canvas.toDataURL('image/jpeg', 0.9), 'JPEG', ML, y, vw, vh); y += vh + 6;
  // muro na foto do local (se o usuário montou)
  if (FOTO.cam && FOTO.file) {
    const fc = await fotoComposite(1800);
    if (fc) {
      let fw = CW, fh = fw * fc.h / fc.w; if (fh > 120) { fh = 120; fw = fh * fc.w / fc.h; }
      heading('Ilustração no local', fh + 24);          // título e imagem na mesma página
      doc.addImage(fc.canvas.toDataURL('image/jpeg', 0.88), 'JPEG', ML + (CW - fw) / 2, y, fw, fh); y += fh + 2;
      font('normal', 7.5, C.muted); doc.text('Montagem do muro projetado sobre a foto do local. É uma ilustração: as medidas valem pelo projeto, não pela imagem.', ML, y + 3); y += 8;
    }
  }
  // quantitativos
  heading('Quantitativos', 60);
  const qb = [];
  M.gq.forEach(g => { qb.push({ group: true, _c: [{ content: g.t, colSpan: 3 }] }); g.rows.forEach(r => qb.push({ info: r.info, _c: [r.item, fmt(r.v, r.d), r.u] })); });
  doc.autoTable({
    startY: y, head: [['Item', 'Quantidade', 'Unid.']], body: qb.map(r => Object.assign(r._c.slice(), { group: r.group, info: r.info })),
    margin: { left: ML, right: MR, top: TOP, bottom: BOT }, theme: 'grid',
    styles: { font: 'Plex', fontSize: 8.6, cellPadding: { top: 1.6, bottom: 1.6, left: 2.2, right: 2.2 }, lineColor: rgb(C.line), lineWidth: 0.15, textColor: rgb(C.ink) },
    headStyles: { fillColor: rgb(C.head), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { cellWidth: 18 } },
    didParseCell: d => { const raw = qb[d.row.index]; if (d.section !== 'body' || !raw) return; if (raw.group) { d.cell.styles.fillColor = rgb(C.group); d.cell.styles.fontStyle = 'bold'; } else if (raw.info) d.cell.styles.textColor = rgb(C.muted); },
  });
  y = doc.lastAutoTable.finalY + 3;
  font('normal', 7.5, C.muted); doc.text('Itens em cinza são informativos (totais e pesos). Os preços podem ser preenchidos na planilha Excel exportada.', ML, y + 2); y += 8;
  heading('Camadas (do topo para a base)', 40);
  table(['Camada', 'Largura (m)', 'Altura (m)', 'Disposição das caixas', 'Volume (m³)'], M.camadas.map(c => [c.c, fmt(c.b, 1), fmt(c.h, 1), c.disp, fmt(c.vol, 1)]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 4: { halign: 'right' } } });
  heading('Dados de entrada', 120);
  // duas colunas lado a lado, grupos inteiros em cada coluna
  const tot = M.entrada.reduce((n, g) => n + g.rows.length + 1, 0);
  const colL = [], colR = []; let acc = 0;
  M.entrada.forEach(g => { (acc < tot / 2 ? colL : colR).push(g); acc += g.rows.length + 1; });
  const half2 = (CW - 6) / 2, y0e = y;
  const mk = gs => { const b = []; gs.forEach(g => { b.push([{ content: g.t, colSpan: 3, styles: { fillColor: rgb(C.group), fontStyle: 'bold' } }]); g.rows.forEach(r => b.push([r[0], typeof r[1] === 'number' ? r[1].toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : String(r[1]), r[2]])); }); return b; };
  let yEnd = y0e;
  [[colL, ML], [colR, ML + half2 + 6]].forEach(([gs, x]) => {
    if (!gs.length) return;
    doc.autoTable({ startY: y0e, head: [['Parâmetro', 'Valor', 'Unid.']], body: mk(gs), margin: { left: x, right: PW - x - half2, top: TOP, bottom: BOT }, tableWidth: half2, theme: 'grid', pageBreak: 'avoid',
      styles: { font: 'Plex', fontSize: 8, cellPadding: { top: 1.3, bottom: 1.3, left: 1.8, right: 1.8 }, lineColor: rgb(C.line), lineWidth: 0.15, textColor: rgb(C.ink) },
      headStyles: { fillColor: rgb(C.head), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 }, columnStyles: { 1: { halign: 'right', cellWidth: 27 }, 2: { cellWidth: 12 } } });
    yEnd = Math.max(yEnd, doc.lastAutoTable.finalY);
  });
  y = yEnd + 6;
  heading('Premissas e responsabilidade', 50);
  font('normal', 8.6, C.ink);
  M.premissas.forEach(p => { const lines = doc.splitTextToSize(p, CW - 5); need(lines.length * 4 + 1.5); doc.text('•', ML + 1, y + 3); doc.text(lines, ML + 5, y + 3); y += lines.length * 4 + 1.5; });
  y += 3; need(22);
  doc.setDrawColor(...rgb(C.ink)); doc.setLineWidth(0.3);
  [['Responsável técnico', ML], ['CREA / ART nº', ML + CW / 2 + 4]].forEach(([lb, x]) => { doc.line(x, y + 14, x + CW / 2 - 4, y + 14); font('normal', 8, C.muted); doc.text(lb, x, y + 18.5); });
  // cabeçalho e rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (window.PDF_MARCA_DAGUA) {
      doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.09 }));
      font('bold', 40, C.ink); doc.text(window.PDF_MARCA_DAGUA, PW / 2 - 70, PH / 2 + 40, { angle: 35 });
      doc.restoreGraphicsState();
    }
    font('bold', 8.5, C.accent); doc.text('GabiãoCAD', ML, 12);
    font('normal', 8.5, C.muted); doc.text('Memorial de cálculo · muro de gabião', ML + 18, 12);
    doc.text(doc.splitTextToSize(M.nome, 80)[0], PW - MR, 12, { align: 'right' });
    doc.setDrawColor(...rgb(C.line)); doc.setLineWidth(0.3); doc.line(ML, 14.5, PW - MR, 14.5);
    doc.line(ML, PH - 13, PW - MR, PH - 13);
    font('normal', 7.3, C.muted);
    doc.text('Pré-dimensionamento. O projeto executivo exige engenheiro responsável e ART.', ML, PH - 8.5);
    doc.text(`Página ${i} de ${n} · ${M.data}`, PW - MR, PH - 8.5, { align: 'right' });
  }
  await saveFile(slug() + '-memorial.pdf', new Blob([doc.output('arraybuffer')]));
}

/* ---------- Excel ---------- */
async function exportXlsx() {
  if (!window.ExcelJS) await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
  const M = reportModel(), C = REP_COL, X = window.ExcelJS;
  const wb = new X.Workbook(); wb.creator = 'GabiãoCAD'; wb.created = new Date();
  const argb = h => 'FF' + h.slice(1).toUpperCase();
  const thin = { style: 'thin', color: { argb: argb(C.line) } }, border = { top: thin, left: thin, bottom: thin, right: thin };
  const fill = h => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(h) } });
  const FONT = 'Calibri';
  const styleHead = row => row.eachCell(c => { c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(C.head); c.border = border; c.alignment = { vertical: 'middle', wrapText: true }; });
  const styleBody = (row, zebra) => row.eachCell({ includeEmpty: true }, c => { c.border = border; c.font = c.font && c.font.color ? c.font : { name: FONT, color: { argb: argb(C.ink) } }; if (zebra) c.fill = fill(C.zebra); c.alignment = Object.assign({ vertical: 'middle' }, c.alignment || {}); });
  const statusCell = (c, s) => { c.value = STATUS_TXT[s]; c.font = { name: FONT, bold: true, color: { argb: argb({ ok: C.ok, warn: C.warn, bad: C.bad, na: C.muted }[s]) } }; c.fill = fill({ ok: C.okBg, warn: C.warnBg, bad: C.badBg, na: C.group }[s]); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = border; };
  const title = (ws, text, cols) => {
    ws.mergeCells(1, 1, 1, cols); const t = ws.getCell(1, 1); t.value = text; t.font = { name: FONT, size: 15, bold: true, color: { argb: argb(C.ink) } };
    ws.mergeCells(2, 1, 2, cols); const s = ws.getCell(2, 1); s.value = `${M.nome} · emitido em ${M.data} · GabiãoCAD ${APP_VERSION}`; s.font = { name: FONT, size: 10, color: { argb: argb(C.muted) } };
    ws.getRow(1).height = 24;
  };
  const groupRow = (ws, r, text, cols) => { ws.mergeCells(r, 1, r, cols); const c = ws.getCell(r, 1); c.value = text; c.font = { name: FONT, bold: true, color: { argb: argb(C.ink) } }; c.fill = fill(C.group); c.border = border; };
  const page = ws => { ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } }; ws.headerFooter.oddFooter = `&L${M.nome.replace(/&/g, '&&')}&RPágina &P de &N`; };

  // Resumo
  let ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 }];
  title(ws, 'Resumo do projeto', 5);
  ws.mergeCells(4, 1, 4, 5); const sc = ws.getCell(4, 1);
  sc.value = `${M.status.title} — ${M.status.text}`; sc.font = { name: FONT, bold: true, size: 12, color: { argb: argb({ ok: C.ok, warn: C.warn, bad: C.bad }[M.status.s]) } };
  sc.fill = fill({ ok: C.okBg, warn: C.warnBg, bad: C.badBg }[M.status.s]); sc.alignment = { vertical: 'middle', wrapText: true }; ws.getRow(4).height = 30;
  let r = 6;
  M.kpis.forEach(k => { ws.getCell(r, 1).value = k[0]; ws.getCell(r, 1).font = { name: FONT, color: { argb: argb(C.muted) } }; ws.getCell(r, 2).value = k[1]; ws.getCell(r, 2).font = { name: FONT, bold: true, size: 12 }; ws.getCell(r, 2).alignment = { horizontal: 'right' }; r++; });
  r++;
  const h1 = ['Verificação', ...(M.hasSeco ? ['Seco'] : []), M.hasSeco ? 'Pior caso' : 'Obtido', 'Exigido', 'Situação'];
  ws.getRow(r).values = h1; styleHead(ws.getRow(r)); r++;
  M.checks.forEach((c, i) => { const row = ws.getRow(r); row.values = [c.item, ...(M.hasSeco ? [c.seco ?? ''] : []), c.pior, c.exig]; styleBody(row, i % 2); for (let k = 2; k < h1.length; k++) row.getCell(k).alignment = { horizontal: 'right' }; statusCell(row.getCell(h1.length), c.s); r++; });
  if (M.govNome) { ws.getCell(r, 1).value = `Pior caso adotado: ${M.govNome.toLowerCase()}.`; ws.getCell(r, 1).font = { name: FONT, italic: true, color: { argb: argb(C.muted) } }; }
  page(ws);

  // Quantitativos e orçamento
  ws = wb.addWorksheet('Quantitativos e orçamento', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  ws.columns = [{ width: 50 }, { width: 9 }, { width: 14 }, { width: 18 }, { width: 18 }];
  title(ws, 'Quantitativos e orçamento', 5);
  ws.getRow(4).values = ['Item', 'Unid.', 'Quantidade', 'Preço unitário (R$)', 'Total (R$)']; styleHead(ws.getRow(4));
  r = 5; const priced = [];
  M.gq.forEach(g => {
    groupRow(ws, r, g.t, 5); r++;
    g.rows.forEach((it, i) => {
      const row = ws.getRow(r); row.values = [it.item, it.u, +it.v.toFixed(it.d)]; styleBody(row, false);
      row.getCell(3).numFmt = it.d ? '#,##0.0' : '#,##0'; row.getCell(2).alignment = { horizontal: 'center' };
      if (it.price) {
        const p = row.getCell(4); p.fill = fill('#FFF4CC'); p.numFmt = '"R$" #,##0.00'; p.border = border; p.protection = { locked: false };
        const t = row.getCell(5); t.value = { formula: `IF(ISNUMBER(D${r}),C${r}*D${r},0)`, result: 0 }; t.numFmt = '"R$" #,##0.00'; t.border = border; t.font = { name: FONT, bold: true };
        priced.push(r);
      } else {
        row.getCell(1).font = { name: FONT, italic: true, color: { argb: argb(C.muted) } }; row.getCell(3).font = { name: FONT, color: { argb: argb(C.muted) } };
        row.getCell(4).value = 'informativo'; row.getCell(4).font = { name: FONT, italic: true, size: 9, color: { argb: argb(C.muted) } }; row.getCell(4).alignment = { horizontal: 'center' };
      }
      r++;
    });
  });
  const tr = ws.getRow(r); tr.values = ['TOTAL ESTIMADO', '', '', '', { formula: priced.length ? priced.map(k => `E${k}`).join('+') : '0', result: 0 }];
  tr.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; c.fill = fill(C.accent); c.border = border; });
  tr.getCell(5).numFmt = '"R$" #,##0.00'; tr.height = 22;
  r += 2;
  ['Como usar: preencha as células amarelas com os preços unitários da sua região (caixa, m³ de pedra, m² de geotêxtil, m³ de escavação, viagem de caminhão).',
   'Os totais são calculados sozinhos. Itens "informativo" não entram no total para não contar duas vezes (ex.: peso da pedra).',
   'Quantidades estimadas pela geometria do projeto; confirme em campo antes de comprar.'].forEach(t => { ws.mergeCells(r, 1, r, 5); const c = ws.getCell(r, 1); c.value = t; c.font = { name: FONT, size: 9.5, color: { argb: argb(C.muted) } }; c.alignment = { wrapText: true }; ws.getRow(r).height = 26; r++; });
  page(ws);

  // Estabilidade
  ws = wb.addWorksheet('Estabilidade', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 36 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }];
  title(ws, 'Verificações de estabilidade', 8);
  r = 4;
  const block = (t, head, rows, statusIdx) => {
    groupRow(ws, r, t, head.length); r++;
    ws.getRow(r).values = head; styleHead(ws.getRow(r)); r++;
    rows.forEach((vals, i) => { const row = ws.getRow(r); const s = statusIdx !== undefined ? vals[statusIdx] : null; row.values = statusIdx !== undefined ? vals.slice(0, statusIdx) : vals; styleBody(row, i % 2); for (let k = 2; k <= head.length; k++) row.getCell(k).alignment = { horizontal: 'right' }; if (s) statusCell(row.getCell(statusIdx + 1), s); r++; });
    r++;
  };
  block('Resultado', h1, M.checks.map(c => [c.item, ...(M.hasSeco ? [c.seco ?? ''] : []), c.pior, c.exig, c.s]), h1.length - 1);
  if (M.casesRows.length > 1) block('Casos com água', ['Caso', 'Água frente (m)', 'Água atrás (m)', 'FS desl.', 'FS tomb.', 'Excentr. (m)', 'Tensão máx. (' + UL('press') + ')', 'Situação'], M.casesRows.map(x => [x.nome, x.frente, x.atras, x.FSd, x.FSt, x.e, x.smax, x.s]), 7);
  if (M.intRows.length) block('Verificação interna', ['Seção', 'Altura acima (m)', 'Base (m)', 'FS desl.', 'FS tomb.', 'Tensão máx.', 'Resist. gabião', 'Situação'], M.intRows.map(x => [x.sec, x.H, x.B, x.FSd, x.FSt, x.smax, x.lim, x.s]), 7);
  block('Esforços no pior caso', ['Grandeza', 'Valor'], M.forces);
  page(ws);

  // Dados de entrada
  ws = wb.addWorksheet('Dados de entrada', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 10 }];
  title(ws, 'Dados de entrada', 3);
  r = 4; ws.getRow(r).values = ['Parâmetro', 'Valor', 'Unid.']; styleHead(ws.getRow(r)); r++;
  M.entrada.forEach(g => { groupRow(ws, r, g.t, 3); r++; g.rows.forEach((x, i) => { const row = ws.getRow(r); row.values = x; styleBody(row, i % 2); row.getCell(2).alignment = { horizontal: 'right' }; if (typeof x[1] === 'number') row.getCell(2).numFmt = '0.###'; r++; }); });
  page(ws);

  // Camadas
  ws = wb.addWorksheet('Camadas', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 10 }, { width: 13 }, { width: 12 }, { width: 34 }, { width: 14 }];
  title(ws, 'Camadas (do topo para a base)', 5);
  r = 4; ws.getRow(r).values = ['Camada', 'Largura (m)', 'Altura (m)', 'Disposição das caixas', 'Volume (m³)']; styleHead(ws.getRow(r)); r++;
  M.camadas.forEach((c, i) => { const row = ws.getRow(r); row.values = [c.c, c.b, c.h, c.disp, +c.vol.toFixed(2)]; styleBody(row, i % 2); row.getCell(2).numFmt = '0.0'; row.getCell(3).numFmt = '0.0'; row.getCell(5).numFmt = '#,##0.0'; r++; });
  const tv = ws.getRow(r); tv.values = ['Total', '', '', '', { formula: `SUM(E5:E${r - 1})`, result: M.camadas.reduce((a, c) => a + c.vol, 0) }]; tv.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, bold: true }; c.border = border; c.fill = fill(C.group); }); tv.getCell(5).numFmt = '#,##0.0';
  page(ws);

  const buf = await wb.xlsx.writeBuffer();
  await saveFile(slug() + '-quantitativos.xlsx', new Blob([buf]));
}

$('#btnExport').onclick = e => { const p = $('#exportMenu'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', !p.hidden); };
document.addEventListener('click', e => { if (!e.target.closest('.menu')) { $('#exportMenu').hidden = true; $('#btnExport').setAttribute('aria-expanded', 'false'); } });
$('#exportMenu').addEventListener('click', async e => {
  const b = e.target.closest('[data-exp]'); if (!b) return; $('#exportMenu').hidden = true;
  if (!RES) { toast('Corrija os dados antes de exportar.'); return; }
  const k = b.dataset.exp;
  try {
    if (k === 'pdf') { toast('Montando o relatório…'); await exportPdf(); }
    else if (k === 'xlsx') await exportXlsx();
    else if (k === 'cortePng') { const r = await svgToPng(svgCorte(st, RES, LIGHT), 2); await saveFile(slug() + '-corte.png', r.blob); }
    else if (k === 'vistaPng') { const r = await svgToPng(svgVista(st, RES, LIGHT), 2); await saveFile(slug() + '-vista.png', r.blob); }
    else if (k === 'corteSvg') await saveFile(slug() + '-corte.svg', svgCorte(st, RES, LIGHT));
    else if (k === 'json') await saveFile(slug() + '.json', JSON.stringify({ app: 'GabiaoCAD', versao: 1, projeto: st }, null, 2));
  } catch (err) { toast('Falha na exportação: ' + err.message); }
});
$('#btnOpen').onclick = () => $('#fileOpen').click();
$('#fileOpen').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const j = JSON.parse(rd.result); st = sanitize(merge(DEFAULTS, j.projeto || j)); fillInputs(); update(); toast('Projeto aberto: ' + st.nome); }
    catch (err) { toast('Arquivo inválido. Escolha um .json salvo pelo GabiãoCAD.'); }
    e.target.value = '';
  };
  rd.readAsText(f);
};

/* ---------- análise de foto do local (Claude) ---------- */
const AI = { files: [], ctl: null, last: null, backend: null, maxCount: 4 };

/* backend do navegador: capability "sample" do claude.ai */
AI.web = {
  async ready() {
    if (!window.claude) return { ok: false, why: 'Abra o GabiãoCAD pelo claude.ai para usar a análise de fotos.' };
    const s = await window.claude.use('sample');
    if (!s) return { ok: false, why: 'A análise de fotos não está disponível nesta visualização.' };
    const lim = await s.limits().catch(() => null);
    if (!lim || !lim.images) return { ok: false, why: 'Esta visualização não permite enviar fotos ao Claude.' };
    AI.sample = s; AI.maxCount = Math.min(4, lim.images.maxCount || 4);
    return { ok: true };
  },
  async ask(prompt, files, signal) {
    return AI.sample.json(prompt, { images: files, signal, cache: false });
  },
  errText(e) {
    const c = e && e.code;
    return ({
      not_granted: 'Você não autorizou o uso do Claude nesta página.',
      sampling_disabled: 'O Claude não está disponível para esta conta.',
      rate_limited: 'Muitas análises seguidas ou limite de uso atingido. Tente de novo daqui a pouco.',
      image_rejected: 'Uma das fotos não pôde ser lida. Tente outra foto (JPG ou PNG).',
      refused: 'O Claude não analisou essas fotos. Tente fotos que mostrem só o local da obra.',
      invalid_json: 'A resposta veio incompleta. Clique em Analisar de novo.',
      session_expired: 'Sua sessão expirou. Entre de novo no claude.ai.',
      cancelled: 'Análise interrompida.',
    })[c] || 'Não foi possível analisar agora. Tente de novo.';
  },
};

function aiPrompt() {
  const H = st.layers.reduce((s, l) => s + l.h, 0);
  const nomes = g => PRESETS[g].map(p => p.n).join(' | ');
  return `Você é um engenheiro geotécnico brasileiro experiente em muros de gabião (caixas de tela de aço com pedra de mão, padrão 2,0 × 1,0 × 1,0 m e 2,0 × 1,0 × 0,5 m; colchão de gabião de 0,17/0,23/0,30 m).
As fotos são de um local onde o usuário quer fazer um muro de gabião. Analise as fotos e sugira como fazer o gabião ali.

Informações do usuário: ${(($('#aiNotes').value || '').trim() || 'nenhuma')}
Projeto atual no programa (só como referência): altura ${H} m, comprimento ${st.L} m, situação ${st.exc.scenario}, leito de rio ${st.river.on ? 'sim' : 'não'}.

Regras:
- Estime dimensões pelas referências visíveis (pessoas, portas, carros, degraus, vegetação) e diga quando a estimativa é incerta.
- Seja prático, em português simples, para quem executa a obra. Sem enrolação.
- Se as fotos não mostrarem um local de obra/terreno, diga isso no resumo e deixe as listas vazias.
- Sugira camadas de baixo para cima com altura 0,5 ou 1,0 m e base em torno de 0,5 a 0,7 da altura total em terreno seco e 0,8 a 1,0 com água no aterro ou rio. Depois da sua sugestão o programa ajusta automaticamente as larguras para passar em todas as verificações. Camadas em fila têm largura em metros inteiros (1,0; 2,0; 3,0...), porque cada caixa tem 1,0 m de largura. Camadas em contraforte podem ter 1,5 m e somas de caixas de 1,5/2/3/4 m.
- Em "posicao_na_foto", indique na foto que melhor mostra o local onde ficaria a face do muro proposto: os pés no nível do chão da frente e o topo na altura do muro. Coordenadas de 0 a 1 (x da esquerda para a direita, y de cima para baixo). Use null se não der para indicar.
- Nunca dispense a verificação por engenheiro responsável.

Responda SOMENTE com um objeto JSON neste formato:
{
 "resumo": "2 a 4 frases sobre o que você vê e a solução indicada",
 "confianca": "baixa" | "media" | "alta",
 "situacao": "corte" | "aterro",
 "leito_rio": true | false,
 "agua_no_aterro": true | false,
 "altura_m": número (altura do muro necessária),
 "comprimento_m": número ou null,
 "inclinacao_graus": número de 0 a 10,
 "degraus": "externa" | "interna",
 "camadas": [{"b": largura_m, "h": altura_m, "contraforte": true|false}, ...] da base para o topo,
 "solo_aterro": um destes nomes: ${nomes('aterro')} | null,
 "fundacao": um destes nomes: ${nomes('fundacao')} | null,
 "rio": {"nivel_normal_m": n, "nivel_cheia_m": n, "velocidade_ms": n, "erosao_m": n, "colchao_m": n} ou null,
 "como_fazer": ["passos da execução neste local"],
 "drenagem": ["medidas de drenagem"],
 "riscos": ["riscos e cuidados que você percebe nas fotos"],
 "conferir_no_local": ["o que medir ou verificar antes de executar"],
 "posicao_na_foto": {"foto": número da foto (1 = primeira), "pe_esquerdo": [x, y], "pe_direito": [x, y], "topo_direito": [x, y], "topo_esquerdo": [x, y]} ou null
}`;
}

function aiStatus(html) { $('#aiStatus').innerHTML = html; }
function aiRenderThumbs() {
  const box = $('#aiThumbs'); box.innerHTML = '';
  AI.files.forEach((f, i) => {
    const d = document.createElement('div'); d.className = 'thumb';
    const img = document.createElement('img'); img.alt = 'Foto ' + (i + 1); img.src = URL.createObjectURL(f); img.onload = () => URL.revokeObjectURL(img.src);
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Remover foto ' + (i + 1));
    x.onclick = () => { AI.files.splice(i, 1); aiRenderThumbs(); };
    d.append(img, x); box.append(d);
  });
  $('#aiGo').disabled = !AI.files.length || !AI.backend;
}
function aiAddFiles(list) {
  const ok = [...list].filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (ok.length < list.length) toast('Use fotos JPG, PNG ou WebP.');
  AI.files = [...AI.files, ...ok].slice(0, AI.maxCount);
  if (AI.files.length >= AI.maxCount && ok.length) aiStatus(`Máximo de ${AI.maxCount} fotos.`); else aiStatus('');
  aiRenderThumbs();
}

/* pontos da IA (0 a 1) -> [pé esq., pé dir., topo dir., topo esq.] na ordem certa, ou null */
function aiFotoPts(r) {
  const p = r && r.posicao_na_foto; if (!p || typeof p !== 'object') return null;
  const ok = v => Array.isArray(v) && v.length === 2 && v.every(n => Number.isFinite(+n) && +n >= -0.05 && +n <= 1.05);
  const k = ['pe_esquerdo', 'pe_direito', 'topo_direito', 'topo_esquerdo'];
  if (!k.every(n => ok(p[n]))) return null;
  let [bl, br, tr, tl] = k.map(n => p[n].map(v => Math.min(1, Math.max(0, +v))));
  if (bl[0] > br[0]) [bl, br, tl, tr] = [br, bl, tr, tl];          // esquerda/direita trocadas
  if (tl[1] > bl[1]) [bl, tl] = [tl, bl]; if (tr[1] > br[1]) [br, tr] = [tr, br];   // topo abaixo do pé
  const i = Math.round(+p.foto) - 1, idx = i >= 0 && i < AI.files.length ? i : 0;
  return { idx, pts: [bl, br, tr, tl] };
}
function aiRenderResult(r) {
  const L = a => (Array.isArray(a) && a.length ? '<ul>' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="help">—</p>');
  const conf = { baixa: 'warn', media: 'cf', alta: 'ok' }[r.confianca] || 'warn';
  const facts = [];
  if (Number.isFinite(+r.altura_m)) facts.push(`Altura <b>${fmt(+r.altura_m, 1)} m</b>`);
  if (Number.isFinite(+r.comprimento_m) && r.comprimento_m) facts.push(`Comprimento <b>${fmt(+r.comprimento_m, 0)} m</b>`);
  if (r.situacao) facts.push(`Situação <b>${esc(r.situacao)}</b>`);
  if (Array.isArray(r.camadas) && r.camadas.length) facts.push(`Camadas <b>${r.camadas.map(c => fmt(+c.b, 1)).join(' / ')} m</b>`);
  if (r.solo_aterro) facts.push(`Aterro <b>${esc(r.solo_aterro)}</b>`);
  if (r.fundacao) facts.push(`Fundação <b>${esc(r.fundacao)}</b>`);
  if (r.leito_rio) facts.push('<b>Leito de rio</b>');
  if (r.agua_no_aterro) facts.push('<b>Água no aterro</b>');
  const box = $('#aiResult');
  box.innerHTML = `<div class="aires-top"><p class="aires-sum">${esc(r.resumo || '')}</p>
      <span class="pill ${conf}">confiança ${({ baixa: 'baixa', media: 'média', alta: 'alta' })[r.confianca] || 'baixa'}</span></div>
    <div class="aifacts">${facts.map(f => `<span class="aifact">${f}</span>`).join('')}</div>
    <div class="aicols">
      <div class="aibox"><h4>Como fazer</h4>${L(r.como_fazer)}</div>
      <div class="aibox"><h4>Drenagem</h4>${L(r.drenagem)}</div>
      <div class="aibox"><h4>Riscos e cuidados</h4>${L(r.riscos)}</div>
      <div class="aibox"><h4>Conferir no local</h4>${L(r.conferir_no_local)}</div>
    </div>
    <div class="row-btns"><button class="btn primary" type="button" id="aiApply">Aplicar sugestão ao projeto</button><button class="btn" type="button" id="aiFoto">Ver o muro na foto</button>
      <span class="help">Estimativa feita a partir de fotos. Meça no local e confira o cálculo antes de executar.</span></div>`;
  box.hidden = false;
  const canApply = (Array.isArray(r.camadas) && r.camadas.length) || Number.isFinite(+r.altura_m);
  $('#aiApply').hidden = !canApply;
  $('#aiApply').onclick = () => aiApply(r);
  const fp = aiFotoPts(r), f = AI.files[fp ? fp.idx : 0];
  if (fp && f) FOTO.aiPts.set(f, fp.pts);
  $('#aiFoto').hidden = !f;
  $('#aiFoto').onclick = () => {
    FOTO.pending = { file: f, pts: fp && fp.pts };
    $('.tab[data-view="foto"]').click();
    $('.board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

function aiApply(r) {
  const s = clone(st), num = (v, d) => (Number.isFinite(+v) ? +v : d);
  if (r.situacao === 'corte' || r.situacao === 'aterro') s.exc.scenario = r.situacao;
  if (r.degraus === 'externa' || r.degraus === 'interna') s.faceMode = r.degraus;
  s.batter = Math.round(num(r.inclinacao_graus, s.batter));
  if (Number.isFinite(+r.comprimento_m) && +r.comprimento_m > 0) s.L = +r.comprimento_m;
  const roundTo = (v, step) => Math.max(1, Math.round(v / step + 1e-9) * step);
  if (Array.isArray(r.camadas) && r.camadas.length) s.layers = r.camadas.map(c => {
    const cf = !!c.contraforte;
    return { b: roundTo(num(c.b, 1), cf ? 0.5 : s.boxW), h: +c.h === 0.5 ? 0.5 : 1, cf };
  });
  else if (Number.isFinite(+r.altura_m)) s.layers = autoLayers(Math.min(15, Math.max(0.5, +r.altura_m)), 1, s.boxW);
  st = s;
  const pre = (g, nome) => { const p = PRESETS[g].find(x => x.n === nome); if (p) p.apply(); };
  pre('aterro', r.solo_aterro); pre('fundacao', r.fundacao);
  st.water.on = !!r.agua_no_aterro;
  if (r.leito_rio && r.rio) {
    const v = r.rio; st.river.on = true;
    st.river.hn = num(v.nivel_normal_m, st.river.hn); st.river.hc = Math.max(st.river.hn, num(v.nivel_cheia_m, st.river.hc));
    st.river.v = num(v.velocidade_ms, st.river.v); st.river.ds = num(v.erosao_m, st.river.ds);
    st.river.apron = true; st.river.lc = Math.max(num(v.colchao_m, 0), 1.5 * st.river.ds);
  } else st.river.on = !!r.leito_rio;
  st = sanitize(st); renderLayers(); fillInputs(); update();
  const fp = aiFotoPts(r); if (fp && AI.files[fp.idx]) FOTO.pending = { file: AI.files[fp.idx], pts: fp.pts };
  if (!$('#banner').classList.contains('ok')) { toast('A sugestão não passava em tudo. Ajustando com caixas inteiras…'); runOptimize('foto'); }
  else toast('Sugestão aplicada. Todas as verificações OK.');
  document.querySelector('.status').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function aiGo() {
  if (!AI.files.length || !AI.backend) return;
  AI.ctl = new AbortController();
  $('#aiGo').disabled = true; $('#aiStop').hidden = false;
  aiStatus('<span class="spinner"></span>Analisando as fotos… pode levar até 1 minuto.');
  try {
    const r = await AI.backend.ask(aiPrompt(), AI.files, AI.ctl.signal);
    if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
    AI.last = r; aiRenderResult(r); aiStatus('');
  } catch (e) {
    aiStatus(esc(AI.backend.errText(e)));
  } finally {
    $('#aiGo').disabled = !AI.files.length; $('#aiStop').hidden = true; AI.ctl = null;
  }
}

async function aiInit(backend) {
  AI.backend = null;
  const r = await backend.ready().catch(() => ({ ok: false, why: 'A análise de fotos não está disponível.' }));
  if (r.ok) { AI.backend = backend; $('#aiUnavailable').hidden = true; }
  else if (r.needKey) { $('#aiKeyBox').hidden = false; }
  else { $('#aiUnavailable').hidden = false; $('#aiUnavailable').textContent = r.why; $('#aiBody').hidden = true; }
  aiRenderThumbs();
}
$('#aiFiles').addEventListener('change', e => { aiAddFiles(e.target.files); e.target.value = ''; });
const dropEl = $('#aiDrop');
['dragenter', 'dragover'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.remove('over'); }));
dropEl.addEventListener('drop', e => aiAddFiles(e.dataTransfer.files));
document.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) aiAddFiles(fs); });
$('#aiGo').onclick = aiGo;
$('#aiStop').onclick = () => AI.ctl && AI.ctl.abort();
if (!window.desktop && !window.GABIAO_WEB) aiInit(AI.web);

/* ---------- ajuste automático (interface) ---------- */
const OPT = { running: false, ctl: null, undo: null };
function optSummary(s) {
  const R = fullCalc(s), q = R.q;
  return {
    camadas: s.layers.map(l => fmt(l.b, l.b % 1 ? 1 : 0) + (l.h === 0.5 ? '×½' : '')).join(' / '),
    H: s.layers.reduce((a, l) => a + l.h, 0), batter: s.batter, D: s.D, boxLen: s.boxLen,
    vol: q.vol, caixas: q.nCaixas, sob: q.tipos.filter(t => !t.catalogo).reduce((a, t) => a + t.qtd, 0),
    FSd: R.ext.FSd, FSt: R.ext.FSt, FSg: R.glob ? R.glob.FS : NaN,
    ok: designChecks(s, true),
  };
}
function optRenderBar() {
  const bar = $('#optBar'), ok = $('#banner').classList.contains('ok');
  if (OPT.running) return;
  bar.innerHTML = ok
    ? `<button class="btn" type="button" id="optGo">Deixar mais econômico</button><span class="help">Procura a solução com menos pedra, só com caixas inteiras, mantendo tudo OK.</span>`
    : `<button class="btn primary" type="button" id="optGo">Ajustar para passar</button><span class="help">O programa procura sozinho a solução mais econômica, só com caixas inteiras, que passe em todas as verificações.</span>`;
  $('#optGo').onclick = () => runOptimize('botao');
}
async function runOptimize(origem) {
  if (OPT.running) return;
  if (st.soil.beta >= st.soil.phi) { toast('Corrija primeiro a inclinação do terreno β (precisa ser menor que φ).'); return; }
  OPT.running = true; OPT.ctl = new AbortController();
  const bar = $('#optBar');
  bar.innerHTML = `<span class="spinner"></span><span id="optProg">Procurando a solução mais econômica com caixas inteiras… 0%</span><button class="btn" type="button" id="optStop">Parar</button>`;
  $('#optStop').onclick = () => OPT.ctl.abort();
  const before = clone(st), sb = optSummary(before);
  let r;
  try { r = await optimizeDesign(clone(st), f => { const el = $('#optProg'); if (el) el.textContent = `Procurando a solução mais econômica com caixas inteiras… ${Math.round(f * 100)}%`; }, OPT.ctl.signal); }
  catch (e) { r = { ok: false, error: String(e.message || e) }; }
  OPT.running = false;
  const box = $('#optResult');
  if (r.aborted) { optRenderBar(); toast('Busca interrompida.'); return; }
  if (r.ok) {
    OPT.undo = before;
    st = sanitize(r.s); renderLayers(); fillInputs(); update();
    const sa = optSummary(st);
    const notes = [];
    if (sa.batter !== sb.batter) notes.push(`Inclinação do muro de ${fmt(sb.batter, 0)}° para ${fmt(sa.batter, 0)}° (o muro deita para trás e fica mais estável).`);
    if (sa.D !== sb.D) notes.push(`Base ${fmt(sa.D - sb.D, 1)} m mais funda: ${fmt(sa.H - sb.H, 0)} camada(s) a mais enterrada(s) embaixo. A altura que o muro segura continua a mesma.`);
    if (sa.boxLen !== sb.boxLen) notes.push(`Caixas de ${fmt(sa.boxLen, 1)} m de comprimento, que fecham os ${fmt(st.L, 1)} m do muro sem cortar nenhuma.`);
    else if (sa.sob > 0) notes.push(`O comprimento de ${fmt(st.L, 1)} m não fecha com caixas inteiras: ${sa.sob} peça(s) sob medida. Para usar só caixas inteiras, use um comprimento múltiplo de ${fmt(st.boxLen, 1)} m.`);
    if (r.drained) notes.push(`<b>Só passa com drenagem:</b> o nível d'água atrás do muro foi considerado a 1/3 da altura. Faça dreno de pé (tubo perfurado com brita), geotêxtil no tardoz e canaleta no topo.`);
    if (origem === 'foto') notes.unshift('A sugestão da foto não passava em todas as verificações. Este é o ajuste mais econômico que passa.');
    const row = (k, a, b, f) => `<tr><td>${k}</td><td class="n muted">${f ? f(a) : a}</td><td class="n"><b>${f ? f(b) : b}</b></td></tr>`;
    const f2 = v => fmt(v, 2), m3 = v => fmt(v, 1) + ' m³';
    box.innerHTML = `<div class="opthead"><h3>Solução ajustada <span class="pill ok">todas as verificações OK</span></h3>
        <div class="row-btns"><button class="btn" type="button" id="optUndo">Desfazer</button><button class="btn" type="button" id="optClose">Fechar</button></div></div>
      <div class="tbl"><table><thead><tr><th></th><th class="n">Antes</th><th class="n">Depois</th></tr></thead><tbody>
        ${row('Camadas (base → topo, m)', sb.camadas, sa.camadas)}
        ${row('Altura total', sb.H, sa.H, v => fmt(v, 1) + ' m')}
        ${row('Inclinação', sb.batter, sa.batter, v => fmt(v, 0) + '°')}
        ${row('Embutimento', sb.D, sa.D, v => fmt(v, 2) + ' m')}
        ${row('Volume de gabião', sb.vol, sa.vol, m3)}
        ${row('Caixas', sb.caixas, sa.caixas)}
        ${row('FS deslizamento (pior caso)', sb.FSd, sa.FSd, f2)}
        ${row('FS tombamento (pior caso)', sb.FSt, sa.FSt, f2)}
        ${row('FS estabilidade global', sb.FSg, sa.FSg, f2)}
        ${row('Verificações', sb.ok.ok ? 'todas OK' : 'não passa em ' + sb.ok.fails.length + (sb.ok.fails.length > 1 ? ' itens' : ' item'), 'todas OK')}
      </tbody></table></div>
      ${notes.length ? '<ul class="optnotes">' + notes.map(n => `<li>${n}</li>`).join('') + '</ul>' : ''}`;
    box.hidden = false;
    $('#optUndo').onclick = () => { st = OPT.undo; OPT.undo = null; renderLayers(); fillInputs(); update(); box.hidden = true; toast('Ajuste desfeito.'); };
    $('#optClose').onclick = () => { box.hidden = true; };
    toast('Solução encontrada e aplicada.');
  } else {
    const fails = (r.closest && r.closest.fails) || [];
    const tips = [];
    if (fails.includes('tensão no solo')) tips.push(`<b>O solo da fundação não aguenta o peso.</b> Ele aguenta ${uf(st.found.sadm, 'press', 1)} e o muro mais leve que passa no resto precisa de pelo menos ${r.minSigma ? uf(r.minSigma, 'press', 1) : 'mais'}. Troque o solo da base por rachão ou brita compactada (60 a 100 cm), faça uma base de concreto magro, ou confirme a tensão admissível com sondagem.`);
    if (fails.includes('estabilidade global')) tips.push('<b>O terreno em volta rompe mesmo com o muro mais largo.</b> Melhore o solo da fundação, rebaixe o nível d\'água com drenagem profunda, diminua a inclinação do terreno (retaludar) ou divida em dois muros escalonados com recuo. Vale consultar um engenheiro geotécnico.');
    if (fails.includes('erosão no pé')) tips.push('<b>Erosão no pé:</b> aumente a largura do colchão de gabião para pelo menos 1,5 × a erosão prevista.');
    if (fails.some(f => ['deslizamento', 'tombamento', 'excentricidade', 'seções internas'].includes(f))) tips.push(`<b>${fails.filter(f => ['deslizamento', 'tombamento', 'excentricidade', 'seções internas'].includes(f)).join(', ')}</b> não fecham nem com base de 8 m. Reduza a água atrás do muro (drenagem), a sobrecarga ou a altura, ou use solo de aterro melhor (areia ou saibro compactado).`);
    if (r.error) tips.push('Erro na busca: ' + esc(r.error));
    box.innerHTML = `<div class="opthead"><h3>Sem solução só com caixas de gabião <span class="pill bad">${esc(fails.join(', ') || 'verificar')}</span></h3>
      <div class="row-btns"><button class="btn" type="button" id="optClose">Fechar</button></div></div>
      <p class="help">Testei todas as larguras com caixas inteiras (até 8 m de base), inclinações de até 10° e a base até 2 m mais funda. O problema não se resolve só mudando o muro:</p>
      <ul class="optnotes">${tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
    box.hidden = false;
    $('#optClose').onclick = () => { box.hidden = true; };
  }
  optRenderBar();
}

st = sanitize(st);
fillInputs(); update();
