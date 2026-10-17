---
impacto: nada_mudou
secao: alterado
titulo: As instruções do agente de IA vão até 50.000 caracteres
---

O teto das instruções de cada versão de agente subiu de 20.000 para 50.000 caracteres,
na tela (contador e aviso) e no servidor. O valor fica em um lugar só,
`lib/ai/agents/limite-das-instrucoes.ts`. O banco não tinha limite próprio, então não há
migração.
