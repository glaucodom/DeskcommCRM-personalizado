---
impacto: nada_mudou
secao: corrigido
titulo: Duas atualizações não rodam mais ao mesmo tempo
---

O `update.sh` agora usa a mesma trava do botão "Atualizar agora". Se uma atualização já está
rodando (pela tela ou por outro terminal), uma segunda é recusada com uma mensagem clara em vez
de tratar o aviso de manutenção da primeira como "preso", derrubá-lo e correr em paralelo — o
que deixava o CRM fora do ar até as duas terminarem.
