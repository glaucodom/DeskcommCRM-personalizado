/**
 * Segmentos cadastrados por empresa (personalização #32 do fork). A lista mora em
 * `organizations.settings.segmentos_cadastrados` e é de CADA empresa: a mesma versão roda em
 * várias, então nenhuma lista vem no código. Só vale para organização B2B ("empresas").
 */
export const CHAVE_DOS_SEGMENTOS = "segmentos_cadastrados";
export const TAMANHO_MAXIMO_DO_SEGMENTO = 80;
export const MAXIMO_DE_SEGMENTOS = 200;

/** Para comparar sem acento, caixa nem espaço repetido: "Construção  Pesada" = "construcao pesada". */
export function chaveDoSegmento(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Texto limpo (espaços corridos) ou `null` se vazio ou grande demais. */
export function nomeDeSegmentoValido(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const nome = bruto.replace(/\s+/g, " ").trim();
  if (nome.length === 0 || nome.length > TAMANHO_MAXIMO_DO_SEGMENTO) return null;
  return nome;
}

/** Lê o que está salvo em `settings` (qualquer coisa que não seja lista de textos vira lista vazia). */
export function segmentosDasConfiguracoes(settings: unknown): string[] {
  if (!settings || typeof settings !== "object") return [];
  const bruto = (settings as Record<string, unknown>)[CHAVE_DOS_SEGMENTOS];
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of bruto) {
    const nome = nomeDeSegmentoValido(item);
    if (!nome || vistos.has(chaveDoSegmento(nome))) continue;
    vistos.add(chaveDoSegmento(nome));
    out.push(nome);
  }
  return out;
}

/** O nome cadastrado que corresponde ao texto (sem acento nem caixa), ou `null`. */
export function segmentoDaLista(lista: readonly string[], texto: string): string | null {
  const chave = chaveDoSegmento(texto);
  return lista.find((s) => chaveDoSegmento(s) === chave) ?? null;
}
