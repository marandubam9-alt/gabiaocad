// Cria a assinatura no Mercado Pago e devolve o link de pagamento
import { cors, json, usuario } from '../_shared/http.ts';
import { corpoAssinatura, emailEstudante, PRECOS, type Opcao } from '../_shared/logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await usuario(req);
  if (!user || !user.email) return json({ erro: 'login', mensagem: 'Entre na sua conta para assinar.' }, 401);
  const { opcao } = await req.json().catch(() => ({}));
  if (!(opcao in PRECOS)) return json({ erro: 'pedido' }, 400);
  if (opcao === 'estudante' && !emailEstudante(user.email))
    return json({ erro: 'estudante', mensagem: 'O plano Estudante é para contas com e-mail da faculdade (terminado em .edu.br). Entre com esse e-mail ou fale conosco.' }, 400);
  const r = await fetch((Deno.env.get('MP_API') ?? 'https://api.mercadopago.com') + '/preapproval', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoAssinatura(opcao as Opcao, user.id, user.email, Deno.env.get('SITE_URL')!)),
  });
  const out = await r.json();
  if (!r.ok || !out.init_point) { console.error('mp', out); return json({ erro: 'pagamento', mensagem: 'Não foi possível abrir o pagamento agora.' }, 502); }
  return json({ url: out.init_point });
});
