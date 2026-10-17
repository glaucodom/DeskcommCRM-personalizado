---
impacto: nada_mudou
secao: corrigido
titulo: O agente confirma o agendamento que acabou de marcar
---

Depois de marcar pela agenda, a confirmação ao cliente ("está agendado para segunda às 13h, o
link chega aqui no WhatsApp") era barrada pela revisão de promessas, que só olhava a base de
conhecimento, e o cliente ficava sem resposta. Agora o compromisso gravado neste atendimento
serve de prova para confirmar esse mesmo compromisso, dito como reservado quando ainda falta a
equipe aprovar. O motivo de cada mensagem barrada também passa a ficar registrado (o trecho
apontado, curto) em `before_send_traces`, para diagnóstico.
