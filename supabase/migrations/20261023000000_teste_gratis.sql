-- GabiãoCAD: teste grátis de 3 horas de uso (contadas só enquanto o programa está aberto e em uso).
-- Vale para o site e para o programa instalado. Depois disso, só com assinatura.

alter table public.profiles add column if not exists uso_seg integer not null default 0;   -- tempo de uso no teste (segundos)
alter table public.profiles add column if not exists ultimo_ping timestamptz;               -- último sinal de uso recebido

-- duração do teste em segundos (3 horas). Para mudar, troque aqui e em TESTE_SEG (supabase/functions/_shared/logic.ts).
create or replace function public.limite_teste_seg() returns integer language sql immutable as $$ select 3 * 3600 $$;

-- pode usar o programa? (assinante ativo ou ainda com tempo de teste)
create or replace function public.acesso_liberado(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_premium(p_user) or coalesce((select uso_seg < public.limite_teste_seg() from public.profiles where id = p_user), false);
$$;
grant execute on function public.acesso_liberado(uuid) to authenticated;

-- sinal de uso enviado pelo programa a cada minuto de uso ativo.
-- Soma o tempo real desde o sinal anterior (no máximo 60 s por sinal); com várias abas abertas o tempo não conta em dobro.
create or replace function public.registrar_uso() returns json
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ult timestamptz; v_add integer := 0; v_uso integer;
begin
  if v_uid is null then raise exception 'LOGIN'; end if;
  select ultimo_ping into v_ult from public.profiles where id = v_uid for update;
  if not found then raise exception 'PERFIL'; end if;
  if v_ult is not null and now() - v_ult < interval '3 minutes' then
    v_add := least(60, greatest(0, floor(extract(epoch from now() - v_ult))::integer));
  end if;
  if public.e_premium(v_uid) then v_add := 0; end if;
  update public.profiles set uso_seg = uso_seg + v_add, ultimo_ping = now() where id = v_uid returning uso_seg into v_uso;
  return json_build_object('uso_seg', v_uso, 'limite_seg', public.limite_teste_seg(), 'premium', public.e_premium(v_uid), 'liberado', public.acesso_liberado(v_uid));
end $$;
revoke execute on function public.registrar_uso() from public, anon;
grant execute on function public.registrar_uso() to authenticated;

-- projetos na nuvem: no teste até 3; com o teste encerrado não grava mais (mas continua podendo ver e apagar)
create or replace function public.limitar_projetos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.acesso_liberado(new.user_id) then
    raise exception 'TESTE_ENCERRADO' using hint = 'O teste grátis terminou. Assine para continuar.';
  end if;
  if tg_op = 'INSERT' and not public.e_premium(new.user_id) and (select count(*) from public.projetos where user_id = new.user_id) >= 3 then
    raise exception 'LIMITE_PROJETOS' using hint = 'O teste grátis guarda até 3 projetos na nuvem.';
  end if;
  return new;
end $$;
drop trigger if exists limite_projetos on public.projetos;
create trigger limite_projetos before insert or update on public.projetos for each row execute function public.limitar_projetos();
