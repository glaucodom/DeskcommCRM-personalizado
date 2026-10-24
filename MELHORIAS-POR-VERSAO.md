# Melhorias do zap por versão

Este arquivo alimenta a página https://crtierp.com.br/zap.melhorias. **A cada tag `vX.Y.Z-glauco.N` nova,
acrescente uma seção NO TOPO** (mais nova primeiro) no formato abaixo e rode `node ~/zap-melhorias-site/gerar.mjs`
na VPS. Linha de item: `- #número **Título**: o que muda para quem usa`. Use `#-` quando não for um item da
lista de personalizações (ex.: junção com o oficial). Nada aqui é do projeto original.

## v1.88.0-glauco.3 · 2026-10-23
- #33 **Etiquetas do Inbox numa lista só**: conversa e contato passam a ter uma lista única de etiquetas, logo abaixo do cartão do contato (o botão Novo Lead fica ao lado de Ver contato). Clicar numa sugestão adiciona direto, sem perguntar a cor. As etiquetas cadastradas em Configurações › Tags aparecem nas sugestões. A primeira letra sai maiúscula na tela (o dado continua minúsculo). Se a recusa de renomear for só de maiúscula, a mensagem diz o motivo.
- #34 **Ligar Empresas, Pessoas e Segmentos com um clique**: em Configurações › Organização, o cartão "Tipo de cliente" diz se o módulo está ligado e, para o administrador da plataforma, tem o botão "Ligar agora". Em Recursos opcionais, o módulo desligado ganha o botão "Ajustar".
- #35 **Segmento do contato em lista suspensa**: escolha única, a partir da lista cadastrada em CRM › Segmentos.
- #36 **Margem das telas igual à do Funil**: Hub, Tarefas, Propostas e Segmentos usam a mesma largura de conteúdo (documentada no design system).
- #37 **Tarefas mais legíveis**: prazo num balão com data e hora separadas, título em negrito e descrição longa que abre inteira com "Ver tudo".

## v1.88.0-glauco.2 · 2026-10-23
- #32 **Segmentos cadastrados por empresa**: em CRM › Segmentos (só B2B) cada empresa cadastra a própria lista; o Inbox, o Novo contato, o Editar contato e o Novo lead escolhem dela. Renomear atualiza também os contatos; tirar da lista não apaga o segmento dos contatos que já o têm.

## v1.88.0-glauco.1 · 2026-10-23
- #- **Junção com o oficial 1.88.0**: todas as nossas melhorias mantidas. Ganhos do oficial: voltar para a versão anterior em um clique (e sozinho se o app cair), verificação em duas etapas com "confiar neste dispositivo", encaminhar mensagem, últimas compras do contato, contatos em cartões no celular, telefone brasileiro aceito pela API e muitas correções.

## v1.87.0-glauco.8 · 2026-10-23
- #31 **Versão só para administradores**: o número da versão no rodapé do menu deixa de aparecer para atendentes e gerentes.

## v1.87.0-glauco.7 · 2026-10-23
- #30 **Importar histórico: barra de progresso atualiza sempre**: a janela não congela mais quando a aba fica em segundo plano.

## v1.87.0-glauco.6 · 2026-10-23
- #30 **Importar histórico para o CRM**: em Conexões, no número com "Guardar o histórico" ligado, o botão mostra a prévia, pede confirmação e importa em segundo plano as conversas e mensagens que o WhatsApp já entregou. Não aciona IA nem automação; conversas novas entram fechadas; grupos ficam de fora; pode repetir sem duplicar.

## v1.87.0-glauco.5 · 2026-10-23
- #26 **Nome com letras maiúsculas certas**: ao cadastrar ou editar contato (Contatos, Iniciar conversa, agente de IA), o nome é gravado como "Glauco Satler Neiva" ou "Maria da Silva Oliveira" (de, da, do, das, dos, e ficam minúsculos).
- #29 **Telefone com máscara em todas as telas**: +55 (41) 99999-8888 nos contatos, no Inbox e nos negócios.
- #28 **Lápis para editar o nome no Inbox**: no painel da direita da conversa, clique no lápis ao lado do nome, digite e Enter; salva na hora, sem sair da tela.
- #27 **Nome da agenda do celular vira o nome do contato**: contato que chega sem nome recebe o nome que você salvou no celular (se parecer nome de gente), já com as maiúsculas certas. Pode editar; nome digitado nunca é trocado.

## v1.87.0-glauco.4 · 2026-10-22
Tudo o que é nosso fica visível dentro do sistema.
- #- **Lista de melhorias na tela de Atualização**: clicar na versão no rodapé do menu mostra o que este sistema tem a mais que o projeto original.
- #- **Página pública de melhorias**: crtierp.com.br/zap.melhorias, com o histórico por versão.
- #25 **Funil do número** (já pronto na glauco.3, que não chegou a ser instalada): cada número conectado pode ter um funil; quem chama por ele vira lead nesse funil. Escolha em Conexões (cartão do número) ou em Configurações › Atendimento. Vale só para leads novos.

## v1.87.0-glauco.3 · 2026-10-22
- #25 **Funil do número**: ver acima. Substituída pela glauco.4 antes de ser instalada.

## v1.87.0-glauco.2 · 2026-10-22
- #23 **Funil padrão por pessoa**: coluna "Funil padrão" em Equipe (só o administrador altera). Funis abre direto o funil de cada um, com link "Todos os funis".
- #24 **Nova etiqueta**: cadastro de etiqueta, com cor opcional, em Configurações › Tags.

## v1.87.0-glauco.1 · 2026-10-22
- #- **Junção com o oficial 1.87.0**: todas as nossas melhorias mantidas.

## v1.86.0-glauco.7 · 2026-10-21
- #21 **Card "Funil"** em Configurações › Sua empresa, para os campos personalizados e as etapas.

## v1.86.0-glauco.6 · 2026-10-21
- #22 **B2C no painel do Inbox e no Novo Lead**: CPF, nascimento e campos personalizados do contato.

## v1.86.0-glauco.5 · 2026-10-21
- #21 **Atalho para campos personalizados e etapas do funil** em Configurações.

## v1.86.0-glauco.4 · 2026-10-21
- #20 **Tipo de cliente por empresa (B2B ou B2C)**: no B2C o contato tem só CPF e nascimento e o menu de Empresas some.

## v1.86.0-glauco.3 · 2026-10-20
- #- **Teste do agente** aceita o histórico da conversa para testar.

## v1.86.0-glauco.2 · 2026-10-20
- #13 **Agenda da IA**: o evento marcado leva empresa, contato e quem agendou.

## v1.86.0-glauco.1 · 2026-10-20
- #14 **Registro do lead** com origem padronizada.

## v1.85.0-glauco.7 · 2026-10-19
- #19 **Dados da empresa editáveis no Inbox**; Novo Lead sem valor; máscara +55 só para telefones brasileiros.

## v1.85.0-glauco.6 · 2026-10-19
- #18 **Telefone com +55 e máscara** e e-mail validado no cadastro do contato.

## v1.85.0-glauco.5 · 2026-10-19
- #17 **Empresa, CNPJ e segmentos** no Novo contato e no Inbox.

## v1.85.0-glauco.4 · 2026-10-19
- #16 **Cliente vai para a Clara 2**: contato com a etiqueta "cliente" vai direto para o agente de clientes.

Versões anteriores a 1.85.0-glauco.4 (itens #1 a #15): ver a lista completa no fim da página.
