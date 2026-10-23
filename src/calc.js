/* ===== GabiãoCAD — núcleo de cálculo (sem DOM) ===== */
const D2R = Math.PI / 180;
const CATALOGO_COMP = [1, 1.5, 2, 3, 4];

function gammaG(st) { return st.gab.gs * (1 - st.gab.n); }
function propsGabiao(st) {
  const gg = gammaG(st), gt = gg / 9.81;
  return { gg, phiStar: 25 * gt - 10, tauAdm: (50 * gt - 30) * 9.81 };
}

function rects(st) {
  const B0 = st.layers[0].b; let y = 0;
  return st.layers.map(l => {
    const r = st.faceMode === 'externa' ? { x0: B0 - l.b, x1: B0 } : { x0: 0, x1: l.b };
    r.y0 = y; r.y1 = y + l.h; y += l.h; r.b = l.b; r.h = l.h; return r;
  });
}
function rot(st, x, y) {
  const a = st.batter * D2R;
  return { x: x * Math.cos(a) + y * Math.sin(a), y: -x * Math.sin(a) + y * Math.cos(a) };
}
function unrot(st, X, Y) {
  const a = st.batter * D2R;
  return { x: X * Math.cos(a) - Y * Math.sin(a), y: X * Math.sin(a) + Y * Math.cos(a) };
}

function coulombKa(phi, delta, beta, alphaB) {
  const p = phi * D2R, d = delta * D2R, b = beta * D2R, a = alphaB * D2R;
  const s1 = Math.sin(p + d) * Math.sin(p - b), s2 = Math.sin(a - d) * Math.sin(a + b);
  if (s1 < 0 || s2 <= 0) return NaN;
  return Math.sin(a + p) ** 2 / (Math.sin(a) ** 2 * Math.sin(a - d) * (1 + Math.sqrt(s1 / s2)) ** 2);
}

/* Análise do trecho do muro acima da junta j (j=0: base / fundação).
   wet=true: chuva — aterro saturado e nível d'água atrás do muro (st.water). */
