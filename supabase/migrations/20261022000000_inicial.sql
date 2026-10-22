-- GabiãoCAD: contas, planos, uso da IA e projetos na nuvem

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plano text not null default 'gratis' check (plano in ('gratis', 'premium', 'estudante', 'institucional')),
  premium_ate timestamptz,
  mp_preapproval_id text,
  mp_status text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.uso_ia (
  user_id uuid not null references auth.users (id) on delete cascade,
  mes text not null,               -- 'AAAA-MM'
  n integer not null default 0,
  primary key (user_id, mes)
);

create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default 'Projeto sem nome',
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
create index if not exists projetos_user_idx on public.projetos (user_id, atualizado_em desc);

-- perfil criado junto com a conta
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil();

-- Premium ativo?
create or replace function public.e_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select plano <> 'gratis' and (premium_ate is null or premium_ate > now()) from public.profiles where id = p_user), false);
$$;

-- conta uma análise de foto, respeitando o limite do mês; devolve o total usado ou -1 se passou do limite
create or replace function public.consumir_analise(p_user uuid, p_limite integer) returns integer
language plpgsql security definer set search_path = public as $$
declare v_mes text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'); v_n integer;
begin
  insert into public.uso_ia (user_id, mes, n) values (p_user, v_mes, 0) on conflict do nothing;
  update public.uso_ia set n = n + 1 where user_id = p_user and mes = v_mes and n < p_limite returning n into v_n;
  return coalesce(v_n, -1);
end $$;

create or replace function public.devolver_analise(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.uso_ia set n = greatest(0, n - 1) where user_id = p_user and mes = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
$$;

-- plano grátis guarda até 3 projetos na nuvem
create or replace function public.limitar_projetos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_premium(new.user_id) and (select count(*) from public.projetos where user_id = new.user_id) >= 3 then
    raise exception 'LIMITE_PROJETOS' using hint = 'O plano grátis guarda até 3 projetos na nuvem.';
  end if;
  return new;
end $$;
drop trigger if exists limite_projetos on public.projetos;
create trigger limite_projetos before insert on public.projetos for each row execute function public.limitar_projetos();

create or replace function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists projetos_atualizado on public.projetos;
create trigger projetos_atualizado before update on public.projetos for each row execute function public.tocar_atualizado();

-- segurança por linha: cada pessoa só vê o que é seu; plano só muda pelo servidor
alter table public.profiles enable row level security;
alter table public.uso_ia enable row level security;
alter table public.projetos enable row level security;

drop policy if exists "ver o proprio perfil" on public.profiles;
create policy "ver o proprio perfil" on public.profiles for select using (auth.uid() = id);
drop policy if exists "ver o proprio uso" on public.uso_ia;
create policy "ver o proprio uso" on public.uso_ia for select using (auth.uid() = user_id);
drop policy if exists "projetos proprios" on public.projetos;
create policy "projetos proprios" on public.projetos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke execute on function public.consumir_analise(uuid, integer) from public, anon, authenticated;
revoke execute on function public.devolver_analise(uuid) from public, anon, authenticated;
