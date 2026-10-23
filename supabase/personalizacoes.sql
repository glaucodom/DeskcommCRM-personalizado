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

-- ── Funil padrão por pessoa ─────────────────────────────────────────────────
--
-- O administrador escolhe, em Equipe, o funil que "Funis" no menu abre direto
-- para cada pessoa. Vazio = cai no funil padrão da empresa (`is_default`).
-- Apagar o funil zera a escolha (on delete set null): ninguém fica preso a um
-- funil que não existe mais.
alter table public.user_organizations
  add column if not exists funil_padrao_id uuid references public.crm_pipelines(id) on delete set null;

-- ── Nova etiqueta (Configurações › Tags) ────────────────────────────────────
--
-- O vocabulário só ganhava etiqueta quando alguém a USAVA. Esta função cadastra
-- uma etiqueta direto no vocabulário da empresa (`organizations.settings.tags`),
-- com cor opcional, antes de qualquer uso. Mesmo portão das outras operações do
-- vocabulário: gerente ou mais. Nome que já existe (sem diferenciar maiúsculas)
-- não duplica: devolve `criou = false`.
create or replace function public.fn_vocabulario_de_tags_criar(
  p_org uuid,
  p_tag text,
  p_cor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag text := btrim(coalesce(p_tag, ''));
  v_cor text := nullif(btrim(coalesce(p_cor, '')), '');
  v_existia boolean;
begin
  if not public.fn_role_at_least(p_org, 'manager') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_tag = '' or char_length(v_tag) > 60 then
    raise exception 'tag_invalida' using errcode = '22023';
  end if;
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'cor_invalida' using errcode = '22023';
  end if;

  select exists (
    select 1
      from public.organizations o
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(o.settings -> 'tags') = 'array' then o.settings -> 'tags' else '[]'::jsonb end
        || case when jsonb_typeof(o.settings -> 'canonical_conversation_tags') = 'array'
                then o.settings -> 'canonical_conversation_tags' else '[]'::jsonb end
      ) as e(valor)
     where o.id = p_org
       and lower(btrim(coalesce(e.valor ->> 'tag', e.valor #>> '{}'))) = lower(v_tag)
  ) into v_existia;

  if v_existia then
    return jsonb_build_object('criou', false, 'tag', v_tag);
  end if;

  update public.organizations o
     set settings = jsonb_set(
           coalesce(o.settings, '{}'::jsonb),
           '{tags}',
           case when jsonb_typeof(o.settings -> 'tags') = 'array' then o.settings -> 'tags' else '[]'::jsonb end
             || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('tag', v_tag, 'cor', v_cor))),
           true
         )
   where o.id = p_org;

  return jsonb_build_object('criou', true, 'tag', v_tag);
end;
$$;

revoke all on function public.fn_vocabulario_de_tags_criar(uuid, text, text) from public;
revoke execute on function public.fn_vocabulario_de_tags_criar(uuid, text, text) from anon;
grant execute on function public.fn_vocabulario_de_tags_criar(uuid, text, text) to authenticated, service_role;

-- ── Funil do número ─────────────────────────────────────────────────────────
--
-- Cada número conectado pode ter um funil: o lead que NASCE de uma conversa
-- desse número entra nesse funil (primeira etapa aberta). Vazio = a regra de
-- sempre (funil padrão da empresa). Campanha que declara funil continua
-- ganhando do número. Apagar o funil zera o vínculo (on delete set null).
alter table public.channel_sessions
  add column if not exists funil_id uuid references public.crm_pipelines(id) on delete set null;

-- ── Importar histórico do WhatsApp para o CRM (#30) ─────────────────────────
--
-- Grava, em lote, conversas antigas que o servidor do canal já guardava do número.
-- É SÓ HISTÓRICO: nada aqui pode acordar IA, automação, rodízio, lead ou o evento
-- "mensagem recebida". Por isso as mensagens entram com `session_replication_role =
-- replica` (os gatilhos de usuário de `messages` — evento, demanda, revisão de
-- contexto, atividade do vendedor — não rodam) e a conversa nova nasce JÁ FECHADA
-- (o gatilho de rodízio só olha conversa aberta). O papel volta a `origin` logo
-- depois da inserção das mensagens, antes de qualquer outra escrita.
--
-- Idempotente: a mensagem repetida (mesmo `external_id` na org) é pulada pelo NOT EXISTS
-- (a restrição única é DEFERRABLE, então `on conflict` não serve como árbitro), então clicar de novo só traz o que faltava. Conversa que já existe
-- NÃO é reaberta, reordenada nem alterada: só ganha as mensagens que faltam.
create or replace function public.fn_importar_historico_lote(
  p_org uuid,
  p_session uuid,
  p_chats jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat jsonb;
  v_contact uuid;
  v_conv uuid;
  v_nova boolean;
  v_inicio timestamptz := transaction_timestamp();
  v_ins int;
  v_contatos int := 0;
  v_conversas int := 0;
  v_novas int := 0;
  v_ultima timestamptz;
  v_ultima_in timestamptz;
  v_ultima_out timestamptz;
  v_previa text;
begin
  if not exists (
    select 1 from public.channel_sessions s where s.id = p_session and s.organization_id = p_org
  ) then
    raise exception 'canal_nao_pertence_a_org' using errcode = '42501';
  end if;

  for v_chat in select * from jsonb_array_elements(coalesce(p_chats, '[]'::jsonb)) loop
    v_contact := public.fn_upsert_wa_contact(
      p_org,
      v_chat ->> 'kind',
      nullif(v_chat ->> 'phone', ''),
      nullif(v_chat ->> 'lid', ''),
      v_chat ->> 'chat_id',
      nullif(v_chat ->> 'notify', '')
    );
    continue when v_contact is null;
    if exists (select 1 from public.contacts c where c.id = v_contact and c.created_at >= v_inicio) then
      v_contatos := v_contatos + 1;
    end if;

    select id into v_conv from public.conversations
     where organization_id = p_org and contact_id = v_contact and channel_session_id = p_session and is_group = false;
    v_nova := v_conv is null;
    if v_nova then
      insert into public.conversations (
        organization_id, contact_id, channel_session_id, channel, status, is_group,
        unread_count_for_assignee, metadata, service_closed_at
      ) values (
        p_org, v_contact, p_session, 'whatsapp', 'closed', false,
        0, jsonb_build_object('historico_importado', true), clock_timestamp()
      )
      on conflict (organization_id, contact_id, channel_session_id) where is_group = false do nothing
      returning id into v_conv;
      if v_conv is null then
        select id into v_conv from public.conversations
         where organization_id = p_org and contact_id = v_contact and channel_session_id = p_session and is_group = false;
        v_nova := false;
      else
        v_conversas := v_conversas + 1;
      end if;
    end if;

    set local session_replication_role = replica;
    insert into public.messages (
      organization_id, conversation_id, channel_session_id, contact_id, external_id,
      type, direction, status, ack, body, media_mime, sent_via, sent_at, delivered_at,
      created_at, metadata
    )
    select distinct on (m.external_id) p_org, v_conv, p_session, v_contact, m.external_id,
           m.type, m.direction, m.status, m.ack, m.body, m.media_mime, 'external_device', m.sent_at,
           case when m.direction = 'inbound' then m.sent_at end,
           m.sent_at,
           jsonb_strip_nulls(jsonb_build_object(
             'historico_importado', true,
             'fromMe', m.direction = 'outbound',
             'media_status', case when m.sem_midia then 'historico_indisponivel' end,
             'media_filename', m.media_filename
           ))
      from jsonb_to_recordset(coalesce(v_chat -> 'mensagens', '[]'::jsonb)) as m(
        external_id text, type text, direction text, status text, ack int, body text,
        media_mime text, media_filename text, sem_midia boolean, sent_at timestamptz
      )
     where m.external_id is not null
       and not exists (
         select 1 from public.messages x
          where x.organization_id = p_org and x.external_id = m.external_id
       )
     order by m.external_id;
    get diagnostics v_ins = row_count;
    set local session_replication_role = origin;
    v_novas := v_novas + v_ins;

    if v_nova and v_ins > 0 then
      select max(sent_at), max(sent_at) filter (where direction = 'inbound'), max(sent_at) filter (where direction = 'outbound')
        into v_ultima, v_ultima_in, v_ultima_out
        from public.messages where conversation_id = v_conv;
      select left(coalesce(nullif(body, ''), '[' || type || ']'), 140) into v_previa
        from public.messages where conversation_id = v_conv order by sent_at desc limit 1;
      update public.conversations
         set last_message_at = v_ultima, last_inbound_at = v_ultima_in, last_outbound_at = v_ultima_out,
             last_message_preview = v_previa
       where id = v_conv;
    end if;
  end loop;

  return jsonb_build_object('contatos_novos', v_contatos, 'conversas_novas', v_conversas, 'mensagens_novas', v_novas);
end;
$$;

revoke all on function public.fn_importar_historico_lote(uuid, uuid, jsonb) from public;
revoke execute on function public.fn_importar_historico_lote(uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.fn_importar_historico_lote(uuid, uuid, jsonb) to service_role;
