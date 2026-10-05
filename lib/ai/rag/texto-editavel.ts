/**
 * QUAL MATERIAL TEM TEXTO PARA VER E EDITAR, E COMO A VERSÃO ANTERIOR É GUARDADA.
 *
 * Só documento cujo arquivo ativo é `.md` ou `.txt` — texto colado entra aqui
 * porque é guardado como `.md` (ver `app/api/v1/ai/knowledge/sources/route.ts`).
 * PDF e CSV ficam de fora: o que a pessoa veria não é o arquivo, é o texto que a
 * extração tirou dele, e salvar isso de volta trocaria o formato do material.
 *
 * O histórico mora em `source_metadata.historico`, e não numa tabela nova: o
 * material já guarda ali o ponteiro do arquivo, e cada versão anterior é só
 * outro ponteiro para um arquivo que continua no bucket. Nada é apagado.
 */

import { canonizarTipoDeFonte } from "@/lib/ai/rag/tipos-de-fonte";

export const EXTENSOES_EDITAVEIS = ["md", "txt"] as const;
export type ExtensaoEditavel = (typeof EXTENSOES_EDITAVEIS)[number];

/** Mesmo teto do envio de arquivo: o texto editado vira um arquivo igual. */
export const TAMANHO_MAXIMO_DO_TEXTO = 20 * 1024 * 1024;

export interface VersaoAnterior {
  versao: number;
  blob_path: string;
  ext: ExtensaoEditavel;
  filename: string | null;
  size_bytes: number | null;
  substituida_em: string;
  substituida_por: string;
}

interface MaterialParaEditar {
  source_type: string;
  source_metadata: Record<string, unknown> | null;
}

export interface ArquivoEditavel {
  blobPath: string;
  ext: ExtensaoEditavel;
  filename: string | null;
}

/**
 * O arquivo que dá para ver e editar, ou `null` quando o material não tem um.
 *
 * O `blob_path` precisa começar pela organização da sessão: o caminho vem da
 * linha do banco, mas a leitura do bucket é feita com o cliente administrativo,
 * que não conhece RLS. Esta é a segunda trava, depois do filtro por organização.
 */
export function arquivoEditavel(
  material: MaterialParaEditar,
  orgId: string,
): ArquivoEditavel | null {
  if (canonizarTipoDeFonte(material.source_type) !== "documento") return null;
  const meta = material.source_metadata ?? {};
  const blobPath = meta.blob_path;
  const ext = typeof meta.ext === "string" ? meta.ext.toLowerCase() : null;
  if (typeof blobPath !== "string" || !blobPath.startsWith(`${orgId}/`)) return null;
  if (blobPath.includes("..")) return null;
  if (!ext || !(EXTENSOES_EDITAVEIS as readonly string[]).includes(ext)) return null;
  const filename = typeof meta.filename === "string" ? meta.filename : null;
  return { blobPath, ext: ext as ExtensaoEditavel, filename };
}

/** A versão em vigor: 1 para quem nunca foi editado. */
export function versaoAtual(meta: Record<string, unknown> | null): number {
  const v = meta?.versao;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}

/**
 * O `source_metadata` depois da edição: aponta para o arquivo novo e acrescenta
 * o anterior ao histórico. Nenhum outro campo é tocado.
 */
export function metadataDaNovaVersao(
  metaAnterior: Record<string, unknown> | null,
  novo: { blobPath: string; sizeBytes: number; mimeType: string },
  quem: string,
  agora: string,
): Record<string, unknown> {
  const meta = metaAnterior ?? {};
  const atual = versaoAtual(meta);
  const historicoAnterior = Array.isArray(meta.historico) ? (meta.historico as unknown[]) : [];
  const anterior: VersaoAnterior = {
    versao: atual,
    blob_path: String(meta.blob_path),
    ext: String(meta.ext).toLowerCase() as ExtensaoEditavel,
    filename: typeof meta.filename === "string" ? meta.filename : null,
    size_bytes: typeof meta.size_bytes === "number" ? meta.size_bytes : null,
    substituida_em: agora,
    substituida_por: quem,
  };
  return {
    ...meta,
    blob_path: novo.blobPath,
    size_bytes: novo.sizeBytes,
    mime_type: novo.mimeType,
    versao: atual + 1,
    editado_em: agora,
    editado_por: quem,
    historico: [...historicoAnterior, anterior],
  };
}
