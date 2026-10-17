/**
 * Personalização do fork: teto das instruções (system_prompt) de uma versão de
 * agente. O oficial usa 20.000; aqui é 50.000 para caber o roteiro comercial
 * completo sem cortar regra. Um lugar só, lido pelo servidor (validation.ts) e
 * pela tela (AgentForm) — duas réguas diferentes barrariam na tela um texto
 * que o servidor aceita. O banco não tem limite próprio para essa coluna.
 */
export const LIMITE_DAS_INSTRUCOES = 50_000;
