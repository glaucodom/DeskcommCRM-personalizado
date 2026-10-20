---
impacto: nada_mudou
secao: adicionado
titulo: O teste do agente aceita a conversa até aqui
---

A rota de teste do agente (`POST /api/v1/ai/agents/:id/versions/:vid/test`) aceita um campo opcional
`sample_history` com as falas anteriores da conversa. Assim dá para testar o agente turno a turno,
como no WhatsApp, em vez de uma mensagem solta. Sem o campo, nada muda.
