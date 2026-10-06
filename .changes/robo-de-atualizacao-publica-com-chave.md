---
impacto: nada_mudou
secao: alterado
titulo: O robô de atualização do fork publica com chave própria
---

O robô diário que traz a release oficial agora publica com uma chave de deploy (segredo
`ROBO_DEPLOY_KEY`). Antes ele travava sempre que a release oficial alterava arquivos em
`.github/workflows/`, porque a permissão padrão do GitHub não deixa mexer neles.
