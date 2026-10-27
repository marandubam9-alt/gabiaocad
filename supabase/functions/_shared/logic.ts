// Regras do GabiãoCAD que não dependem do Supabase (testáveis isoladamente)

export const PRECOS = {
  mensal: { valor: 39.9, meses: 1, nome: 'GabiãoCAD Premium mensal', plano: 'premium' },
  anual: { valor: 349, meses: 12, nome: 'GabiãoCAD Premium anual', plano: 'premium' },
  estudante: { valor: 9.9, meses: 1, nome: 'GabiãoCAD Premium estudante', plano: 'estudante' },
} as const;
export type Opcao = keyof typeof PRECOS;

export const TESTE_SEG = 3 * 3600; // 3 horas de uso; igual a limite_teste_seg() na migração

export const LIMITES = {
  teste: { analises: 5, imagens: 2, modelo: 'claude-haiku-5-5' },      // durante o teste grátis
  expirado: { analises: 0, imagens: 0, modelo: 'claude-haiku-5-5' },   // teste acabou e não assinou
  premium: { analises: 150, imagens: 60, modelo: 'claude-sonnet-5-5' }, // "sem limite" com uso justo
};

export interface Perfil { plano: string; premium_ate: string | null; uso_seg?: number | null }
export type Estado = 'premium' | 'teste' | 'expirado';

export function infoPlano(p: Perfil | null, agora = new Date()) {
  const premium = !!p && p.plano !== 'gratis' && (!p.premium_ate || new Date(p.premium_ate) > agora);
  const uso = Math.max(0, p?.uso_seg ?? 0);
  const emTeste = !premium && !!p && uso < TESTE_SEG;
  const estado: Estado = premium ? 'premium' : emTeste ? 'teste' : 'expirado';
  const L = LIMITES[estado];
  return { premium, estado, restanteSeg: emTeste ? TESTE_SEG - uso : 0, plano: premium ? p!.plano : 'gratis', limite: L.analises, imagens: L.imagens, modelo: L.modelo, premium_ate: p?.premium_ate ?? null };
}

export function emailEstudante(email: string) {
  return /@([a-z0-9-]+\.)*(edu\.br|edu)$/i.test(email.trim());
}

export function corpoAssinatura(opcao: Opcao, userId: string, email: string, siteUrl: string) {
  const P = PRECOS[opcao];
  return {
    reason: P.nome,
    external_reference: `${userId}|${opcao}`,
    payer_email: email,
    auto_recurring: { frequency: P.meses, frequency_type: 'months', transaction_amount: P.valor, currency_id: 'BRL' },
    back_url: `${siteUrl.replace(/\/$/, '')}/app/?assinatura=retorno`,
    status: 'pending',
  };
}

export function lerReferencia(ref: string | null | undefined) {
  const [userId, opcao] = String(ref || '').split('|');
  if (!/^[0-9a-f-]{36}$/i.test(userId || '') || !(opcao in PRECOS)) return null;
  return { userId, opcao: opcao as Opcao };
}

// Estado da assinatura no Mercado Pago -> o que gravar no perfil
export function atualizacaoPerfil(pre: { id: string; status: string; external_reference?: string; next_payment_date?: string; auto_recurring?: { frequency?: number } }, agora = new Date()) {
  const ref = lerReferencia(pre.external_reference);
  if (!ref) return null;
  const base = { mp_preapproval_id: pre.id, mp_status: pre.status, atualizado_em: agora.toISOString() } as Record<string, unknown>;
  if (pre.status === 'authorized') {
    const prox = pre.next_payment_date ? new Date(pre.next_payment_date) : new Date(agora.getTime() + (PRECOS[ref.opcao].meses * 31) * 864e5);
    base.plano = PRECOS[ref.opcao].plano;
    base.premium_ate = new Date(prox.getTime() + 5 * 864e5).toISOString(); // 5 dias de tolerância
  }
  // cancelada/pausada: mantém o acesso até o fim do período já pago (premium_ate não muda)
  return { userId: ref.userId, campos: base };
}

// Assinatura do webhook: HMAC-SHA256 de "id:<data.id minúsculo>;request-id:<x-request-id>;ts:<ts>;"
export async function assinaturaValida(xSignature: string | null, xRequestId: string | null, dataId: string | null, segredo: string) {
  if (!xSignature) return false;
  const partes: Record<string, string> = {};
  for (const p of xSignature.split(',')) { const [k, v] = p.trim().split('='); if (k && v) partes[k] = v; }
  if (!partes.ts || !partes.v1) return false;
  let manifesto = '';
  if (dataId) manifesto += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto)));
  const hex = [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== partes.v1.length) return false;
  let dif = 0; for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  return dif === 0;
}

// Pedido para a IA de imagem: foto original + simulação 3D como guia -> foto realista
export const ASPECTOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
export function aspectoMaisProximo(w: number, h: number) {
  const r = w / h; let best = '4:3', d = Infinity;
  for (const a of ASPECTOS) { const [x, y] = a.split(':').map(Number); const e = Math.abs(Math.log(r / (x / y))); if (e < d) { d = e; best = a; } }
  return best;
}
export function promptRealista(descricao: string) {
  return `You are editing a real construction-site photo for a civil engineering proposal.
IMAGE 1 is the original photo of the site, exactly as it is today.
IMAGE 2 is a rough 3D mock-up of a gabion retaining wall placed in that same photo, showing where the wall will be built and its shape.
Create a single photorealistic photograph of the SAME scene (same camera position, framing, lens, lighting, weather, vegetation and surroundings) with the gabion wall finished and built exactly where and as shown in IMAGE 2: same position in the frame, same length, same height, same number of tiers and the same steps/setbacks.
Gabion details: boxes of galvanized hexagonal double-twist steel wire mesh (8x10 cm openings, thick selvedge wires on the edges, slightly bulging faces), tightly filled with angular grey quarry stones of 10 to 25 cm, small dark gaps between stones, box joints visible every few meters, natural dirt and a little soil at the base, realistic contact shadow on the ground, light matching the photo.
Wall data: ${descricao}.
Keep everything else in the photo unchanged. Do not add text, labels, measurements, watermarks, people, machines or vehicles. Output only the edited photo.`;
}
