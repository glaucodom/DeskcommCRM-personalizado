# Personalizações deste fork (leia antes de atualizar)

Este repositório (`glaucodom/DeskcommCRM-personalizado`) é um **fork modificado** do
DeskcommCRM oficial (`melgarafael/DeskcommCRM`). Ele roda em produção em
`zap.crtierp.com.br` (pasta `/opt/deskcomm-crm` na VPS).

**Não substitua este código pelo oficial.** Para atualizar, junte (merge) a release oficial
nova em cima deste fork, mantendo as mudanças listadas abaixo. Cada personalização tem um
fragmento em `.changes/` e testes próprios. Se um teste do oficial falhar depois do merge,
veja primeiro se ele esbarra numa personalização desta lista. Já aconteceu com a aba
"Minhas" do inbox.

## Versões

- Tags do fork: `vX.Y.Z-glauco.N`, ou seja, a release oficial X.Y.Z mais as personalizações
  (N conta as publicações do fork em cima dessa release).
- Imagens: `ghcr.io/glaucodom/{deskcommcrm,deskcomm-worker,deskcomm-scheduler,deskcomm-voice-agent}`.
  No ghcr a tag não tem o "v" (ex.: `1.84.0-glauco.1`).
- O robô `.github/workflows/sincronizar-upstream.yml` roda todo dia às 06:17 UTC. Ele junta a
  última release oficial, roda typecheck e test:unit e cria a tag. Se falhar, faça o merge à mão.

## Como atualizar à mão

1. `git fetch upstream --tags && git merge vX.Y.Z` (release oficial) na `main`.
2. Resolva os conflitos mantendo as personalizações abaixo.
3. Rode `pnpm install --frozen-lockfile` e `pnpm test:unit` (cerca de 15 min; as cercas de
   i18n/espanhol, CI e upload pegam coisas).
4. Crie a tag `vX.Y.Z-glauco.1` e dê push na `main` e na tag. O push da tag gera a release e as
   imagens, que levam uns 20 min.
5. Na VPS: `sudo bash hostgator-setup-kit/update.sh --to vX.Y.Z-glauco.1`. Ou use o botão
   "Atualizar agora" em Configurações › Atualização. O update faz backup do banco antes.
   - O backup preventivo precisa de `PSQL_DOCKER_NETWORK="deskcomm-crm_internal"` no `.env`
     da VPS. Sem isso o pg_dump não acha o banco e o update para, com segurança.

## Lista das personalizações

