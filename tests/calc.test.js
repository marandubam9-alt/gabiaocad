/* Validação do núcleo de cálculo contra contas feitas à mão.
   Rodar: node tests/calc.test.js   (ou npm test) */
const assert = require('node:assert/strict');
const C = require('../src/calc.js');

const D2R = Math.PI / 180;
let falhas = 0, total = 0;
function perto(nome, obtido, esperado, tol = 0.005) {
  total++;
  const erro = Math.abs(obtido - esperado) / Math.max(Math.abs(esperado), 1e-9);
  if (!Number.isFinite(obtido) || !(erro <= tol)) { falhas++; console.error(`✗ ${nome}: obtido ${obtido.toFixed(4)}, esperado ${esperado.toFixed(4)}`); }
}

// Muro de referência: 1 camada 2 × 3 m, sem inclinação, solo γ=18, φ=30°
const base = () => ({
  L: 10, boxLen: 2, boxW: 1, stagger: false, faceMode: 'externa', batter: 0, D: 0,
  layers: [{ b: 2, h: 3 }],
  soil: { gamma: 18, phi: 30, delta: 0, beta: 0, q: 0 },
  found: { phi: 30, c: 0, sadm: 200 },
  gab: { gs: 25.997, n: 0.30 },
  fs: { desl: 1.5, tomb: 2, glob: 1.5 },
  water: { on: false, gsat: 20, hw: 0 }, river: { on: false },
  exc: { folga: 0.3, m: 1, scenario: 'aterro' }, geo: { overlap: 10, base: true },
});
const phi = 30 * D2R, H = 3, B = 2;
const W = 25.997 * 0.7 * B * H;          // peso do gabião
const Ea = 0.5 * 18 * H * H / 3;          // Rankine, Ka = 1/3

// A — Rankine, parede vertical, δ = 0
{
  const r = C.analyze(base(), 0, null);
  perto('A Ka', r.Ka, 1 / 3);
  perto('A empuxo', r.Ea, Ea);
  perto('A peso', r.W, W);
  perto('A FS tombamento', r.FSt, (W * B / 2) / (Ea * H / 3));
  perto('A FS deslizamento', r.FSd, W * Math.tan(phi) / Ea);
  const e = B / 2 - (W * 1 - Ea * 1) / W;
  perto('A excentricidade', r.e, e);
  perto('A tensão máx.', r.smax, W / B * (1 + 6 * e / B));
}

// B — Coulomb, δ = 27°
{
  const s = base(); s.soil.delta = 27;
  const r = C.analyze(s, 0, null), d = 27 * D2R;
  const Ka = Math.cos(phi) ** 2 / (Math.cos(d) * (1 + Math.sqrt(Math.sin(phi + d) * Math.sin(phi) / Math.cos(d))) ** 2);
  const E = 0.5 * 18 * H * H * Ka, Eh = E * Math.cos(d), Ev = E * Math.sin(d);
  perto('B Ka', r.Ka, Ka);
  perto('B FS tombamento', r.FSt, (W * 1 + Ev * B) / (Eh * 1));
  perto('B FS deslizamento', r.FSd, (W + Ev) * Math.tan(phi) / Eh);
}

// C — sobrecarga de 10 kPa
{
  const s = base(); s.soil.q = 10;
  const r = C.analyze(s, 0, null), Eq = 10 * H / 3;
  perto('C FS tombamento', r.FSt, W / (Ea * 1 + Eq * 1.5));
  perto('C FS deslizamento', r.FSd, W * Math.tan(phi) / (Ea + Eq));
}

// D — aterro encharcado até o topo (γsat = 20), seco na frente
{
  const s = base(); s.water = { on: true, gsat: 20, hw: 3 };
  const r = C.analyze(s, 0, { Yw: 3, Yf: -Infinity, gsat: 20 });
  const Es = 0.5 * (20 - 9.81) * H * H / 3, Uw = 0.5 * 9.81 * H * H, U = 0.5 * 9.81 * H * B;
  perto('D empuxo submerso', r.Es, Es);
  perto('D água no tardoz', r.Uw, Uw);
  perto('D subpressão', r.U, U);
  perto('D FS tombamento', r.FSt, W * 1 / (Es * 1 + Uw * 1 + U * B * 2 / 3));
  perto('D FS deslizamento', r.FSd, (W - U) * Math.tan(phi) / (Es + Uw));
}

// E — talude atrás β = 15° (Coulomb, parede vertical, δ = 0)
{
  const s = base(); s.soil.beta = 15;
  const b = 15 * D2R;
  const Ka = Math.cos(phi) ** 2 / (1 + Math.sqrt(Math.sin(phi) * Math.sin(phi - b) / Math.cos(b))) ** 2;
  perto('E Ka', C.analyze(s, 0, null).Ka, Ka);
}

