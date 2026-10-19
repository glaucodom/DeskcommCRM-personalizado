---
impacto: capacidade_nova
secao: adicionado
titulo: Contato com a etiqueta "cliente" é atendido pelo agente de clientes
---

O roteador de intenções ganha um degrau antes da classificação: se o contato tem a etiqueta
`cliente` e o roteador tem um membro com a intenção `cliente_crti`, a conversa vai direto para o
agente desse membro, sem chamar o classificador nem o Jev. A etiqueta vale para o contato
inteiro, então quem volta depois já cai no agente de clientes. Sem a etiqueta, sem o membro ou
com o agente sem versão publicada, o roteamento segue como antes.