| # | O que muda | Onde | Fragmento / teste |
|---|---|---|---|
| 1 | A versão no rodapé do menu é um link para a tela de atualização | `components/shell/VersionFooter.tsx` | `.changes/sidebar-versao-link-para-atualizacao.md` |
| 2 | Base de Conhecimento: "Ver arquivo enviado" e "Editar texto" para .md/.txt | `app/api/v1/ai/knowledge/sources/[id]/route.ts`, `lib/ai/rag/texto-editavel*` | `.changes/base-conhecimento-ver-e-editar-texto.md`, `MELHORIAS-base-conhecimento.md` |
| 3 | O botão "Atualizar agora" instala as releases do fork; o robô sincroniza com o oficial | `.github/workflows/sincronizar-upstream.yml`, `release-do-fork.yml`, `hostgator-setup-kit/_common.sh` (IMG_NS=glaucodom) | `.changes/robo-de-atualizacao-publica-com-chave.md` |
| 4 | Link de convite sem sessão vai direto para Criar conta | `app/team/accept-invite/[token]/page.tsx` | `.changes/convite-vai-direto-para-criar-conta.md`, `tests/unit/convite-sem-sessao-vai-para-criar-conta.test.ts` |
| 5 | Uma atualização por vez (trava `.update.lock`) | `hostgator-setup-kit/update.sh`, `agent.sh` | `.changes/uma-atualizacao-por-vez.md`, `tests/unit/uma-atualizacao-por-vez.test.ts` |
| 6 | Esconder idiomas pela linha `IDIOMAS_OCULTOS` do `.env` (produção usa `es`) | `lib/i18n/ocultos.ts` | `.changes/so-portugues.md` |
| 7 | Inbox abre na aba "Minhas", que passa a ser a primeira aba | `components/inbox/InboxFilters.tsx`, `InboxLayout.tsx` | `.changes/inbox-abre-em-minhas.md`, `tests/unit/inbox-abre-em-minhas.test.tsx`; testes oficiais do inbox adaptados em `inbox-fila-uma-busca-so` e `inbox-filtro-por-atendente-setas` |
| 8 | Cada vendedor vê só os números em que é responsável (opcional) | `supabase/personalizacoes.sql` | `.changes/visibilidade-por-numero.md` |
| 9 | O número ganha nome ao conectar e tem o botão "Renomear" | Conexões | `.changes/nome-do-numero.md` |
| 10 | **Instruções do agente de IA vão até 50.000 caracteres** (o oficial vai até 20.000) | `lib/ai/agents/limite-das-instrucoes.ts` (valor único), `lib/ai/agents/validation.ts`, `app/app/ai/agents/[id]/_components/AgentForm.tsx`, textos em `lib/i18n/dicionario.ts` e `lib/i18n/traducoes/*.json` | `.changes/instrucoes-do-agente-ate-50-mil.md`, `tests/unit/limite-das-instrucoes-50mil.test.ts`, `tests/unit/agent-form-prompt-nao-trunca.test.tsx` (adaptado) |
| 11 | **Agendamento autoriza a confirmação**: o compromisso que a agenda gravou no turno vira evidência do revisor de promessa (antes a confirmação era vetada e o cliente ficava sem resposta); o trecho barrado vai para `before_send_traces.trace` (campo `trecho`) | `lib/agent-engine/guardrails/promise/evidencias-comerciais.ts` (`registrarAgendamento`, origem `agenda`), `lib/agent-engine/agent/inbound-turn.ts` (`FERRAMENTAS_QUE_MARCAM`), `lib/agent-engine/guardrails/before-send.ts` (detail do `semantic_promise`) | `.changes/agendamento-autoriza-confirmacao.md`, `tests/unit/agendamento-autoriza-a-confirmacao.test.ts` |
| 12 | **Ida da agenda ao Google a cada minuto** (o oficial roda a cada 5): o convite e o link do Meet chegam em cerca de 1 minuto | `docker/scheduler/entrypoint.sh` (linha `agenda-google-push`) | `.changes/agenda-google-ida-a-cada-minuto.md`, `tests/unit/agenda-google-ida-a-cada-minuto.test.ts` |
| 13 | **Mensagem do link do Meet mais limpa**: com convidado, data numa linha e link na de baixo, fuso "horário de Brasília" em vez de America/Sao_Paulo | `lib/agenda/texto-do-compromisso.ts` (`comConvite`), `lib/agent-engine/agent/meet-delivery.ts` (lê `guest_email`), 3 dicionários i18n | `.changes/meet-explica-o-link.md`, `tests/unit/meet-explica-o-link.test.ts` |
| 14 | **O agente grava os dados do lead no CRM**: ferramenta nativa `registrar_dados_do_lead` (nome → `contacts`, empresa/CNPJ → `companies`, pessoa → `people`, vínculo → `company_people`, segmento/origem/indicação → `contacts.custom_fields`). Para a integração com o CRM da CRTI ler depois | `lib/agent-engine/agent/registrar-dados-do-lead.ts`, `lib/agent-engine/agent/inbound-turn.ts` (`AGENT_TOOL_DEFS.registrar_dados_do_lead` e o `tool(...)` correspondente) | `.changes/agente-registra-dados-do-lead.md`, `tests/unit/registrar-dados-do-lead.test.ts` |
| 15 | **Empresa, CNPJ e Segmentos no contato**: colunas reais em `contacts` (`empresa`, `cnpj` só com 14 números, `segmentos text[]`), na ficha, em "Editar contato", na API e gravadas pela `registrar_dados_do_lead` | `supabase/personalizacoes.sql`, `lib/schemas/contacts.ts`, `app/api/v1/contacts/_handler.ts`, `components/contacts/EditContactDialog.tsx`, `app/app/contacts/[id]/_client.tsx`, `lib/agent-engine/agent/registrar-dados-do-lead.ts` |
| 16 | **Cliente vai para a Clara 2**: contato com a etiqueta `cliente` é entregue pelo roteador ao membro de intenção `cliente_crti`, sem classificar (inerte se o roteador não tiver esse membro) | `lib/personalizacoes/cliente-para-clara-2.ts`, `lib/agent-engine/agent/resolve-turn-agent.ts` (degrau antes do sticky) | `.changes/cliente-vai-para-clara-2.md`, `tests/unit/cliente-vai-para-clara-2.test.ts` |

No fork, o namespace das imagens e do repositório é `glaucodom` em vez de `melgarafael`:
`_common.sh` (IMG_NS), compose, Dockerfiles, `install.sh` e `tests/unit/_identidade-deste-repo.ts`.

### Detalhe da personalização 10 (limite das instruções)

- Antes: `z.string().trim().max(20000)` no servidor e `20.000` fixo na tela.
- Agora: as duas réguas leem `LIMITE_DAS_INSTRUCOES = 50_000`. Para mudar o limite, altere só
  esse arquivo, o texto "e o máximo é 50.000" nos 3 dicionários e os números dos dois testes.
- O banco (`ai_agent_versions.system_prompt`) não tem limite de tamanho, então não há migração.
- Se o oficial mexer no limite ou no `AgentForm.tsx`, mantenha o uso de `LIMITE_DAS_INSTRUCOES`
  no merge.