// F — coesão da fundação: só 2/3 entram como adesão no deslizamento
{
  const s = base(); s.found.c = 15;
  const r = C.analyze(s, 0, null);
  perto('F FS deslizamento com coesão', r.FSd, (W * Math.tan(phi) + (2 / 3) * 15 * B) / Ea);
}

// G — sanidade: inclinar o muro para o aterro não pode piorar
{
  const r0 = C.analyze(base(), 0, null), s = base(); s.batter = 6;
  const r6 = C.analyze(s, 0, null);
  total++; if (!(r6.FSt > r0.FSt && r6.FSd > r0.FSd)) { falhas++; console.error('✗ G inclinação piorou o muro'); }
}

// H — estabilidade global: encontra um círculo e o FS fica numa faixa plausível
{
  const s = base(); s.layers = [{ b: 3, h: 1 }, { b: 2, h: 1 }, { b: 1, h: 1 }]; s.D = 0.5;
  const g = C.globalStability(s, null);
  total++; if (!g || !(g.FS > 1.2 && g.FS < 4)) { falhas++; console.error('✗ H estabilidade global fora da faixa', g && g.FS); }
}

// I — muro na foto: câmera sintética -> 4 pontos -> recupera lente e posição
{
  const s = base(); s.layers = [{ b: 3, h: 1 }, { b: 2, h: 1 }, { b: 1, h: 1 }]; s.D = 0.5; s.batter = 6; s.L = 12;
  const { V3m: V } = C, w = 4000, h = 3000, f0 = 0.85 * w;
  // câmera de verdade: 9 m à frente, 3 m à direita, 1,7 m de altura, olhando para o meio do muro
  const C0 = [3, 1.7, 9], alvo = [0, 1.2, -1];
  const zc = V.un(V.sub(alvo, C0)), xc = V.un(V.cr(zc, [0, -1, 0])), yc = V.cr(zc, xc);
  const cam0 = { Rw: [xc, yc, zc], C: C0, f: f0, w, h };
  const a = C.fotoAnchor(s), pts = C.fotoCorners(a).map(P => C.projectPoint(cam0, P).slice(0, 2));
  const cam = C.cameraFromPoints(s, pts, w, h, 0);
  total++; if (!cam) { falhas++; console.error('✗ I câmera não encontrada'); }
  else {
    perto('I lente recuperada', cam.f, f0, 0.01);
    perto('I câmera x', cam.C[0], C0[0], 0.02); perto('I câmera y', cam.C[1], C0[1], 0.02); perto('I câmera z', cam.C[2], C0[2], 0.02);
    // ponto fora da face (canto de trás do topo): precisa cair no mesmo pixel
    const P = [s.L / 2, 3 * Math.cos(6 * Math.PI / 180) - 1 * Math.sin(6 * Math.PI / 180) * 0, -1.2];
    const q0 = C.projectPoint(cam0, P), q = C.projectPoint(cam, P);
    total++; if (!(Math.hypot(q[0] - q0[0], q[1] - q0[1]) < 2)) { falhas++; console.error('✗ I ponto 3D fora do lugar', q, q0); }
    total++; if (!(cam.erro < 1e-4)) { falhas++; console.error('✗ I erro de encaixe', cam.erro); }
    // projeto muda (muro mais alto): o pé continua no mesmo pixel
    const s2 = JSON.parse(JSON.stringify(s)); s2.layers.push({ b: 1, h: 1 });
    const c2 = C.cameraAt(cam, s2), pe = C.projectPoint(c2, C.fotoCorners(C.fotoAnchor(s2))[0]);
    total++; if (!(Math.hypot(pe[0] - pts[0][0], pe[1] - pts[0][1]) < 2)) { falhas++; console.error('✗ I pé saiu do lugar'); }
  }
  // foto de frente: lente não é medível, usa a típica e os cantos ainda encaixam
  const hp = 2000 * C.fotoAnchor(s).Hs / s.L, fr = [[1000, 2200], [3000, 2200], [3000, 2200 - hp], [1000, 2200 - hp]];
  const cf = C.cameraFromPoints(s, fr, w, h, 0);
  total++; if (!cf || cf.fMedida || !(cf.erro < 0.05)) { falhas++; console.error('✗ I foto de frente', cf && cf.erro); }
}

assert.equal(falhas, 0, `${falhas} de ${total} verificações do cálculo falharam`);
console.log(`cálculo: ${total} verificações OK`);
