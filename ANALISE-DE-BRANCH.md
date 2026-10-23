# Como analisar uma branch feita no PC (por outro agente) antes de atualizar o zap

Para o Claude da VPS. Quando o Glauco disser algo como **"analise a branch `dev/xxx`"** ou **"analise o repositório da
modificação da versão tal"**, siga este roteiro e termine com o relatório da seção 5. Não instale nada no zap sem o
"pode" dele depois do relatório.

## 1. Trazer e situar

```
cd ~/deskcomm-fork && git fetch origin --tags
git log --oneline main..origin/dev/xxx          # o que a branch tem a mais
git diff --stat main...origin/dev/xxx           # arquivos tocados
git merge-base main origin/dev/xxx              # de que versão ela partiu
```
- A branch partiu da versão atual do zap (`git describe --tags` em /opt/deskcomm-crm)? Se não, ela está atrasada: o
  merge precisa trazer as versões que entraram depois.
- Teste de merge sem estragar nada: `git worktree add` num diretório temporário e `git merge --no-commit --no-ff
  origin/dev/xxx`; contar conflitos e removê-lo no fim.

## 2. Conferir o que mudou (ler o diff de verdade, não só os nomes)

- **Escopo**: a mudança faz o que o Glauco pediu e só isso? Alterou algo fora do assunto?
- **Segredos**: nenhum `.env`, chave, token, dump ou senha no diff (`git diff main...origin/dev/xxx | grep -iE
  "api[_-]?key|secret|token|password|BEGIN .*PRIVATE"`).
- **Onde o código vive**: a mesma versão roda em OUTRAS empresas do Glauco. Nada específico da CRTI pode ficar no
  código (listas, nomes, textos); isso é dado por empresa (como os Segmentos, #32).
- **Personalizações existentes**: tocou arquivos listados em `PERSONALIZACOES-DO-FORK.md`? Se sim, conferir que a
  personalização continua funcionando e que não duplicou o que o oficial faz (ver `ANALISE-DA-X.Y.Z.md`).
- **Banco**: mudança só em `supabase/personalizacoes.sql`, idempotente (`create or replace`, `if not exists`),
  sem apagar dados, com `grant` só para `service_role` quando for função interna. Testar a função no banco real
  dentro de `begin; ... rollback;`.
- **Textos**: toda frase de tela usa `t("...")` e tem entrada `es` no FIM de `lib/i18n/dicionario.ts` (as cercas do
  projeto reprovam o resto). Cuidado com nomes de variável que colidam com a cerca de vocabulário
  (`passagem-motivo-em-portugues`).
- **Multi-empresa**: toda leitura/escrita filtra por `organization_id`; rotas com `requireRole` do papel certo.
- **Só B2B / só B2C**: respeita `tipo_de_cliente` quando mexe em Empresa/CNPJ/Segmentos/CPF.
- **Documentação da mudança**: tem fragmento em `.changes/` (impacto: `nada_mudou | capacidade_nova | exige_acao`) e
  teste novo. NÃO deve ter editado `MELHORIAS-POR-VERSAO.md`, `PERSONALIZACOES-DO-FORK.md` nem
  `lib/personalizacoes/melhorias-do-fork.ts` (isso é feito por quem cria a versão, para os números não colidirem).

## 3. Rodar

1. `git checkout -b analise/dev-xxx origin/dev/xxx` (ou o worktree do merge de teste).
2. Conferência de tipos dos arquivos tocados (tsconfig parcial; o completo estoura memória na VPS).
3. `pnpm vitest run` nos arquivos novos/alterados; depois `pnpm test:unit` COMPLETO (~15 min, em background).
4. Se mexeu em `hostgator-setup-kit/` ou `.sh`: `pnpm test:shell < /dev/null`.
5. Falha em teste OFICIAL: entender antes de "consertar". Só ajustar teste oficial quando o comportamento mudou de
   propósito (e registrar qual e por quê).

## 4. O que falta para atualizar o zap (a "porta de saída")

- [ ] Branch sem conflito com a `main` atual (ou conflitos resolvidos e descritos).
- [ ] `pnpm test:unit` completo verde.
- [ ] Mudança de banco testada no banco real com rollback.
- [ ] Numeração: próximo `-glauco.N` e próximo `#` livres; seção nova em `MELHORIAS-POR-VERSAO.md`, linha em
      `PERSONALIZACOES-DO-FORK.md` e em `melhorias-do-fork.ts`.
- [ ] Merge na `main`, tag `vX.Y.Z-glauco.N`, `git push origin main <tag>` (NUNCA em `forkpr`).
- [ ] Esperar as 4 imagens no ghcr (~20 min), `sudo bash hostgator-setup-kit/update.sh --to <tag> < /dev/null`.
- [ ] Depois de instalar: login 200, logs sem erro, `node ~/zap-melhorias-site/gerar.mjs`, medir o que a mudança
      promete (visibilidade por número, etc., se tocou nisso) e avisar o Glauco para testar na tela.
- [ ] Se for dado inicial de uma empresa (ex.: lista da CRTI), inserir como DADO por SQL, nunca no código.

## 5. Relatório final ao Glauco (curto, sem jargão)

1. **Veredito**: "tudo certo", "certo com ajustes" ou "não está pronto".
2. **O que a branch faz** (2 a 4 linhas, no que muda para quem usa).
3. **Problemas encontrados**, cada um com onde está e como corrigir (separar: bloqueia / melhora).
4. **Conflitos** com o que já temos (e com o Deskcomm oficial, se for o caso).
5. **O que falta para atualizar o zap**: a lista da seção 4 marcada, e quanto tempo leva.
6. Pergunta final: "posso juntar, criar a versão e instalar?".

Regra de ouro: o Claude não corrige a branch do outro agente em silêncio. Se o conserto for pequeno e óbvio, faz em
commit separado e conta; se for grande, devolve ao Glauco com a explicação.
