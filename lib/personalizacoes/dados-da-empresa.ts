import { normalizeCnpj } from "@/lib/crm-b2b/normalize";

/**
 * Dados da empresa do contato (personalização do fork): o foco da CRTI é empresa, não
 * pessoa física. Empresa, CNPJ e segmentos são preenchidos pelo atendente direto no
 * painel do Inbox e no "Novo Lead" (que não pede mais valor).
 */
/** "12345678000199" -> "12.345.678/0001-99", enquanto digita. */
export function mascaraCnpj(entrada: string): string {
  const d = entrada.replace(/\D/g, "").slice(0, 14);
  let s = d.slice(0, 2);
  if (d.length > 2) s += `.${d.slice(2, 5)}`;
  if (d.length > 5) s += `.${d.slice(5, 8)}`;
  if (d.length > 8) s += `/${d.slice(8, 12)}`;
  if (d.length > 12) s += `-${d.slice(12)}`;
  return s;
}

/** Vazio é permitido (campo opcional); preenchido precisa ser um CNPJ de 14 números. */
export function cnpjVazioOuValido(valor: string): boolean {
  return valor.trim() === "" || normalizeCnpj(valor) !== null;
}

export function segmentosDeTexto(texto: string): string[] {
  return [...new Set(texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean))];
}
