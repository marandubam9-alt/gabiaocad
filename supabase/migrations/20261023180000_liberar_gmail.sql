-- Libera o Gmail do dono (entrar com Google) com acesso completo sem prazo.
insert into public.contas_liberadas (email) values ('nathanzinhomaranduba@gmail.com') on conflict do nothing;

-- se a conta já existir, atualiza o plano agora
update public.profiles p set plano = l.plano, premium_ate = null
from public.contas_liberadas l where lower(p.email) = l.email and l.email = 'nathanzinhomaranduba@gmail.com';
