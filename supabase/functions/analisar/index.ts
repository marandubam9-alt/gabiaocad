// Análise de foto do local: confere o plano, conta o uso do mês e chama a API da Anthropic
import { admin, cors, json, usuario } from '../_shared/http.ts';
import { infoPlano } from '../_shared/logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  const user = await usuario(req);
  if (!user) return json({ erro: 'login', mensagem: 'Entre na sua conta para analisar fotos.' }, 401);

  let body: { prompt?: string; images?: { media_type: string; data: string }[] };
  try { body = await req.json(); } catch { return json({ erro: 'pedido' }, 400); }
  const imgs = (body.images || []).slice(0, 4).filter(i => /^image\/(jpeg|png|webp)$/.test(i.media_type) && typeof i.data === 'string' && i.data.length < 7_000_000);
  if (!imgs.length || !body.prompt || body.prompt.length > 20000) return json({ erro: 'pedido', mensagem: 'Envie de 1 a 4 fotos.' }, 400);

  const db = admin();
  const { data: perfil } = await db.from('profiles').select('plano, premium_ate, teste_ate').eq('id', user.id).single();
  const P = infoPlano(perfil);
  if (P.estado === 'expirado') return json({ erro: 'teste_fim', mensagem: 'Seu teste grátis terminou. Assine para continuar analisando fotos.' }, 403);
  const { data: usados, error: e1 } = await db.rpc('consumir_analise', { p_user: user.id, p_limite: P.limite });
  if (e1) return json({ erro: 'servidor' }, 500);
  if (usados === -1) return json({ erro: 'limite', limite: P.limite, premium: P.premium, mensagem: P.premium ? 'Você chegou ao limite de uso justo deste mês.' : `O teste grátis tem ${P.limite} análises de foto.` }, 429);

  try {
    const r = await fetch((Deno.env.get('ANTHROPIC_API') ?? 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: P.modelo, max_tokens: 4096,
        messages: [{ role: 'user', content: [
          ...imgs.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } })),
          { type: 'text', text: body.prompt + '\n\nResponda apenas com o JSON, sem texto antes ou depois.' },
        ] }],
      }),
    });
    const out = await r.json();
    if (!r.ok) throw new Error(out?.error?.message || String(r.status));
    const text = (out.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
    return json({ text, usados, limite: P.limite, premium: P.premium });
  } catch (e) {
    await db.rpc('devolver_analise', { p_user: user.id });   // não cobra análise que falhou
    console.error('anthropic', e);
    return json({ erro: 'ia', mensagem: 'O serviço de análise está indisponível agora. Tente de novo em alguns minutos.' }, 502);
  }
});
