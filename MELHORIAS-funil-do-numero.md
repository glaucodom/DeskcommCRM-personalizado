# Funil do número (personalização #25 do fork)

Documento para quem for atualizar o fork para uma versão nova do DeskcommCRM e precisar decidir se a
solução do fork continua valendo ou se o projeto oficial já resolve melhor.

## O problema

A empresa tem vários números de WhatsApp conectados (ex.: Comercial, Financeiro, Suporte) e quer que
quem chamar por um número vire lead num funil específico. No oficial, todo lead que nasce de uma
conversa entra no funil padrão (`crm_pipelines.is_default`), salvo quando a conversa veio de uma
campanha que declara funil (migration 0378). Não há vínculo número → funil.

## A solução do fork

- **Dado:** coluna `channel_sessions.funil_id` (uuid, FK `crm_pipelines`, `on delete set null`), criada
  em `supabase/personalizacoes.sql` (idempotente, aplicada pelo `update.sh` a cada atualização).
- **Regra:** `destinoDoNumero` em `lib/leads/nascimento-do-lead.ts`, usada por `garantirLeadDaConversa`.
  Ordem de precedência: **campanha com funil > funil do número > funil de clientes (agenda) > funil
  padrão**. Funil do número arquivado, apagado ou sem etapa aberta cai no padrão: o lead nunca deixa de
  nascer. Só vale para lead NOVO; lead existente não muda de funil.
- **API:** `GET/PATCH /api/v1/channel-sessions/[id]/funil` (admin). Auditoria `channel.funil_changed`.
- **Telas (duas portas para o mesmo dado):**
  - cartão do número em Conexões — `components/connections/FunilDoNumero.tsx`;
  - lista de todos os números em Configurações › Atendimento —
    `app/app/settings/atendimento/_funil-dos-numeros.tsx`.
- **Testes:** `tests/unit/funil-do-numero.test.ts` e `app/api/v1/channel-sessions/[id]/funil/route.test.ts`.

## Como avaliar uma versão nova do oficial

1. Leia o `CHANGELOG.md` da versão e procure por: `funil`, `pipeline`, `número`, `canal`,
   `channel_sessions`, `roteamento`, `entrada do lead`.
2. Procure no código oficial: `git grep -n "pipeline_id\|funil" -- supabase/baseline.sql | grep -i channel`
   e leia `lib/leads/nascimento-do-lead.ts` do oficial: se `funilDeEntrada` ganhou um parâmetro de canal,
   ou `channel_sessions` ganhou uma coluna de funil/pipeline, o oficial passou a resolver.
3. Compare com esta solução:
   - o oficial cobre **número → funil** sem depender de campanha? (se só cobre campanha, a nossa segue
     necessária);
   - tem tela por número (como o cartão de Conexões e a lista de Atendimento)?
   - cai no funil padrão quando o funil sumiu, em vez de não criar o lead?
4. Decisão:
   - **Oficial cobre tudo:** migrar os vínculos (`select id, funil_id from channel_sessions where funil_id
     is not null`) para o mecanismo oficial, remover `destinoDoNumero`, a rota, os dois componentes, o
     bloco do `personalizacoes.sql` (a coluna pode ficar) e atualizar o #25 em `PERSONALIZACOES-DO-FORK.md`.
   - **Oficial cobre parte:** manter a nossa e registrar aqui o que falta.
   - **Oficial não cobre:** manter; ao fazer merge, conferir se `nascimento-do-lead.ts` conflitou e
     preservar a precedência acima.
5. Em qualquer caso, rode `pnpm test:unit` e confirme que `funil-do-numero.test.ts` ainda passa.

## Se der problema

- Lead nascendo no funil errado: `select id, display_name, funil_id from channel_sessions;` e confira o
  funil (não arquivado, com etapa aberta).
- Desligar sem mexer em código: zerar o vínculo (seletor "Padrão da empresa") ou
  `update channel_sessions set funil_id = null;`.
