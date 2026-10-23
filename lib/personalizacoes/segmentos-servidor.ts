import { createAdminClient } from "@/lib/supabase/admin";
import { segmentosDasConfiguracoes } from "@/lib/personalizacoes/segmentos";

/** Lista de segmentos cadastrados da empresa (vazia se nunca cadastrou nenhum). */
export async function segmentosCadastrados(organizationId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  return segmentosDasConfiguracoes(data?.settings);
}