const GW = 9.81;
const ADESAO = 2 / 3;   // fração da coesão da fundação usada como adesão no deslizamento da base
/* cond: null = seco; { Yw, Yf, gsat } = água atrás (Yw) e na frente (Yf), em m a partir da base */
function analyze(st, j, cond) {
  if (cond === undefined) cond = defaultCond(st);
  const wet = !!cond;
  const isBase = j === 0;
  const R = rects(st), sub = R.slice(j), { gg, phiStar, tauAdm } = propsGabiao(st);
  const rj = sub[0], rt = sub[sub.length - 1];
  const s = st.soil;
  const g1 = wet ? Math.max(cond.gsat, s.gamma) : s.gamma;     // peso do solo (úmido/saturado)
  const Yf = wet && Number.isFinite(cond.Yf) ? cond.Yf : -Infinity;
  const gBuoy = GW * (1 - st.gab.n);                          // empuxo de Arquimedes na pedra
  let W = 0, Mx = 0, My = 0, Wg = 0, Ws = 0;
  sub.forEach(r => {
    const NB = 40, dy = (r.y1 - r.y0) / NB;
    for (let k = 0; k < NB; k++) {
      const yl = r.y0 + (k + 0.5) * dy, c = rot(st, (r.x0 + r.x1) / 2, yl);
      const w = (r.x1 - r.x0) * dy * (c.y < Yf ? gg - gBuoy : gg);
      W += w; Wg += w; Mx += w * c.x; My += w * c.y;
    }
  });
  // solo sobre os degraus, entre o tardoz real e o plano virtual
  const hx = rj.x1, hy = rj.y0, tx = rt.x1, ty = rt.y1;
  const lineX = y => hx + (tx - hx) * (y - hy) / (ty - hy);
  sub.forEach(r => {
    const N = 80, dy = (r.y1 - r.y0) / N;
    for (let k = 0; k < N; k++) {
      const y = r.y0 + (k + 0.5) * dy, w = lineX(y) - r.x1;
      if (w > 1e-9) {
        const ws = w * dy * g1, c = rot(st, r.x1 + w / 2, y);
        W += ws; Ws += ws; Mx += ws * c.x; My += ws * c.y;
      }
    }
  });
  const cg = { x: Mx / W, y: My / W };
  const toe = rot(st, rj.x0, rj.y0), heel = rot(st, hx, hy), top = rot(st, tx, ty);
  const dX = top.x - heel.x, dY = top.y - heel.y;
  const omega = Math.atan2(dX, dY) / D2R, Hp = dY, alphaB = 90 + omega, om = omega * D2R;
  const Ka = coulombKa(s.phi, s.delta, s.beta, alphaB);
  const qf = s.q * Math.sin(alphaB * D2R) / Math.sin((alphaB + s.beta) * D2R);
  // integração ao longo do plano de empuxo (do topo ao calcanhar)
  const Yw = wet ? Math.min(cond.Yw, top.y) : -Infinity;
  const gsub = g1 - GW;
  const sv = y => (y >= Yw ? g1 * (top.y - y) : g1 * Math.max(0, top.y - Yw) + gsub * (Yw - y));
  const NS = 240, dz = Hp / NS;
  let Es = 0, Eq = 0, mE = 0, Uw = 0, mU = 0;
  for (let k = 0; k < NS; k++) {
    const f = 1 - (k + 0.5) / NS, y = heel.y + f * dY;
    const dEs = Ka * sv(y) * dz, dEq = Ka * qf * dz;
    Es += dEs; Eq += dEq; mE += (dEs + dEq) * f;
    const u = wet ? Math.max(0, GW * Math.max(0, Yw - y) - GW * Math.max(0, Yf - y)) : 0;
    Uw += u * dz; mU += u * dz * f;
  }
  const Ea = Es + Eq, fr = Ea > 0 ? mE / Ea : 1 / 3, fu = Uw > 0 ? mU / Uw : 0;
  const P = { x: heel.x + fr * dX, y: heel.y + fr * dY };
  const PU = { x: heel.x + fu * dX, y: heel.y + fu * dY };
  const th = (s.delta - omega) * D2R, Eh = Ea * Math.cos(th), Ev = Ea * Math.sin(th);
  // água no tardoz: normal ao plano (sem atrito)
  const UwH = Uw, UwV = Uw * Math.tan(om);              // UwV para cima quando o muro inclina para o aterro
  const a = st.batter * D2R, B = rj.x1 - rj.x0;
  // subpressão na base/junta: linear, do calcanhar (nível d'água) à ponta (sem água à frente)
  // diferença de pressão entre o tardoz e a frente (a parte igual dos dois lados já está no empuxo de Arquimedes)
  const uh = wet ? Math.max(0, GW * Math.max(0, Yw - heel.y) - GW * Math.max(0, Yf - heel.y)) : 0, ut = 0;
  const U = (uh + ut) / 2 * B, xu = U > 0 ? B * (ut + 2 * uh) / (3 * (ut + uh)) : 0;
  const PUb = { x: toe.x + xu * Math.cos(a), y: toe.y - xu * Math.sin(a) };
  // forças sobre o muro (x para o aterro, y para cima) e momentos em torno da ponta (anti-horário = tombar)
  const F = [
    { fx: 0, fy: -W, p: cg },
    { fx: -Eh, fy: -Ev, p: P },
    { fx: -UwH, fy: UwV, p: PU },
    { fx: U * Math.sin(a), fy: U * Math.cos(a), p: PUb },
  ];
  let Fx = 0, Fy = 0, Mr = 0, Mo = 0;
  F.forEach(f => {
    Fx += f.fx; Fy += f.fy;
    // componentes vertical e horizontal classificadas separadamente
    [(f.p.x - toe.x) * f.fy, -(f.p.y - toe.y) * f.fx].forEach(m => { if (m > 0) Mo += m; else Mr -= m; });
  });
  const phib = isBase ? st.found.phi : phiStar, cb = isBase ? ADESAO * st.found.c : 0;
  const drv = -(Fx * Math.cos(a) - Fy * Math.sin(a)), Np = -(Fx * Math.sin(a) + Fy * Math.cos(a));
  const N = W + Ev, T = Eh;
  const resist = Math.max(0, Np) * Math.tan(phib * D2R) + cb * B;
  const FSd = drv > 0 ? resist / drv : Infinity;
  const FSt = Mo > 0 ? Mr / Mo : Infinity;
  const sPos = Np > 0 ? (Mr - Mo) / Np : -1, e = B / 2 - sPos;
  let smax, smin;
  if (sPos <= 0 || sPos >= B) { smax = Infinity; smin = 0; }
  else if (Math.abs(e) <= B / 6) { smax = Np / B * (1 + 6 * Math.abs(e) / B); smin = Np / B * (1 - 6 * Math.abs(e) / B); }
  else { const sp = e > 0 ? sPos : B - sPos; smax = 2 * Np / (3 * sp); smin = 0; }
  const sLim = isBase ? st.found.sadm : tauAdm;
  return { j, isBase, wet, cond, Yf, H: rt.y1 - rj.y0, B, W, Wg, Ws, cg, toe, heel, top, omega, Hp, Ka, Es, Eq, Ea, Eh, Ev, P,
    Uw, PU, U, PUb, Yw, Mr, Mo, N, Np, T, drv, resist, phib, FSd, FSt, sPos, e, smax, smin, sLim, base: { a } };
}

function defaultCond(st) {
  return st.water && st.water.on ? { Yw: st.water.hw, Yf: -Infinity, gsat: st.water.gsat } : null;
}

