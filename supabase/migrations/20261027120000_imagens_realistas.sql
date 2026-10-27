-- GabiãoCAD: contagem de imagens realistas geradas por IA (por mês)
create table if not exists public.uso_imagem (
  user_id uuid not null references auth.users (id) on delete cascade,
  mes text not null,               -- 'AAAA-MM'
  n integer not null default 0,
  primary key (user_id, mes)
);
alter table public.uso_imagem enable row level security;
drop policy if exists "ver o proprio uso de imagens" on public.uso_imagem;
create policy "ver o proprio uso de imagens" on public.uso_imagem for select using (auth.uid() = user_id);

create or replace function public.consumir_imagem(p_user uuid, p_limite integer) returns integer
language plpgsql security definer set search_path = public as $$
declare v_mes text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'); v_n integer;
begin
  insert into public.uso_imagem (user_id, mes, n) values (p_user, v_mes, 0) on conflict do nothing;
  update public.uso_imagem set n = n + 1 where user_id = p_user and mes = v_mes and n < p_limite returning n into v_n;
  return coalesce(v_n, -1);
end $$;

create or replace function public.devolver_imagem(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.uso_imagem set n = greatest(0, n - 1) where user_id = p_user and mes = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
$$;

revoke execute on function public.consumir_imagem(uuid, integer) from public, anon, authenticated;
revoke execute on function public.devolver_imagem(uuid) from public, anon, authenticated;
