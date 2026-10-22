-- GabiãoCAD: teste grátis de 7 dias a partir do primeiro login; depois disso só com assinatura

alter table public.profiles add column if not exists teste_ate timestamptz;
update public.profiles set teste_ate = criado_em + interval '7 days' where teste_ate is null;
alter table public.profiles alter column teste_ate set default (now() + interval '7 days');
alter table public.profiles alter column teste_ate set not null;

-- pode usar o programa? (assinante ativo ou ainda dentro do teste)
create or replace function public.acesso_liberado(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_premium(p_user) or coalesce((select teste_ate > now() from public.profiles where id = p_user), false);
$$;
grant execute on function public.acesso_liberado(uuid) to authenticated;

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
