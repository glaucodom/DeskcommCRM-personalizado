---
impacto: capacidade_nova
secao: alterado
titulo: O menu Funis abre direto o funil padrão de cada pessoa
---

Quem clica em "Funis" no menu cai direto no quadro do seu funil padrão, em vez de escolher o funil toda
vez. O administrador define o funil de cada pessoa em Equipe (coluna "Funil padrão"); sem escolha, abre o
funil marcado como padrão da empresa ("Tornar padrão"). A lista com todos os funis continua a um clique:
link "Todos os funis" no cabeçalho do quadro, e `/app/kanban?todos=1`. Links que já levam parâmetros (como
`?lead=`) seguem abrindo a lista. Com mais de um funil, o nome do funil no topo do quadro continua sendo o
seletor para trocar de funil. Nova coluna `user_organizations.funil_padrao_id` (aplicada pelo kit).
