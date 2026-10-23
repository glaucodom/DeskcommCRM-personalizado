/**
 * Nome de pessoa do cadastro (personalização do fork): cada palavra começa com letra
 * maiúscula e as ligações ("de", "da", "do", "das", "dos", "e") ficam em minúscula.
 * "glauco SATLER neiva" → "Glauco Satler Neiva"; "maria DA silva" → "Maria da Silva".
 * Mora aqui, fora dos diálogos e do handler, para o merge com o oficial conflitar o mínimo.
 */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Maiúscula na 1ª letra de cada trecho; hífen e apóstrofo também iniciam trecho (Ana-Maria, D'Ávila). */
function capitaliza(palavra: string): string {
  return palavra
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase("pt-BR"));
}

export function nomeProprio(entrada: string): string {
  const palavras = entrada.trim().split(/\s+/).filter(Boolean);
  return palavras
    .map((p, i) => {
      const minuscula = p.toLocaleLowerCase("pt-BR");
      return i > 0 && LIGACOES.has(minuscula) ? minuscula : capitaliza(p);
    })
    .join(" ");
}

/** Para campos opcionais da API: preserva `undefined`/`null` e não mexe em vazio. */
export function nomeProprioOpcional<T extends string | null | undefined>(valor: T): T {
  return (typeof valor === "string" && valor.trim() ? nomeProprio(valor) : valor) as T;
}