/* Casos de cálculo: seco (referência) + chuva e/ou rio */
function buildCases(st) {
  const gsat = st.water && st.water.gsat > 0 ? st.water.gsat : 19.62;
  const out = [];
  const rv = st.river || {};
  if (rv.on) {
    const hr = Math.max(0, rv.hn), hc = Math.max(hr, rv.hc);
    const back = st.water.on ? Math.max(hr, st.water.hw) : hr;
    out.push({ id: 'normal', nome: 'Rio normal', desc: 'nível normal na frente e no aterro', cond: { Yf: hr, Yw: back, gsat } });
    out.push({ id: 'cheia', nome: 'Cheia', desc: 'água no nível de cheia dos dois lados', cond: { Yf: hc, Yw: Math.max(hc, back), gsat } });
    out.push({ id: 'rebaix', nome: 'Rebaixamento rápido', desc: 'o rio baixa e o aterro continua cheio d\'água', cond: { Yf: hr, Yw: Math.max(hc, back), gsat } });
  } else if (st.water && st.water.on) {
    out.push({ id: 'chuva', nome: 'Com chuva', desc: 'aterro encharcado', cond: { Yf: -Infinity, Yw: st.water.hw, gsat } });
  }
  return out;
}

/* Socavação (erosão no pé do muro) */
const COLCHAO_COMP = [3, 4, 5, 6];
function scourCheck(st) {
  const rv = st.river || {};
  if (!rv.on) return null;
  const ds = Math.max(0, rv.ds), Lc = rv.apron ? Math.max(0, rv.lc) : 0;
  const Lreq = 1.5 * ds;
  let ok, txt;
  if (rv.apron) { ok = Lc >= Lreq - 1e-6; txt = ok ? `Colchão de ${Lc} m cobre a erosão prevista (mínimo 1,5 × ${ds} = ${Lreq.toFixed(2)} m).` : `Colchão curto: use pelo menos ${Lreq.toFixed(2)} m (1,5 × a erosão prevista).`; }
  else { ok = st.D >= ds - 1e-6; txt = ok ? `Embutimento de ${st.D} m é maior que a erosão prevista de ${ds} m.` : `A erosão de ${ds} m passa da base do muro (embutimento ${st.D} m). Use colchão de gabião ou aprofunde a base.`; }
  // velocidade -> espessura indicada
  const v = Math.max(0, rv.v);
  const espRec = v <= 3 ? 0.17 : v <= 4 ? 0.23 : v <= 5 ? 0.30 : 0.5;
  let qtd = null;
  if (rv.apron && Lc > 0) {
    let comp = COLCHAO_COMP.find(k => k >= Lc - 1e-6), nComp = 1;
    if (!comp) { nComp = Math.ceil(Lc / 6); comp = COLCHAO_COMP.find(k => k >= Lc / nComp - 1e-6) || 6; }
    const n = Math.ceil(st.L / 2 - 1e-9) * nComp;
    qtd = { comp, larg: 2, esp: rv.esp, n, area: Lc * st.L, vol: Lc * st.L * rv.esp };
  }
  return { ds, Lc, Lreq, ok, txt, v, espRec, espOk: !rv.apron || rv.esp >= espRec - 1e-6 || espRec >= 0.5 && rv.esp >= 0.5, qtd };
}

/* Divisão de um comprimento em peças (com desencontro opcional) */
function segments(L, bl, offset) {
  const segs = []; let x = 0;
  if (offset > 1e-6 && offset < L) { segs.push({ x0: 0, len: offset }); x = offset; }
  while (L - x > 1e-6) { const len = Math.min(bl, L - x); segs.push({ x0: x, len }); x += len; }
  return segs;
}
function layerOffset(st, i) { return st.stagger && !st.layers[i].cf && i % 2 === 1 ? st.boxLen / 2 : 0; }

/* Divide a largura da camada em caixas de catálogo (contraforte) */
function splitWidth(b, pref) {
  // menor número de caixas de catálogo cuja soma dá a largura (passo de 0,5 m)
  const n = Math.round(b * 2), cat = CATALOGO_COMP.map(k => Math.round(k * 2));
  if (Math.abs(n / 2 - b) < 1e-6) {
    const best = [[]];
    for (let v = 1; v <= n; v++) {
      let pick = null;
      for (const k of cat) if (k <= v && best[v - k]) {
        const cand = [...best[v - k], k];
        if (!pick || cand.length < pick.length || (cand.length === pick.length && cand.includes(pref * 2) && !pick.includes(pref * 2))) pick = cand;
      }
      best[v] = pick;
    }
    if (best[n]) return best[n].sort((a, z) => z - a).map(k => k / 2);
  }
  const out = []; let rest = b;
  while (rest > 1e-6) { const k = [4, 3, 2, 1.5, 1].find(k => k <= rest + 1e-6) || rest; out.push(Math.round(k * 100) / 100); rest -= k; }
  return out;
}

