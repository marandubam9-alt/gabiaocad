-- Contas com acesso completo sem prazo (dono, parceiros, prefeituras liberadas à mão).
-- Para liberar alguém depois: insert into public.contas_liberadas (email) values ('pessoa@exemplo.com');
create table if not exists public.contas_liberadas (
  email text primary key,
  plano text not null default 'institucional' check (plano in ('premium', 'estudante', 'institucional')),
  criado_em timestamptz not null default now()
);
alter table public.contas_liberadas enable row level security;   -- sem políticas: ninguém lê pelo site

insert into public.contas_liberadas (email) values ('nathan.34.silva@hotmail.com') on conflict do nothing;

-- perfil novo já nasce com o plano liberado, se o e-mail estiver na lista
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plano text;
begin
  select plano into v_plano from public.contas_liberadas where email = lower(new.email);
  insert into public.profiles (id, email, plano, premium_ate) values (new.id, new.email, coalesce(v_plano, 'gratis'), null)
  on conflict (id) do nothing;
  return new;
end $$;

-- contas que já existem
update public.profiles p set plano = l.plano, premium_ate = null
from public.contas_liberadas l where lower(p.email) = l.email;
