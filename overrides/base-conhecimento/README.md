# Base de Conhecimento: ver e editar texto (.md/.txt)

Customização deste fork. Detalhes da melhoria em `MELHORIAS-base-conhecimento.md`.

**Não é patch em arquivo compilado.** A mudança está no código-fonte, versionada no
git. Por isso não há script de aplicação nem chunk para purgar: a cada atualização,
o robô `sincronizar-upstream.yml` junta a release oficial com este código, roda os
testes e gera as imagens. Se o upstream mexer nos mesmos arquivos, o merge para com
conflito e a `main` não muda.

## Passo a passo

1. **Versão em produção:** `curl -s https://zap.crtierp.com.br/api/v1/health` (campo `version` = commit do fork).
2. **Testes locais:** `pnpm vitest run tests/unit/base-conhecimento-ver-e-editar-texto.test.tsx "app/api/v1/ai/knowledge/sources/[id]/texto.route.test.ts"`
3. **Instalar uma imagem nova:** pegar o digest de `ghcr.io/glaucodom/deskcommcrm:main` e de `deskcomm-worker:main`, backup do `.env`, trocar `APP_IMAGE`/`WORKER_IMAGE` pelo digest e rodar
   `docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env up -d app worker`
   (só app e worker; nunca WAHA, banco ou Redis).
4. **Cache:** os arquivos estáticos do Next têm nome por build, então não há chunk antigo a purgar no Cloudflare. Se a tela parecer antiga, Ctrl+Shift+R.
5. **Teste de ponta a ponta** (cria, edita, confere e arquiva um material temporário):
   `docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml exec -T -e ORG_ID=<org> app node --input-type=module - < overrides/base-conhecimento/teste-editar-texto.mjs`
6. **Rollback:** restaurar o backup do `.env` (`/root/deskcomm-env-antes-*.bak`) e repetir o `up -d app worker`.
