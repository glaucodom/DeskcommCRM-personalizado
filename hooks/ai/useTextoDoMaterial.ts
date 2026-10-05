"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { canonizarTipoDeFonte } from "@/lib/ai/rag/tipos-de-fonte";

export interface ConteudoDoMaterial {
  texto: string;
  nome: string;
  filename: string | null;
  ext: "md" | "txt";
  blob_path: string;
  versao: number;
}

export interface TextoSalvo {
  id: string;
  versao: number;
  blob_path: string;
  salvo_em: string;
}

/** Só documento em .md/.txt tem texto para ver e editar (mesma regra do servidor). */
export function temTextoEditavel(source: Pick<SourceRow, "source_type" | "source_metadata">) {
  const tipo = canonizarTipoDeFonte(source.source_type);
  const ext = String(source.source_metadata?.ext ?? "").toLowerCase();
  return tipo === "documento" && (ext === "md" || ext === "txt");
}

/**
 * O texto do arquivo ativo. Sem cache entre aberturas (`gcTime: 0`): quem abre o
 * editor precisa da versão de agora, não da que estava na tela há dez minutos.
 */
export function useTextoDoMaterial(sourceId: string, aberto: boolean) {
  return useQuery({
    queryKey: ["ai", "knowledge", "texto", sourceId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { conteudo: ConteudoDoMaterial } }>(
        `/api/v1/ai/knowledge/sources/${sourceId}?conteudo=1`,
      );
      return res.data.conteudo;
    },
    enabled: aberto,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}

export async function salvarTextoDoMaterial(
  sourceId: string,
  texto: string,
  blobPathAtual: string,
): Promise<TextoSalvo> {
  const res = await apiClient.patch<{ data: TextoSalvo }>(
    `/api/v1/ai/knowledge/sources/${sourceId}`,
    { texto, blob_path_atual: blobPathAtual },
  );
  return res.data;
}

export async function lerMaterial(sourceId: string): Promise<SourceRow> {
  const res = await apiClient.get<{ data: SourceRow }>(`/api/v1/ai/knowledge/sources/${sourceId}`);
  return res.data;
}

export async function pedirReindexacao(sourceId: string): Promise<void> {
  await apiClient.post(`/api/v1/ai/knowledge/sources/${sourceId}/reindex`, {});
}

export type EstadoDaPreparacao = "pronto" | "falhou" | "aguardando";

/**
 * O material já foi preparado com o texto salvo? Só conta indexação que terminou
 * DEPOIS do salvamento: a anterior ainda tem os trechos do texto antigo.
 */
export function estadoDaPreparacao(
  material: Pick<SourceRow, "last_index_status" | "last_indexed_at" | "last_index_error">,
  salvoEm: string,
): EstadoDaPreparacao {
  if (material.last_index_status === "failed" || material.last_index_status === "sem_credencial") {
    return "falhou";
  }
  const preparadoDepois =
    material.last_indexed_at !== null &&
    new Date(material.last_indexed_at).getTime() >= new Date(salvoEm).getTime();
  return material.last_index_status === "success" && preparadoDepois ? "pronto" : "aguardando";
}
