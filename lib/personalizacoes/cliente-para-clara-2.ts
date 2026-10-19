import type pg from "pg";

/**
 * Cliente vai para a Clara 2 (personalização do fork). A Clara 1 etiqueta o
 * contato como cliente; a partir daí o roteador entrega a conversa ao membro
 * cuja intenção se chama `INTENCAO_DO_CLIENTE`, sem passar pelo classificador.
 * A etiqueta vale para o contato inteiro: quem volta semanas depois já cai
 * direto na Clara 2. Tirar a etiqueta devolve o contato ao roteamento normal.
 */
export const ETIQUETA_DE_CLIENTE = "cliente";
export const INTENCAO_DO_CLIENTE = "cliente_crti";

export function temEtiquetaDeCliente(etiquetas: readonly string[] | null | undefined): boolean {
  return (etiquetas ?? []).some((e) => e.trim().toLowerCase() === ETIQUETA_DE_CLIENTE);
}

/** Falha aberta: sem leitura das etiquetas o turno segue pela régua de sempre. */
export async function contatoEhCliente(db: pg.Pool, tenantId: string, contatoId: string): Promise<boolean> {
  try {
    const { rows } = await db.query<{ tags: string[] | null }>(
      "select tags from contacts where organization_id = $1 and id = $2",
      [tenantId, contatoId],
    );
    return temEtiquetaDeCliente(rows[0]?.tags);
  } catch {
    return false;
  }
}
