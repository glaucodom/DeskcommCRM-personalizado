import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";

/**
 * Fork #23 — PATCH /api/v1/team/[user_id]/funil-padrao
 *
 * O administrador escolhe o funil que "Funis" no menu abre direto para uma
 * pessoa. `pipeline_id: null` volta ao funil padrão da empresa.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ user_id: string }> }) {
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  const { user_id } = await ctx.params;
  const parsed = z
    .object({ pipeline_id: z.string().uuid().nullable() })
    .strict()
    .safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(user_id).success || !parsed.success)
    return fail("validation_error", "Confira o funil escolhido.", 400, { requestId });

  const db = await createClient();
  const pipelineId = parsed.data.pipeline_id;
  if (pipelineId) {
    // O funil tem de ser desta empresa e estar vivo: arquivado não abre quadro.
    const { data: funil, error: funilError } = await db
      .from("crm_pipelines")
      .select("id")
      .eq("id", pipelineId)
      .eq("organization_id", authz.org.orgId)
      .eq("is_archived", false)
      .maybeSingle();
    if (funilError)
      return fail("internal_error", "Não foi possível ler o funil.", 500, { requestId });
    if (!funil) return fail("not_found", "Funil não encontrado.", 404, { requestId });
  }

  const { data, error } = await db
    .from("user_organizations")
    .update({ funil_padrao_id: pipelineId })
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", user_id)
    .is("revoked_at", null)
    .not("accepted_at", "is", null)
    .select("id, user_id, funil_padrao_id")
    .maybeSingle();
  if (error)
    return fail("internal_error", "Não foi possível salvar o funil padrão.", 500, { requestId });
  if (!data) return fail("not_found", "Membro ativo não encontrado.", 404, { requestId });

  void audit({
    action: "team.funil_padrao_changed",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "membership",
    resourceId: data.id,
    requestId,
    metadata: { user_id, pipeline_id: pipelineId },
  });
  return ok(data, { requestId });
}
