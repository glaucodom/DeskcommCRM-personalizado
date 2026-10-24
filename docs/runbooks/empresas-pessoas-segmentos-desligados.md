# Empresas, Pessoas e Segmentos não abrem (404)

> Fork do Glauco. Sintoma mais comum num banco novo (dev local, instalação nova): `/app/segmentos`,
> `/app/companies` e `/app/people` respondem 404 ou não carregam.

## Em uma frase

Empresas, Pessoas e Segmentos são **um módulo só** (`crm_b2b`), da **instalação**, e ele vem
**desligado**. Desligado, as telas e as rotas respondem 404 de propósito. Não é erro de código.

## Como ligar (um clique)

1. Entre como **administrador da plataforma**.
2. **Configurações › Organização**, cartão **Tipo de cliente**. Com "Meus clientes são **Empresas (B2B)**" o
   cartão mostra se o módulo está ligado.
3. Desligado: botão **Ligar agora**. Recarrega a tela e o menu passa a mostrar Empresas, Pessoas e Segmentos.

Quem não é administrador da plataforma vê "Peça a quem administra o servidor para ligar." e não tem botão.

Caminhos alternativos (mesma chave, mesmo action):
- **Administração › Recursos opcionais** (`/admin/sistema#modulo-crm-b2b`): interruptor "Empresas e pessoas
  (venda para empresas)".
- **Configurações › Recursos opcionais**: é só um mapa de leitura; para o administrador da plataforma, o
  módulo desligado ganha o botão **Ajustar**, que leva à Administração.

Ligar vale para **todas as organizações** da instalação e fica auditado.

## Como diagnosticar

| O que olhar | Como | O que significa |
|---|---|---|
| Log do servidor | `GET /api/v1/segmentos 404` (ou `/api/v1/companies`) | módulo desligado, ou organização B2C |
| Tipo de cliente da org | `select settings->>'tipo_de_cliente' from organizations;` | `pessoas` (B2C) esconde as telas mesmo com o módulo ligado; `null` ou `empresas` = B2B |
| Chave do módulo | `select chave, valor from platform_config where chave = 'MODULO_CRM_B2B';` | sem linha = desligado (padrão); `ligado` = ligado |

Os dois motivos de 404 estão em `seModuloB2bDesligado` (`lib/crm-b2b/route-helpers.ts`): módulo desligado **ou**
organização B2C. A tela passa pelo mesmo teste em `app/app/companies/layout.tsx`.

## Mapa do código

| Peça | Arquivo |
|---|---|
| Nome da chave e lista de módulos por flag | `lib/instalacao/modulos.ts` (`crm_b2b` → `MODULO_CRM_B2B`) |
| Quem liga/desliga (administrador da plataforma, auditado) | `app/actions/settings/updateModuloDaInstalacao.ts` |
| Botão "Ligar agora" | `app/app/settings/tenant/_tipo-de-cliente-form.tsx`, alimentado por `app/app/settings/tenant/page.tsx` |
| Interruptor da Administração | `app/admin/(protected)/sistema/_form.tsx` |
| Atalho "Ajustar" nos Recursos opcionais | `app/app/settings/recursos/page.tsx` |
| Teste | `tests/unit/ligar-empresas-e-pessoas.test.tsx` |

## Em banco novo

O baseline não cria a linha `MODULO_CRM_B2B`; é por isso que todo banco novo começa desligado. Se quiser o
dev já ligado, grave `insert into platform_config (chave, valor) values ('MODULO_CRM_B2B', 'ligado')
on conflict (chave) do update set valor = 'ligado';` (equivale a clicar em Ligar agora, sem auditoria).
