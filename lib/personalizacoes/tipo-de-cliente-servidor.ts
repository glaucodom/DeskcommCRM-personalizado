/**
 * Lado servidor do tipo de cliente (fork #20): a organização ATIVA da sessão atende pessoas?
 *
 * Usado para recusar as rotas e telas de Empresas/Pessoas (B2B) numa organização B2C, mesmo
 * com o módulo `crm_b2b` ligado na instalação. Sem sessão ou sem org ativa devolve `false`:
 * quem decide o 401/403 é o `requireRole` da própria rota, não este helper.
 */
import { loadAuthUser, orgAtivaSemPortao } from "@/lib/auth/server";
import { ehPessoas } from "@/lib/personalizacoes/tipo-de-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

export async function orgAtivaAtendePessoas(): Promise<boolean> {
  try {
    const user = await loadAuthUser();
    const org = user ? await orgAtivaSemPortao(user) : null;
    if (!org) return false;
    const { data } = await createAdminClient()
      .from("organizations")
      .select("settings")
      .eq("id", org.orgId)
      .maybeSingle();
    return ehPessoas(data?.settings as Record<string, unknown> | null);
  } catch {
    return false;
  }
}
