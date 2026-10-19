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

-- ── Dados de qualificação no contato ────────────────────────────────────────
--
-- Empresa, CNPJ e segmento(s) são o que a CRTI pergunta ao qualificar. Ficam como
-- COLUNAS de `contacts` (e não só em custom_fields) para a integração futura com
-- o CRM ler direto da tabela. `segmentos` é lista: uma empresa pode atuar em mais
-- de um. `cnpj` guarda só os 14 números (formatar é coisa da tela).

alter table public.contacts add column if not exists empresa text;
alter table public.contacts add column if not exists cnpj text;
alter table public.contacts add column if not exists segmentos text[] not null default '{}';

do $$ begin
  alter table public.contacts add constraint contacts_cnpj_14_digitos
    check (cnpj is null or cnpj ~ '^[0-9]{14}$');
exception when duplicate_object then null; end $$;

create index if not exists contacts_org_cnpj_idx
  on public.contacts (organization_id, cnpj) where cnpj is not null;

-- Preenche o que a Clara já tinha gravado antes das colunas existirem. Só toca
-- em linha ainda vazia, então é seguro rodar a cada atualização.
update public.contacts c
   set empresa = coalesce(c.empresa, nullif(btrim(c.custom_fields ->> 'empresa_informada'), ''))
 where c.empresa is null and c.custom_fields ? 'empresa_informada';

update public.contacts c
   set cnpj = regexp_replace(c.custom_fields ->> 'cnpj_informado', '\D', '', 'g')
 where c.cnpj is null
   and regexp_replace(coalesce(c.custom_fields ->> 'cnpj_informado', ''), '\D', '', 'g') ~ '^[0-9]{14}$';

update public.contacts c
   set segmentos = (
         select coalesce(array_agg(distinct s), '{}')
           from (select btrim(x) as s
                   from regexp_split_to_table(c.custom_fields ->> 'segmento', '\s*[,;/]\s*|\s+e\s+') x) q
          where s <> '')
 where c.segmentos = '{}' and nullif(btrim(c.custom_fields ->> 'segmento'), '') is not null;

-- Contatos ligados a uma empresa do cadastro B2B sem nome/CNPJ próprios.
update public.contacts c
   set empresa = coalesce(c.empresa, co.trade_name),
       cnpj = coalesce(c.cnpj, co.normalized_cnpj)
  from public.company_people cp
  join public.companies co on co.id = cp.company_id and co.organization_id = cp.organization_id
 where cp.organization_id = c.organization_id and cp.person_id = c.person_id
   and cp.is_primary and (c.empresa is null or c.cnpj is null);
