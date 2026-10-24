# 10 — Margem e largura do conteúdo das telas

> **Regra do Glauco (23/10/2026):** toda tela de `/app` usa a margem da tela de **Funil**. É padronização:
> o conteúdo ocupa a área inteira do `main`, alinhado à esquerda com o seletor de organização e à
> direita com o botão do usuário, em qualquer tamanho de monitor.

## A regra

1. **Quem dá a margem é o `main`**, uma vez só: `p-4` no celular e `sm:p-6` (24 px) do `sm` para cima
   (`app/app/_components/AppShell.tsx`). O cabeçalho (`TopBar`) usa a mesma distância, e é por isso que as
   bordas coincidem.
2. **O wrapper da tela é `w-full`** e nada mais na horizontal. Sem `mx-auto`, sem `max-w-*`, sem `p-*`
   nem `px-*` próprios. Padding do wrapper soma com o do `main` e empurra o conteúdo para dentro do
   seletor de organização (era o defeito do hub CRM: 48 px em vez de 24 px).
3. **Espaço vertical entre blocos** vai em `gap-*` / `space-y-*` do wrapper, nunca em padding lateral.
4. **Largura:** ocupa tudo o que o `main` oferece. Em monitor grande o conteúdo estica; em monitor
   pequeno encolhe. O que não pode é a tela parar numa largura fixa no meio.
5. **Celular:** o mesmo wrapper, com a margem de 16 px do `main`. Sem rolagem horizontal.

```tsx
// Certo — igual ao Funil
<div className="flex w-full flex-col gap-6">…</div>

// Errado — largura presa e padding duplicado
<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">…</div>
```

## Como conferir (medido no navegador)

Com a janela em 1536 px de largura e o menu aberto: seletor de organização em `x = 264`, botão do
usuário terminando em `x = 1512`, e o wrapper da tela de `264` a `1512`. O `h1` da tela começa em `264`.
Se começar em `288`, a tela tem padding próprio; se o wrapper for mais estreito que `1248`, tem `max-w`.

## Exceções (só com o aval do Glauco)

- Telas que já ocupam a altura toda por serem painéis (Inbox, quadro do Funil): têm a própria
  estrutura e já começam em `264`.
- Texto longo de leitura (por exemplo, a política de privacidade) pode precisar de uma largura de
  leitura. Se aparecer um caso, perguntar antes de limitar.

## Telas já no padrão

| Tela | Situação |
|---|---|
| Funil (quadro) | referência |
| Hubs (`NavHub`: CRM, IA, Análise) | padronizada |
| Tarefas | padronizada |
| Propostas (lista e detalhe) | padronizada |
| Segmentos (`/app/segmentos`) | padronizada em 23/10/2026 (era `max-w-2xl` centralizado + `p-4`) |

As demais telas entram nesta tabela conforme o Glauco for pedindo o ajuste, uma por vez ou em grupo.
