// Cancela a assinatura; o acesso continua até o fim do período já pago
import { admin, cors, json, usuario } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await usuario(req);
  if (!user) return json({ erro: 'login' }, 401);
  const db = admin();
  const { data: p } = await db.from('profiles').select('mp_preapproval_id, premium_ate').eq('id', user.id).single();
  if (!p?.mp_preapproval_id) return json({ erro: 'sem_assinatura', mensagem: 'Nenhuma assinatura ativa encontrada.' }, 404);
  const r = await fetch(`${Deno.env.get('MP_API') ?? 'https://api.mercadopago.com'}/preapproval/${p.mp_preapproval_id}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!r.ok) return json({ erro: 'pagamento', mensagem: 'Não foi possível cancelar agora. Tente de novo ou cancele pelo Mercado Pago.' }, 502);
  await db.from('profiles').update({ mp_status: 'cancelled', atualizado_em: new Date().toISOString() }).eq('id', user.id);
  return json({ ok: true, premium_ate: p.premium_ate });
});
