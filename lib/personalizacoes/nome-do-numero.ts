/**
 * Nome do número (personalização do fork): o rótulo que aparece no inbox e em
 * Conexões no lugar dos dígitos. Espaços sobrando saem, vazio vira "sem nome"
 * (null — a tela volta a mostrar o número) e o tamanho tem teto, porque o nome
 * vai num selo estreito da lista de conversas.
 */
export const TETO_DO_NOME_DO_NUMERO = 40;

export function normalizarNomeDoNumero(bruto: string | null | undefined): string | null {
  const nome = (bruto ?? "").replace(/\s+/g, " ").trim().slice(0, TETO_DO_NOME_DO_NUMERO).trim();
  return nome === "" ? null : nome;
}
