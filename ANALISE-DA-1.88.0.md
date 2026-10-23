# Análise da versão oficial 1.88.0 contra as nossas 31 personalizações

Feita em 2026-10-23, com o fork em `v1.87.0-glauco.8`. **Juntada em `v1.88.0-glauco.1`** seguindo o plano abaixo
(resultado na seção F). Antes do merge definitivo, um merge de teste num worktree descartável mediu os conflitos.

A 1.88.0 é grande: 792 arquivos, +67 mil linhas, 17 migrations novas. O merge dá **7 conflitos de texto**,
todos resolvidos mantendo os dois lados (tabela A). Além deles há sobreposições que o git não vê, porque
as duas mudanças tocam arquivos diferentes (tabela B), e itens oficiais que pedem ação do administrador
(seção C).

Regra usada em cada linha: **adotar o oficial** (ele cobre o que fizemos, ou melhor), **manter o nosso**
(o oficial não cobre) ou **manter os dois** (se complementam). Quando o oficial cobre melhor, a nossa
personalização deve ser desfeita no próprio merge, não deixada em paralelo.

## A. Conflitos de texto (7 arquivos)

| Arquivo | Oficial 1.88.0 | Nosso | Decisão |
|---|---|---|---|
| `app/app/settings/atualizacao/page.tsx` | exige a prova da verificação em duas etapas antes de abrir a tela (`exigirProvaDeMfa`) | card "Melhorias deste sistema" (`MelhoriasDoFork`) abaixo do painel (#1, #31) | **Manter os dois.** Prova de MFA antes (`if (!user.support) await exigirProvaDeMfa(...)`), depois `<><UpdatePanel/><MelhoriasDoFork .../></>`. O imports dos dois lados entram juntos. |
| `app/app/settings/tenant/page.tsx` | `camposDoNegocioDosFunis` (últimas compras do contato, Configurações › Empresa) | `TipoDeClienteForm` e `tipoDeCliente` (#20, B2B/B2C) | **Manter os dois.** Só imports e blocos diferentes na mesma página. |
| `components/contacts/ContactsTable.tsx` | contatos em cartões no celular (classes `max-md:*`, `recuoSobONome`) | telefone com máscara `telefoneNaTela` (#29) | **Layout do oficial + nossa máscara.** Troca só a chamada `phoneForDisplay` por `telefoneNaTela` dentro da célula nova. |
| `components/contacts/NewContactDialog.tsx` | rótulo "Telefone (DDD + número)" (#3301) | rótulo "Telefone (WhatsApp)" e campo que já nasce com `+55` e máscara (#18) | **Manter os dois**, ver B1. Fica o nosso rótulo e a nossa máscara na tela. |
| `components/contacts/EditContactDialog.tsx` | idem; importa `PAIS_PADRAO` | idem; mais `useTipoDeCliente`, `mascaraCpf` (#20) | **Manter os dois**, ver B1. Importar também `PAIS_PADRAO` só se algum trecho ainda o usar (senão o lint reclama). |
| `components/kanban/NewLeadDialog.tsx` | prop `settings` (campos que a etapa exige, #3038) | props `dadosDaEmpresa`, `camposDoContato`, `dadosDaPessoa` (#19, #22) | **Manter os dois conjuntos de props.** Conferir a ordem dos blocos no formulário (campos exigidos pela etapa x dados da empresa). |
| `lib/i18n/dicionario.ts` | entradas novas no meio | nossas entradas no FIM do arquivo (cerca) | **Manter os dois.** Nossas entradas continuam no fim. Se o oficial passou a ter a mesma chave, apagar a nossa (já aconteceu na 1.80). |

## B. Sobreposições que o git não mostra

| # | Assunto | Oficial 1.88.0 | Nosso | Parecer |
|---|---|---|---|---|
| B1 | **Telefone no cadastro** (#18, #29) | #3301: a organização brasileira aceita `(11) 99999-8888`, `11 3322-4455`, `11999998888` e **a API** grava `+5511999998888`; `PATCH` e `POST /api/v1/contacts` também | campo já com `+55 ` e máscara enquanto digita; exibição `+55 (41) 99999-8888` em todas as telas | **Manter os dois.** O oficial vence na API (integração que manda sem `+55` passa a funcionar). O nosso vence na tela: a pessoa vê a máscara ao digitar. Não há conflito de dado: tudo converge para E.164 no banco. Reavaliar daqui a duas versões se o oficial passar a mascarar na tela; aí se aposenta o `mascaraTelefoneBr`. |
| B2 | **Voltar para a versão anterior** (nosso `update.sh`, #3 e #5) | volta em um clique e **volta sozinho** se o app cai após atualizar (`update.sh` +38 linhas, `agent.sh` +117, `restore.sh` +182) | trava de uma atualização por vez (`.update.lock`, `DESKCOMM_TRAVA_*`), `personalizacoes.sql` aplicado após o baseline, `PSQL_DOCKER_NETWORK` | **Adotar o oficial e manter a nossa trava.** Merge limpo, mas é o ponto de maior risco operacional: rodar `tests/shell` (`< /dev/null`) e conferir, antes de instalar, que (a) a trava continua impedindo duas atualizações, (b) o agente que volta sozinho não rearma sobre a atualização que acabou de pôr a versão, (c) `personalizacoes.sql` ainda é aplicado. |
| B3 | **Etiquetas** (#16 cliente→Clara 2, #24 Nova etiqueta) | etiquetas de contato interno (`lib/contacts/tags-internas.ts`: não vira lead, a IA não responde); vocabulário paginado (migration 0748); Juntar só com etiqueta existente | cadastro de etiqueta com cor (`fn_vocabulario_de_tags_criar`) | **Manter os dois**, mas **verificar**: a 0748 mexe no vocabulário. Se `fn_vocabulario_de_tags_criar` foi substituída ou mudou de formato, o botão "Nova etiqueta" quebra. A #16 (etiqueta `cliente`) não colide com as etiquetas internas, que são outras. |
| B4 | **Visibilidade por número** (#8) | migration 0726 troca a política `conversations_select` e cria `fn_conversation_scope` (uma vez por consulta) | política **restritiva** separada `conversations_select_pelo_numero` | **Manter o nosso.** Política restritiva soma-se à permissiva do oficial, então o efeito deve continuar. **Confirmar por medida** depois de instalar: a Paloma vê 35 do Comercial CRTI e 0 do outro; o Glauco Dom (agente) vê os 3 do outro número. |
| B5 | **Funis** (#21, #23, #25) | Funis recolhem listas longas, exportam CSV; cota de 50 campos só do negócio; transferir a conversa leva o negócio | atalho "Funil"; funil padrão por pessoa; funil do número | **Manter os dois.** Sem arquivo em comum. Conferir `/app/kanban`, o seletor da Equipe e o cartão do número depois do merge. |
| B6 | **IA** (#10, #11, #14, #16) | registro de cada turno do agente (0721), assinatura com o nome do agente, "contato interno" sem resposta da IA, passagem para humano com código próprio, eco do CRM não pausa a IA | limite de 50.000 no prompt, agendamento autoriza a confirmação, `registrar_dados_do_lead`, cliente→Clara 2 | **Manter os dois.** Merge limpo, mas os arquivos são os mesmos (`inbound-turn.ts`, `resolve-turn-agent.ts`). Rodar os testes de `lib/agent-engine` e reler os pontos de nossa personalização. A "passagem para humano" ganhou código `atendimento_com_humano`: conferir que a #16 não depende do código antigo. |
| B7 | **Importar histórico** (#30) | `fn_upsert_wa_contact` reescrita (0744): emite `contact.phone_added` quando um contato **sem telefone** passa a ter | `fn_importar_historico_lote` chama essa função | **Atenção.** A importação não deveria disparar automação. Hoje o evento só sai se o contato já existia sem telefone (caso raro: conversas `@lid`). Depois do merge, ou a importação passa a evitar o ramo de atualização, ou avisa. Nenhuma migration da 1.88 mexe em `messages`/`conversations`; os gatilhos desligados pelo `replica` continuam sendo os mesmos. |
| B8 | **Mensagem** (#30 mídia indisponível) | mensagem apagada fica cinza e diz quem apagou; Encaminhar; "tentar de novo" | `media_status = historico_indisponivel` na bolha | **Manter os dois.** Conferir `MessageBubble.tsx` depois do merge (arquivo muito mexido pelo oficial). |
| B9 | **Contato e dossiê** (#15, #17, #19, #20, #29) | "Últimas compras" no Inbox/ficha; dossiê do negócio reordenado (campos antes da linha do tempo); CPF/e-mail repetido responde 409 `contact_exists` | Empresa/CNPJ/Segmentos, CPF cifrado, dados da empresa/pessoa no Inbox | **Manter os dois.** O 409 do oficial (`lib/contacts/conflito-unico.ts`) passa a valer também para os nossos campos nas rotas de contato: conferir que `cnpj` repetido não cai num erro novo. |
| B10 | **Nome com maiúsculas e nome da agenda** (#26, #27, #28) | contato sem nome: sem mudança | `nomeProprio` na API e nas telas, agenda vira nome, lápis no Inbox | **Manter o nosso.** `app/api/v1/contacts/_handler.ts` mudou 140 linhas no oficial: depois do merge, confirmar que `nomeProprioOpcional` continua no criar e no editar. |

## C. O que o administrador precisa saber (Requer atenção da 1.88.0)

- **Regras de "negócio criado" passam a rodar também para o negócio aberto pela Prospecção.** Se alguma regra
  nossa com gatilho "Negócio criado" **envia mensagem**, ela passará a disparar na Prospecção. Conferir
  as regras antes de instalar; para excluir a Prospecção, usar a condição `lead.source` diferente de
  `prospecting`.
- Itens novos desligados por padrão (não mudam nada até serem ligados): assinatura da IA com o nome de cada
  agente, aviso de agendamento no WhatsApp do dono, caixa bloqueada até assumir a conversa, reaproveitar o
  card aberto do contato, "Confiar neste dispositivo".
- Sem impacto no zap: WordPress pelo banco externo, Nuvemshop, Campanhas pelo número oficial (o zap usa QR).

## D. Passo a passo para juntar (quando for aprovado)

1. Branch no fork, `git merge v1.88.0`, resolver os 7 conflitos como na tabela A.
2. Aplicar os pareceres da tabela B (conferir B3, B4, B7 e B10 no código; B2 com `tests/shell`).
3. Se algum item do oficial cobrir melhor que o nosso, **desfazer o nosso no mesmo commit** e atualizar
   `PERSONALIZACOES-DO-FORK.md`, `MELHORIAS-POR-VERSAO.md` e `lib/personalizacoes/melhorias-do-fork.ts`.
4. `pnpm test:unit` completo; ajustar só os testes oficiais que assumem o comportamento antigo (registrar
   quais, como na 1.80 e 1.81).
5. Tag `v1.88.0-glauco.1`, push em `origin` (nunca em `forkpr`), instalar com `update.sh --to`.
6. Depois de instalar, medir: visibilidade por número (B4), "Nova etiqueta" (B3), importar histórico em
   modo prévia (B7), cadastro de contato com e sem `+55` (B1), tela de Atualização com a prova de MFA.

## E. Como manter isto organizado nas próximas versões

Toda versão oficial nova ganha um `ANALISE-DA-X.Y.Z.md` como este **antes** do merge: conflitos de texto,
sobreposições por assunto (usar a lista de personalizações como índice e o CHANGELOG oficial como fonte),
decisão por linha (adotar / manter / os dois) e o que medir depois. É o que impede a nossa melhoria de
brigar com a do projeto original sem ninguém perceber.

## F. Resultado do merge (v1.88.0-glauco.1)

- 7 conflitos resolvidos como na tabela A. Ajustes além do texto: removido o import duplicado de
  `CustomFieldsEditor` no `NewLeadDialog.tsx` e o `PAIS_PADRAO` que ficou sem uso nos dois diálogos de contato.
- `dicionario.ts`: as duas partes mantidas, nossas entradas no fim; nenhuma chave duplicada.
- Conferido no código: B10 (`nomeProprioOpcional` no criar e no editar do `_handler.ts`), B3 (a 0748 só ADICIONA
  `fn_vocabulario_de_tags_pagina`; `fn_vocabulario_de_tags_criar` continua nossa), B2 (a trava `.update.lock` e
  `DESKCOMM_TRAVA_*` seguem no `update.sh` e no `agent.sh`).
- Conferência de tipos dos arquivos tocados limpa; `pnpm test:unit`: 2.646 arquivos, 27.925 testes, nenhuma falha, sem
  precisar mexer em teste oficial.
- Ficam para MEDIR no zap depois de instalar: B4 (visibilidade por número), B1 (cadastro com e sem +55), B7 (importar
  histórico em modo prévia), "Nova etiqueta", tela de Atualização com a prova de MFA.
