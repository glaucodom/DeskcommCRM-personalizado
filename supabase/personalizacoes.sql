-- PERSONALIZAÇÕES DESTA VERSÃO (fork glaucodom), fora do baseline oficial.
--
-- Aplicado pelo update.sh LOGO DEPOIS do baseline, a cada atualização. Tudo
-- aqui é idempotente (create or replace / drop if exists + create). Fica num
-- arquivo próprio para o merge da versão oficial nunca conflitar com ele.

-- ── Visibilidade por número ─────────────────────────────────────────────────
--
-- Cada vendedor é responsável por um número. Com
-- `organizations.settings.visibilidade_por_numero = true`, um ATENDENTE (papel
-- `agent`) vê as conversas dos números em que está marcado em
-- Configurações › Atendimento › "Responsáveis por número" — todas, com ou sem
-- dono — e não vê as dos números em que não está marcado. Exceções:
--   • conversa no nome dele aparece sempre;
--   • número sem responsáveis configurados continua aberto a todos;
--   • conversa sem número (sem channel_session_id) não é afetada;
--   • viewer, manager, admin e platform admin não são afetados.
-- Desligado (padrão), nada muda.
--
-- É uma política RESTRITIVA: soma-se (AND) à `conversations_select` oficial,
-- que continua decidindo pelo visibility_mode. Para o vendedor ver também as
-- conversas sem dono do número dele, use junto "Todos veem tudo".

create or replace function public.fn_canal_visivel_pelo_numero(p_org uuid, p_canal uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when public.fn_is_platform_admin() then true
    when coalesce(public.fn_user_role_in_org(p_org), '') <> 'agent' then true
    when coalesce((select settings->>'visibilidade_por_numero' from public.organizations where id = p_org), 'false') <> 'true' then true
    when p_canal is null then true
    when not exists (
      select 1 from public.channel_routing_policies p
       where p.organization_id = p_org and p.channel_session_id = p_canal
    ) then true
    else exists (
      select 1
        from public.channel_routing_policies p
        join public.channel_routing_responsibles r on r.policy_id = p.id
       where p.organization_id = p_org
         and p.channel_session_id = p_canal
         and r.user_id = auth.uid()
    )
  end;
$$;

create or replace function public.fn_conversa_visivel_pelo_numero(p_org uuid, p_canal uuid, p_dono uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select (p_dono is not null and p_dono = auth.uid())
      or public.fn_canal_visivel_pelo_numero(p_org, p_canal);
$$;

revoke all on function public.fn_canal_visivel_pelo_numero(uuid, uuid) from public;
revoke execute on function public.fn_canal_visivel_pelo_numero(uuid, uuid) from anon;
grant execute on function public.fn_canal_visivel_pelo_numero(uuid, uuid) to authenticated, service_role;
revoke all on function public.fn_conversa_visivel_pelo_numero(uuid, uuid, uuid) from public;
revoke execute on function public.fn_conversa_visivel_pelo_numero(uuid, uuid, uuid) from anon;
grant execute on function public.fn_conversa_visivel_pelo_numero(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "conversations_select_pelo_numero" on public.conversations;
create policy "conversations_select_pelo_numero" on public.conversations
  as restrictive
  for select
  to authenticated
  using (public.fn_conversa_visivel_pelo_numero(organization_id, channel_session_id, assigned_to_user_id));