/* Lista de caixas de uma camada, em coordenadas locais.
   s0/len: posição e extensão ao longo do muro; t0/tw: posição e largura na seção;
   comp × larg × h: dimensões da caixa como pedidas ao fornecedor. */
function layerBoxes(st, i) {
  const l = st.layers[i], r = rects(st)[i], boxes = [];
  if (l.cf) {
    const pieces = splitWidth(l.b, st.boxLen);
    segments(st.L, st.boxW, 0).forEach(sg => {
      let t = r.x0;
      pieces.forEach(p => { boxes.push({ s0: sg.x0, len: sg.len, t0: t, tw: p, comp: p, larg: sg.len, h: l.h, cf: true }); t += p; });
    });
  } else {
    const nT = Math.max(1, Math.round(l.b / st.boxW)), tw = l.b / nT;
    segments(st.L, st.boxLen, layerOffset(st, i)).forEach(sg => {
      for (let k = 0; k < nT; k++) boxes.push({ s0: sg.x0, len: sg.len, t0: r.x0 + k * tw, tw, comp: sg.len, larg: tw, h: l.h, cf: false });
    });
  }
  return boxes;
}

function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}

function geometryGlobal(st) {
  const R = rects(st);
  const corners = [];
  R.forEach(r => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].forEach(p => corners.push(rot(st, p[0], p[1]))));
  const toe = rot(st, R[0].x0, 0), heel = rot(st, R[0].x1, 0);
  const rt = R[R.length - 1];
  const topBack = rot(st, rt.x1, rt.y1), topFront = rot(st, rt.x0, rt.y1);
  const xmin = Math.min(...corners.map(p => p.x));
  // contorno do tardoz (local -> global), da base ao topo
  const back = [];
  R.forEach((r, i) => { back.push(rot(st, r.x1, r.y0)); back.push(rot(st, r.x1, r.y1)); });
  // contorno da face
  const front = [];
  R.forEach(r => { front.push(rot(st, r.x0, r.y0)); front.push(rot(st, r.x0, r.y1)); });
  return { R, corners, toe, heel, topBack, topFront, xmin, back, front };
}

function excavationPoly(st, g) {
  const a = st.batter * D2R, f = st.exc.folga, m = st.exc.m, D = st.D;
  const u = { x: Math.cos(a), y: -Math.sin(a) };
  const P1 = { x: g.toe.x - f * u.x, y: g.toe.y - f * u.y };
  const P2 = { x: g.heel.x + f * u.x, y: g.heel.y + f * u.y };
  const A = { x: P1.x - m * Math.max(0, D - P1.y), y: D };
  if (st.exc.scenario === 'corte') {
    const Ht = g.topBack.y;
    return [A, P1, P2, { x: P2.x + m * (Ht - P2.y), y: Ht }, { x: Math.min(g.xmin, P1.x), y: Ht }, { x: Math.min(g.xmin, P1.x), y: D }];
  }
  return [A, P1, P2, { x: P2.x + m * Math.max(0, D - P2.y), y: D }];
}

function inWall(st, R, X, Y) {
  const p = unrot(st, X, Y);
  for (const r of R) if (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1) return true;
  return false;
}

function quantities(st) {
  const g = geometryGlobal(st), { gg } = propsGabiao(st), L = st.L, bl = st.boxLen, bw = st.boxW;
  const tipos = {}; let vol = 0, nCaixas = 0;
  st.layers.forEach((l, i) => {
    layerBoxes(st, i).forEach(bx => {
      const cp = Math.round(bx.comp * 100) / 100, lg = Math.round(bx.larg * 100) / 100;
      const key = cp + '|' + lg + '|' + l.h + '|' + bx.cf;
      if (!tipos[key]) tipos[key] = { c: cp, l: lg, h: l.h, cf: bx.cf, qtd: 0,
        catalogo: CATALOGO_COMP.some(k => Math.abs(k - cp) < 0.01) && Math.abs(lg - 1) < 0.01 };
      tipos[key].qtd++; nCaixas++;
    });
    vol += l.b * l.h * L;
  });
  const listaTipos = Object.values(tipos).sort((a, b) => (a.cf - b.cf) || b.h - a.h || b.c - a.c);
  // geotêxtil
  let contorno = 0;
  st.layers.forEach((l, i) => { contorno += l.h; if (i < st.layers.length - 1) contorno += Math.abs(l.b - st.layers[i + 1].b) * (st.faceMode === 'interna' ? 1 : 0); });
  const fo = 1 + st.geo.overlap / 100;
  const geoTardoz = (contorno + 0.5) * L * fo;
  const geoBase = st.geo.base ? st.layers[0].b * L * fo : 0;
  // escavação e reaterro por amostragem da seção
  const poly = excavationPoly(st, g);
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const n = 320, dx = Math.max(x1 - x0, y1 - y0) / n, dA = dx * dx;
  let aExc = 0, aRe = 0;
  for (let Y = y0 + dx / 2; Y < y1; Y += dx) {
    const row = [];
    let frontX = Infinity;
    for (let X = x0 + dx / 2; X < x1; X += dx) {
      const w = inWall(st, g.R, X, Y);
      if (w && X < frontX) frontX = X;
      row.push([X, w]);
    }
    if (frontX === Infinity) frontX = -Infinity;
    for (const [X, w] of row) {
      if (!pointInPoly(X, Y, poly)) continue;
      aExc += dA;
      if (!w && !(Y > st.D && X < frontX)) aRe += dA;
    }
  }
  return {
    tipos: listaTipos, nCaixas, vol, pedraM3: vol, pedraT: vol * gg / 9.81,
    contorno, geoTardoz, geoBase, geoTotal: geoTardoz + geoBase,
    escav: aExc * L, reaterro: aRe * L, reaterroT: aRe * L * st.soil.gamma / 9.81, aExc, aRe, poly, fill: fillBehind(st, g),
    altura: st.layers.reduce((s, l) => s + l.h, 0),
  };
}

