/**
 * VISIBILIDADE POR NÚMERO (personalização do fork).
 *
 * Com `organizations.settings.visibilidade_por_numero = true`, o atendente
 * (papel `agent`) só vê os números em que está marcado em "Responsáveis por
 * número". A regra das CONVERSAS mora no banco (`supabase/personalizacoes.sql`,
 * política restritiva `conversations_select_pelo_numero`); aqui fica só o que o
 * app precisa: ler a chave e filtrar a lista de números pela MESMA função do
 * banco (`fn_canal_visivel_pelo_numero`), para tela e banco nunca divergirem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAVE_VISIBILIDADE_POR_NUMERO = "visibilidade_por_numero";

export function visibilidadePorNumeroLigada(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.[CHAVE_VISIBILIDADE_POR_NUMERO] === true;
}

/**
 * Filtra a lista de números pelo que o usuário logado pode ver. Só pergunta ao
 * banco quando o papel é `agent` — os outros papéis nunca são restringidos.
 * Se o banco não responder (função ausente, erro), devolve a lista inteira: a
 * lista de números é conveniência, quem protege as conversas é a RLS.
 */
export async function filtrarCanaisVisiveis<T extends { id: string }>(
  supabase: SupabaseClient,
  orgId: string,
  role: string | null | undefined,
  canais: T[],
): Promise<T[]> {
  if (role !== "agent" || canais.length === 0) return canais;
  const respostas = await Promise.all(
    canais.map((c) =>
      supabase.rpc("fn_canal_visivel_pelo_numero", { p_org: orgId, p_canal: c.id }),
    ),
  );
  if (respostas.some((r) => r.error)) return canais;
  return canais.filter((_, i) => respostas[i]!.data !== false);
}
