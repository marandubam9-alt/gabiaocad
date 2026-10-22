// Avisos do Mercado Pago: liga/desliga o Premium conforme a assinatura
// O estado sempre é confirmado consultando a API do Mercado Pago (o aviso só diz o que mudou).
import { admin, json } from '../_shared/http.ts';
import { assinaturaValida, atualizacaoPerfil } from '../_shared/logic.ts';

const MP = Deno.env.get('MP_API') ?? 'https://api.mercadopago.com';
const mp = (path: string) => fetch(MP + path, { headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` } }).then(r => (r.ok ? r.json() : null));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, any>));
  const tipo = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = url.searchParams.get('data.id') || body?.data?.id || url.searchParams.get('id');
  const segredo = Deno.env.get('MP_WEBHOOK_SECRET');
  if (segredo && !(await assinaturaValida(req.headers.get('x-signature'), req.headers.get('x-request-id'), dataId ? String(dataId) : null, segredo)))
    return json({ ok: false, erro: 'assinatura' }, 401);
  if (!dataId) return json({ ok: true });

  let preId: string | null = null;
  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') preId = String(dataId);
  else if (tipo === 'subscription_authorized_payment') { const pay = await mp(`/authorized_payments/${dataId}`); preId = pay?.preapproval_id ?? null; }
  if (!preId) return json({ ok: true, ignorado: tipo });

  const pre = await mp(`/preapproval/${preId}`);
  if (!pre) return json({ ok: false, erro: 'consulta' }, 502);   // o Mercado Pago reenvia depois
  const up = atualizacaoPerfil(pre);
  if (!up) return json({ ok: true, ignorado: 'referencia' });
  const { error } = await admin().from('profiles').update(up.campos).eq('id', up.userId);
  if (error) { console.error(error); return json({ ok: false }, 500); }
  return json({ ok: true });
});