function autoLayers(H, h, bw) {
  const n = Math.max(1, Math.round(H / h));
  const Ht = n * h;
  const base = Math.max(bw, Math.ceil((0.6 * Ht) / bw) * bw);
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = n === 1 ? base : base - i * (base - bw) / (n - 1);
    out.push({ b: Math.max(bw, Math.round(v / bw) * bw), h });
  }
  return out;
}


/* Aterro do vazio atrás do muro (cenário "aterro"): região entre o tardoz,
   o terreno natural (cota D) e o barranco/limite do aterro, até a superfície final. */
function fillBehind(st, g) {
  const f = st.exc.fill || {};
  if (st.exc.scenario !== 'aterro' || !f.on) return null;
  const D = st.D, tb = g.topBack, tanB = Math.tan(st.soil.beta * D2R), m = Math.max(0, f.m), a = Math.max(0, f.a);
  if (D >= tb.y - 1e-6) return null;
  // tardoz na cota D
  let xBackD = null;
  for (let i = 0; i < g.back.length - 1; i++) {
    const p = g.back[i], q = g.back[i + 1];
    if ((p.y - D) * (q.y - D) <= 0 && Math.abs(q.y - p.y) > 1e-9) { xBackD = p.x + (q.x - p.x) * (D - p.y) / (q.y - p.y); break; }
  }
  if (xBackD === null) xBackD = g.back[0].x;
  const xb0 = xBackD + a;
  // encontro do barranco com a superfície final
  let Ytop, xbT;
  const den = 1 - m * tanB;
  if (den > 1e-6) { Ytop = (tb.y + (xb0 - m * D - tb.x) * tanB) / den; Ytop = Math.max(Ytop, tb.y); }
  else Ytop = tb.y + 3;
  xbT = xb0 + m * (Ytop - D);
  const backDown = g.back.filter(p => p.y > D + 1e-9 && p.y < tb.y - 1e-9).reverse();
  const poly = [{ x: xBackD, y: D }, { x: xb0, y: D }, { x: xbT, y: Ytop }];
  if (Ytop > tb.y + 1e-9 || xbT > tb.x + 1e-9) poly.push(tb);
  poly.push(...backDown);
  let A = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) A += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  A = Math.abs(A) / 2;
  const V = A * st.L, emp = f.emp > 0 ? f.emp : 1;
  return { poly, area: A, vol: V, solto: V * emp, peso: V * st.soil.gamma / 9.81, xBackD, xb0, xbT, Ytop };
}


/* ===== Estabilidade global: Bishop simplificado, superfícies circulares =====
   O círculo passa por baixo do muro (não corta as caixas), entra no terreno atrás
   e sai na frente. Muro, aterro e fundação deslizam juntos. */
