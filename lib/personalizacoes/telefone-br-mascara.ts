/**
 * Telefone e e-mail do cadastro de contato (personalização do fork): a CRTI atende só
 * empresas do Brasil, então o campo já nasce com "+55" e vai se formatando enquanto se
 * digita ("+55 (41) 99999-8888"). Na gravação volta a ser E.164 ("+5541999998888"),
 * que é o que a API exige. Mora aqui, fora dos diálogos, para o merge com o oficial
 * conflitar o mínimo.
 */
import { phoneForDisplay } from "@/lib/channels/phone-variants";

export const TELEFONE_BR_INICIAL = "+55 ";

/** Aceita digitação, colagem e valor já gravado ("+5541999998888", "41 99999-8888"). */
export function mascaraTelefoneBr(entrada: string): string {
  let d = entrada.replace(/\D/g, "");
  // O "+55" já está fixo no campo: tira ele de quem colou o número completo.
  if (d.startsWith("55") && (entrada.trim().startsWith("+") || d.length > 11)) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return TELEFONE_BR_INICIAL;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length <= 2) return `+55 (${ddd}`;
  const corte = d.length > 10 ? 5 : 4; // celular (9 dígitos) ou fixo (8)
  const parte1 = resto.slice(0, corte);
  const parte2 = resto.slice(corte);
  return `+55 (${ddd}) ${parte1}${parte2 ? `-${parte2}` : ""}`;
}

/** Só o "+55 " e mais nada: a pessoa não preencheu o telefone. */
export function telefoneBrVazio(valor: string | undefined): boolean {
  return !valor || valor.replace(/\D/g, "").replace(/^55/, "") === "";
}

/** E.164 se o número está completo (DDD + 8 ou 9 dígitos); senão `null`. */
export function telefoneBrParaE164(valor: string): string | null {
  const d = valor.replace(/\D/g, "").replace(/^55/, "");
  return /^[1-9]\d{9,10}$/.test(d) ? `+55${d}` : null;
}

const EMAIL_RX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export function emailValido(valor: string): boolean {
  return EMAIL_RX.test(valor.trim());
}

/**
 * Exibição (fork #29): "+55 (41) 99999-8888", ou "+55 (41) 3333-4444" no fixo. Número de outro país,
 * ou que não é de gente, volta como `phoneForDisplay` devolve. Só tela: o que se grava continua E.164.
 */
export function telefoneNaTela(raw: string | null | undefined): string {
  const base = phoneForDisplay(raw);
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(base.replace(/[\s()-]/g, ""));
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : base;
}
