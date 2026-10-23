# Como trabalhar neste projeto (PC do Glauco + VPS do Claude)

O GitHub é o ponto de encontro. Ninguém mexe direto na VPS: tudo passa por ele.

## Regras

1. **Antes de começar qualquer mudança, atualizar**: `git pull`. A VPS faz `git fetch` e confere antes de mexer.
2. **Cada mudança em uma branch**, nunca direto na `main`: `git checkout -b dev/nome-da-mudanca`, depois
   `git push -u origin dev/nome-da-mudanca`. Quem recebe testa e junta na `main`.
3. **Avisar o assunto antes de começar** ("vou mexer no Inbox"). Duas pessoas no mesmo arquivo ao mesmo tempo
   é o que gera conflito; se for o caso, combina-se quem vai primeiro.
4. **A versão (`-glauco.N`) é criada por UM lado de cada vez, o Claude na VPS**: o número da versão e o número do
   item na lista (#32, #33…) são sequenciais e colidem se dois criarem juntos. Quem programa manda a branch
   pronta; o Claude roda a bateria completa, numera, cria a tag, publica as imagens e instala no zap.
5. **Cada mudança leva três coisas**: o código, um teste e um arquivo em `.changes/` (veja os existentes para o
   formato).
6. **Não editar à mão os arquivos de histórico de versões**: `MELHORIAS-POR-VERSAO.md`,
   `PERSONALIZACOES-DO-FORK.md` e `lib/personalizacoes/melhorias-do-fork.ts`. São os que mais dão conflito e são
   atualizados no momento de criar a versão.
7. **Banco de dados**: toda mudança vai em `supabase/personalizacoes.sql` (idempotente, `create or replace` /
   `if not exists`). É aplicado automaticamente pelo `update.sh` depois do baseline.

## No PC, antes do `git push`

- Rode os testes dos arquivos que mexeu: `pnpm vitest run <arquivo ou pasta>`. A bateria completa
  (`pnpm test:unit`, ~15 min) roda na VPS antes de cada versão.
- Confira o `git status`: nunca subir `.env`, chaves, tokens nem dumps do banco.
- `git pull` com conflito? Não force nada (`--force`, `reset --hard`). Pare e peça ajuda.
- Para onde vai o código: `origin` (repositório privado `DeskcommCRM-personalizado`). O remoto `forkpr` é
  público e só serve para propor mudanças ao projeto original; nunca enviar versões para ele.

## Fluxo de uma mudança

1. `git pull` e `git checkout -b dev/algo`.
2. Programar e testar no PC; `git push -u origin dev/algo`.
3. Avisar: "branch dev/algo pronta".
4. A VPS junta, roda todos os testes, cria a versão e instala no zap.
5. Na próxima mudança, recomeçar com `git pull` (já com a versão nova).

## Versões do projeto original (Deskcomm)

Cada versão oficial nova ganha antes um `ANALISE-DA-X.Y.Z.md` (conflitos, sobreposições com as nossas
personalizações e decisão por item) e só depois o merge. Modelo: `ANALISE-DA-1.88.0.md`. Enquanto uma análise
ou merge estiver em andamento na VPS, o PC não deve mexer nos mesmos arquivos (avisar o assunto, regra 3).