function globalStability(st, cond) {
  const g = geometryGlobal(st), R = g.R, { gg } = propsGabiao(st), s = st.soil, f = st.found;
  const a = st.batter * D2R, tanB = Math.tan(s.beta * D2R);
  const H = R[R.length - 1].y1, toe = g.toe, heel = g.heel, tb = g.topBack;
  const wet = !!cond, gsat = wet ? Math.max(cond.gsat, s.gamma) : s.gamma;
  const Yw = wet ? cond.Yw : -Infinity;
  const Yf = wet ? (Number.isFinite(cond.Yf) ? cond.Yf : Math.min(cond.Yw, 0)) : -Infinity;
  const piezo = x => (!wet ? -Infinity : x >= heel.x ? Yw : x <= toe.x ? Yf : Yf + (Yw - Yf) * (x - toe.x) / (heel.x - toe.x));
  const baseY = x => toe.y + (x - toe.x) * (heel.y - toe.y) / (heel.x - toe.x);   // linha da base (estendida)
  // frente do muro na cota do terreno D
  let fD = toe.x;
  R.forEach(r => { const A = rot(st, r.x0, r.y0), B = rot(st, r.x0, r.y1); if (st.D >= A.y && st.D <= B.y) fD = A.x + (B.x - A.x) * (st.D - A.y) / (B.y - A.y); });
  // malha de colunas: peso acumulado de baixo para cima em cada x
  const span = Math.max(H, 2);
  const xA = toe.x - 3.5 * span, xB = tb.x + 3.5 * span, dx = Math.max(0.05, (xB - xA) / 400);
  const yA = Math.min(-2.2 * span - 2, baseY(heel.x) - 2), dy = 0.05;
  const nx = Math.ceil((xB - xA) / dx) + 1;
  const wallXmin = Math.min(...g.corners.map(p => p.x)), wallXmax = Math.max(...g.corners.map(p => p.x));
  const ground = new Float64Array(nx), cols = [];
  for (let i = 0; i < nx; i++) {
    const x = xA + i * dx;
    let gy;
    if (x >= tb.x) gy = tb.y + (x - tb.x) * tanB;
    else if (x < fD) gy = st.D;
    else {
      gy = st.D;
      if (x >= wallXmin && x <= wallXmax) for (let y = H + 0.5; y > -2; y -= 0.01) if (inWall(st, R, x, y)) { gy = Math.max(gy, y); break; }
      if (x > heel.x) gy = Math.max(gy, tb.y);   // aterro atrás do muro
    }
    ground[i] = gy;
    const n = Math.max(1, Math.ceil((gy - yA) / dy)), cum = new Float64Array(n + 1);
    for (let k = n - 1; k >= 0; k--) {
      const y = yA + (k + 0.5) * dy; let gam;
      const below = y < piezo(x);
      if (inWall(st, R, x, y)) gam = gg + (below ? GW * st.gab.n : 0);
      else gam = below ? gsat : s.gamma;
      cum[k] = cum[k + 1] + gam * dy;   // peso da coluna acima da cota k
    }
    cols.push(cum);
  }
  const at = x => Math.min(nx - 1, Math.max(0, Math.round((x - xA) / dx)));
  const colW = (i, y) => { const c = cols[i], k = Math.max(0, Math.min(c.length - 1, Math.floor((y - yA) / dy))); return c[k]; };
  const tanFf = Math.tan(f.phi * D2R), tanFs = Math.tan(s.phi * D2R);
  const qx = x => (x >= tb.x ? s.q : 0);

  function fsCircle(xc, yc, Rr) {
    const ybot = yc - Rr;
    if (ybot > baseY(toe.x) - 0.02) return null;
    // limites: onde o arco encontra o terreno
    const i0 = at(xc);
    const arcY = x => { const d = Rr * Rr - (x - xc) * (x - xc); return d < 0 ? NaN : yc - Math.sqrt(d); };
    let iL = i0, iR = i0;
    if (!(arcY(xA + i0 * dx) < ground[i0])) return null;
    while (iL > 0) { const x = xA + (iL - 1) * dx, y = arcY(x); if (!(y < ground[iL - 1])) break; iL--; }
    while (iR < nx - 1) { const x = xA + (iR + 1) * dx, y = arcY(x); if (!(y < ground[iR + 1])) break; iR++; }
    if (iL === 0 || iR === nx - 1) return null;
    const xL = xA + iL * dx, xR = xA + iR * dx;
    if (xL > toe.x - 0.05 || xR < heel.x + 0.05) return null;          // precisa envolver o muro
    let num0 = [], drive = 0, ok = true;
    for (let i = iL; i <= iR; i++) {
      const x = xA + i * dx, yb = arcY(x);
      if (x >= toe.x - 1e-9 && x <= heel.x + 1e-9 && yb > baseY(x) - 0.01) { ok = false; break; }
      if (x >= wallXmin && x <= wallXmax && inWall(st, R, x, yb)) { ok = false; break; }
      const sinA = (x - xc) / Rr, cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
      const W = (colW(i, yb) + qx(x)) * dx;
      const isFound = x < toe.x || yb <= baseY(x) || yb < 0;
      const c = isFound ? f.c : 0, tf = isFound ? tanFf : tanFs;
      const u = Math.max(0, GW * (piezo(x) - yb));
      const bl = dx / Math.max(cosA, 0.2);
      drive += W * sinA;
      num0.push({ c, tf, W, u, cosA, sinA, bl });
    }
    if (!ok || drive <= 1e-6) return null;
    let FS = 1.5;
    for (let it = 0; it < 30; it++) {
      let res = 0;
      for (const sl of num0) {
        const m = sl.cosA + sl.sinA * sl.tf / FS;
        if (m < 0.2) return null;
        res += (sl.c * dx + Math.max(0, sl.W - sl.u * dx) * sl.tf) / m;
      }
      const nf = res / drive;
      if (Math.abs(nf - FS) < 1e-4) { FS = nf; break; }
      FS = nf;
    }
    return { FS, xc, yc, R: Rr, xL, xR, yL: arcY(xL), yR: arcY(xR) };
  }

  let best = null;
  const tryC = (xc, yc, yb) => { const r = fsCircle(xc, yc, yc - yb); if (r && (!best || r.FS < best.FS)) best = r; };
  const topY = Math.max(...g.corners.map(p => p.y), tb.y);
  const ybMax = baseY(toe.x) - 0.05, ybMin = Math.max(yA + 0.5, -1.8 * span - 1);
  for (let ix = 0; ix <= 14; ix++) for (let iy = 0; iy <= 10; iy++) for (let iz = 0; iz <= 8; iz++) {
    tryC(toe.x - span + ix * (tb.x - toe.x + 2.5 * span) / 14, topY + 0.3 + iy * 2.2 * span / 10, ybMax - iz * (ybMax - ybMin) / 8);
  }
  if (!best) return null;
  // refinamento em volta do melhor círculo
  let step = [span / 7, span / 4.5, (ybMax - ybMin) / 8];
  for (let pass = 0; pass < 4; pass++) {
    const b0 = best;
    for (let ix = -2; ix <= 2; ix++) for (let iy = -2; iy <= 2; iy++) for (let iz = -2; iz <= 2; iz++)
      tryC(b0.xc + ix * step[0] / 2, Math.max(topY + 0.1, b0.yc + iy * step[1] / 2), Math.min(ybMax, Math.max(ybMin, b0.yc - b0.R + iz * step[2] / 2)));
    step = step.map(v => v / 2.2);
  }
  return best;
}


