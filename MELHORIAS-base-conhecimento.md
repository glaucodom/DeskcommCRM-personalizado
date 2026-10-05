# Melhoria: visualizar e editar a Base de Conhecimento

Tela: `/app/ai/knowledge/sources`. Versão base: DeskcommCRM 1.73.0 (fork `glaucodom/DeskcommCRM-personalizado`, commit `838b2ab`).

## Problema original
Para conferir o texto de um material era preciso baixar o arquivo; para corrigir, apagar e enviar de novo.

## Solução
Dois botões no cartão do material, **só para documento em `.md` ou `.txt`** (inclui texto colado, que o sistema guarda como `.md`). **PDF, Word e CSV não são editáveis por esta melhoria.**

- **Ver arquivo enviado:** modal somente leitura com o texto do arquivo ativo, nome do arquivo e versão, área rolável, quebras de linha preservadas, botões Copiar e Fechar. Fecha também por Esc e clique fora. Erro de leitura aparece no modal sem quebrar a tela.
- **Editar texto:** editor grande com o texto atual, Salvar e Cancelar. Cancelar (ou Esc / clique fora) não grava nada. Salvar fica desligado enquanto o texto não muda e durante a gravação.

## Versionamento e histórico
Salvar grava um arquivo **novo** no bucket `ai-policy` (`<org>/<uuid>.<ext>`), lê de volta para confirmar que existe e é legível, e só então troca o ponteiro do material. A versão anterior entra em `source_metadata.historico` (`versao`, `blob_path`, `ext`, `filename`, `size_bytes`, `substituida_em`, `substituida_por`) e o arquivo antigo **continua no bucket**. `source_metadata.versao` conta a versão atual. Sem migração de banco.

Falha antes da troca apaga só o arquivo novo, e o material segue no antigo. A troca é condicionada ao arquivo que o editor carregou: se outra pessoa salvou antes, a resposta é 409 e nada muda. O material **nunca é arquivado** nesse caminho.

## Reindexação
Depois de salvar, o servidor emite `knowledge_source.updated` e a tela acompanha até a indexação terminar depois do salvamento. O indexador (`workers/rag-indexer.ts`) ignora um segundo pedido do mesmo material em 30 s (debounce); por isso, se a preparação não terminou em **35 s**, a tela pede de novo, uma vez. O teste de ponta a ponta precisou dessa segunda tentativa.

## Segurança
Papel mínimo `manager`, organização sempre da sessão (nunca do corpo), e o caminho do arquivo precisa começar pela pasta da organização (`<org>/`, sem `..`). O texto é exibido como texto (`<pre>` e `<textarea>`), nunca como HTML. Nenhuma chave vai para o navegador; as chamadas usam o cookie de sessão.

## Arquivos
- Servidor: `app/api/v1/ai/knowledge/sources/[id]/route.ts` (rota existente estendida: `GET ?conteudo=1` e `PATCH { texto, blob_path_atual }`), `lib/ai/rag/texto-editavel.ts`.
- Tela: `components/ai/KnowledgeSourceCard.tsx`, `components/ai/VerArquivoDialog.tsx`, `components/ai/EditarTextoDialog.tsx`, `hooks/ai/useTextoDoMaterial.ts`, traduções em `lib/i18n/dicionario.ts`.
- Testes: `app/api/v1/ai/knowledge/sources/[id]/texto.route.test.ts` (13 casos), `tests/unit/base-conhecimento-ver-e-editar-texto.test.tsx` (12 casos), `overrides/base-conhecimento/teste-editar-texto.mjs` (ponta a ponta).
- Reaplicação, instalação e rollback: `overrides/base-conhecimento/README.md`.

## Resultado do teste de ponta a ponta (2026-10-05, produção)
Material temporário criado e indexado (12 s); conteúdo lido conferiu; edição criou a versão 2; versão 1 no histórico e o arquivo dela continua no bucket; o primeiro pedido de reindexação foi ignorado pelo debounce e o segundo, aos 35 s, indexou (43 s no total); fonte ativa e pronta; trechos contêm `EDITADO_TESTE_BASE_CONHECIMENTO` e não contêm mais o texto antigo; material arquivado no fim. Nenhum material real foi tocado.

## Limitações conhecidas
- O teste de ponta a ponta reproduz a sequência da rota com a chave de serviço, dentro do container; ele não passa pela tela nem pela rota HTTP (essas estão cobertas pelos testes unitários). A prova pela tela fica com o primeiro uso real.
- Arquivos antigos não são apagados; com muitas edições, o bucket cresce.
- Não há tela para restaurar uma versão anterior; o histórico guarda os ponteiros para isso.
