// Foto realista do muro: confere o plano, conta o uso do mês e chama a IA de imagem do Google (Gemini)
import { admin, cors, json, usuario } from '../_shared/http.ts';
import { aspectoMaisProximo, infoPlano, promptRealista } from '../_shared/logic.ts';

const MODELOS = (Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-image,gemini-2.5-flash-image').split(',').map(s => s.trim()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  const user = await usuario(req);
  if (!user) return json({ erro: 'login', mensagem: 'Entre na sua conta para gerar a imagem.' }, 401);
  if (!Deno.env.get('GEMINI_API_KEY')) return json({ erro: 'indisponivel', mensagem: 'A foto realista ainda não foi ativada no servidor.' }, 503);

  let body: { foto?: string; guia?: string; descricao?: string; largura?: number; altura?: number };
  try { body = await req.json(); } catch { return json({ erro: 'pedido' }, 400); }
  const ok = (s?: string) => typeof s === 'string' && s.length > 1000 && s.length < 8_000_000 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 200));
  if (!ok(body.foto) || !ok(body.guia)) return json({ erro: 'pedido', mensagem: 'Imagens inválidas.' }, 400);
  const descricao = String(body.descricao || '').slice(0, 600);

  const db = admin();
  const { data: perfil } = await db.from('profiles').select('plano, premium_ate, uso_seg').eq('id', user.id).single();
  const P = infoPlano(perfil);
  if (P.estado === 'expirado') return json({ erro: 'teste_fim', mensagem: 'Seu teste grátis terminou. Assine para gerar fotos realistas.' }, 403);
  const { data: usados, error: e1 } = await db.rpc('consumir_imagem', { p_user: user.id, p_limite: P.imagens });
  if (e1) return json({ erro: 'servidor' }, 500);
  if (usados === -1) return json({ erro: 'limite', mensagem: P.premium ? 'Você chegou ao limite de imagens realistas deste mês.' : `O teste grátis tem ${P.imagens} imagens realistas. Assine para gerar mais.` }, 429);

  const pedido = {
    contents: [{ parts: [
      { text: promptRealista(descricao) },
      { inlineData: { mimeType: 'image/jpeg', data: body.foto } },
      { inlineData: { mimeType: 'image/jpeg', data: body.guia } },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspectoMaisProximo(body.largura || 4, body.altura || 3) } },
  };
  const base = Deno.env.get('GEMINI_API') ?? 'https://generativelanguage.googleapis.com';
  let ultimoErro = '';
  for (const modelo of MODELOS) {
    try {
      const r = await fetch(`${base}/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! }, body: JSON.stringify(pedido),
      });
      const out = await r.json().catch(() => ({}));
      if (r.status === 404) { ultimoErro = `modelo ${modelo} indisponível`; continue; }        // tenta o próximo modelo
      if (!r.ok) throw new Error(out?.error?.message || String(r.status));
      const partes = (out.candidates || []).flatMap((c: { content?: { parts?: unknown[] } }) => c.content?.parts || []);
      const img = partes.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data) as { inlineData: { data: string; mimeType?: string } } | undefined;
      if (!img) throw new Error('a IA não devolveu imagem');
      return json({ imagem: img.inlineData.data, mime: img.inlineData.mimeType || 'image/png', usados, limite: P.imagens, modelo });
    } catch (e) { ultimoErro = String((e as Error).message || e); break; }
  }
  await db.rpc('devolver_imagem', { p_user: user.id });   // não cobra imagem que falhou
  console.error('gemini', ultimoErro);
  return json({ erro: 'ia', mensagem: 'O serviço de imagem está indisponível agora. Tente de novo em alguns minutos.' }, 502);
});