/* ===== Ajuste automático: solução mais econômica com caixas inteiras ===== */
function designChecks(s, withGlobal) {
  const F = s.fs, fails = new Set();
  const conds = [null, ...buildCases(s).map(c => c.cond)];
  let util = 0;
  for (const cond of conds) {
    const r = analyze(s, 0, cond);
    if (!(r.FSd >= F.desl)) fails.add('deslizamento');
    if (!(r.FSt >= F.tomb)) fails.add('tombamento');
    if (!(Math.abs(r.e) <= r.B / 6 + 1e-9)) fails.add('excentricidade');
    if (!(r.smax <= s.found.sadm)) fails.add('tensão no solo');
    util = Math.max(util, F.desl / r.FSd, F.tomb / r.FSt, r.smax / s.found.sadm);
    for (let j = 1; j < s.layers.length; j++) {
      const ri = analyze(s, j, cond);
      if (!(ri.FSd >= F.desl && ri.FSt >= F.tomb && ri.smax <= ri.sLim)) fails.add('seções internas');
    }
  }
  const sc = scourCheck(s);
  if (sc && !sc.ok) fails.add('erosão no pé');
  if (withGlobal && s.fs.globOn !== false && !fails.size) {
    for (const cond of conds) {
      const g = globalStability(s, cond);
      if (!g || g.FS < (F.glob || 1.5)) { fails.add('estabilidade global'); break; }
    }
  }
  return { ok: !fails.size, fails: [...fails], util };
}

function wholeBoxProfiles(H, boxW) {
  const n1 = Math.floor(H + 1e-9), rem = +(H - n1).toFixed(2);
  const hs = Array(n1).fill(1); if (rem >= 0.5 - 1e-9) hs.push(0.5); if (!hs.length) hs.push(0.5);
  const n = hs.length, seen = new Set(), out = [];
  for (let B = 1; B <= 8; B++) for (let T = 1; T <= B; T++) {
    const ws = hs.map((h, i) => Math.max(boxW, Math.round((B - (B - T) * (n === 1 ? 0 : i / (n - 1))) / boxW) * boxW));
    for (let i = 1; i < n; i++) ws[i] = Math.min(ws[i], ws[i - 1]);
    const key = ws.join(','); if (seen.has(key)) continue; seen.add(key);
    out.push({ layers: ws.map((b, i) => ({ b, h: hs[i], cf: false })), vol: ws.reduce((a, b, i) => a + b * hs[i], 0) });
  }
  return out.sort((a, b) => a.vol - b.vol || b.layers[0].b - a.layers[0].b);
}

function bestBoxLen(L, cur) {
  const opts = [cur, 2, 3, 4, 1.5].filter((v, i, a) => a.indexOf(v) === i);
  const exact = opts.find(bl => Math.abs(L / bl - Math.round(L / bl)) < 1e-6);
  return exact || cur;
}

/* Etapas: inclinação (0, 6, 10°) × aprofundar a base (0, 1 ou 2 camadas a mais embaixo) */
function optimizerStages(s) {
  const out = [], seen = new Set();
  for (const dD of [0, 1, 2]) for (const bt of [s.batter, Math.max(s.batter, 6), Math.max(s.batter, 10)]) {
    const k = bt + '|' + dD; if (seen.has(k) || s.D + dD > 10) continue; seen.add(k);
    out.push({ batter: bt, dD });
  }
  return out;
}

async function optimizeDesign(s0, onProgress, signal) {
  const H0 = s0.layers.reduce((a, l) => a + l.h, 0);
  const base = optimizerStages(s0);
  const drainHw = (s0.water.on && !s0.river.on && s0.water.hw > H0 / 3 + 1e-6) ? +(H0 / 3).toFixed(2) : null;
  const tick = async (f) => { onProgress && onProgress(f); await new Promise(r => setTimeout(r, 0)); };
  let closest = null, minSigma = Infinity;
  const runStages = async (stages, drain, p0, p1) => {
    let best = null;
    for (let si = 0; si < stages.length; si++) {
      const stg = stages[si];
      const profiles = wholeBoxProfiles(H0 + stg.dD, s0.boxW);
      let globalTries = 0;
      for (let pi = 0; pi < profiles.length; pi++) {
        if (signal && signal.aborted) return { aborted: true };
        const p = profiles[pi], pen = 0.02 * (stg.batter - s0.batter);
        if (best && p.vol + pen >= best.cost) break;
        const s = JSON.parse(JSON.stringify(s0));
        s.layers = p.layers; s.batter = stg.batter; s.D = +(s0.D + stg.dD).toFixed(2);
        if (drain !== null) s.water.hw = +(drain + stg.dD).toFixed(2);
        else if (s.water.on) s.water.hw = +(s0.water.hw + stg.dD).toFixed(2);
        if (s.river.on) { s.river.hn = +(s0.river.hn + stg.dD).toFixed(2); s.river.hc = +(s0.river.hc + stg.dD).toFixed(2); if (s.river.apron) s.river.lc = Math.max(s.river.lc, Math.ceil(3 * s.river.ds) / 2); }
        const c = designChecks(s, false);
        if (pi % 6 === 0) await tick(p0 + (p1 - p0) * (si + pi / profiles.length) / stages.length);
        if (!c.ok) {
          if (c.fails.length === 1 && c.fails[0] === 'tensão no solo') {
            const conds = [null, ...buildCases(s).map(x => x.cond)];
            minSigma = Math.min(minSigma, Math.max(...conds.map(cd => analyze(s, 0, cd).smax)));
          }
          if (!closest || c.fails.length < closest.fails.length) closest = { fails: c.fails, s };
          continue;
        }
        if (globalTries++ >= 14) break;
        const g = designChecks(s, true);
        if (g.ok) { best = { s, cost: p.vol + pen, vol: p.vol, stage: stg }; break; }
        if (!closest || closest.fails.length >= 1) closest = { fails: g.fails, s };
      }
    }
    return best;
  };
  let best = await runStages(base, null, 0, drainHw !== null ? 0.7 : 1);
  if (best && best.aborted) return best;
  let drained = false;
  if (!best && drainHw !== null) { best = await runStages(base, drainHw, 0.7, 1); drained = !!best; }
  if (best && best.aborted) return best;
  if (best) {
    best.s.boxLen = bestBoxLen(best.s.L, best.s.boxLen);
    return { ok: true, s: best.s, stage: best.stage, drained, volM: best.vol };
  }
  return { ok: false, closest, minSigma: Number.isFinite(minSigma) ? minSigma : null };
}

function fullCalc(st) {
  const cases = buildCases(st);
  const req = st.fs;
  const util = r => Math.max(req.desl / r.FSd, req.tomb / r.FSt, Math.abs(r.e) / (r.B / 6), r.smax / r.sLim);
  cases.forEach(cs => { cs.res = analyze(st, 0, cs.cond); cs.util = util(cs.res); });
  const gov = cases.length ? cases.reduce((a, b) => (b.util > a.util ? b : a)) : null;
  const cond = gov ? gov.cond : null;
  const ext = gov ? gov.res : analyze(st, 0, null);
  const internas = [];
  for (let j = 1; j < st.layers.length; j++) internas.push(analyze(st, j, cond));
  const seco = gov ? analyze(st, 0, null) : null;
  const scour = scourCheck(st);
  const globOn = st.fs.globOn !== false;
  const glob = globOn ? globalStability(st, cond) : null;
  const globSeco = globOn && gov ? globalStability(st, null) : null;
  const q = quantities(st);
  return { ext, seco, cases, gov, internas, q, scour, glob, globSeco, props: propsGabiao(st), geo: geometryGlobal(st) };
}

if (typeof module !== 'undefined') module.exports = { optimizeDesign, designChecks, wholeBoxProfiles, globalStability, buildCases, scourCheck, layerBoxes, splitWidth, analyze, quantities, autoLayers, fullCalc, coulombKa, rects, ADESAO };
