/**
 * POST /api/v1/tags/vocabulario/criar — cadastra uma etiqueta nova no vocabulário
 * da organização ativa (fork #24). Gerente ou mais, como as outras operações do
 * vocabulário; o portão de verdade é o da função de banco.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { mfaEmDivida } from "@/lib/auth/server";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { corDeEtiquetaSchema, tagSchema } from "@/lib/schemas/tags";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ tag: tagSchema, cor: corDeEtiquetaSchema.nullish() }).strict();

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const requestId = randomUUID();
  const auth = await requireRole("manager", { requestId, resource: "settings_tags" });
  if (!auth.ok) return auth.response;
  if (await mfaEmDivida())
    return fail("mfa_required", "Confirme a verificação em duas etapas.", 403, { requestId });

  const parsed = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return fail("validation_failed", "Confira o nome e a cor da etiqueta.", 422, { requestId });

  const db = await createClient();
  const { data, error } = await db.rpc("fn_vocabulario_de_tags_criar", {
    p_org: auth.org.orgId,
    p_tag: parsed.data.tag,
    p_cor: parsed.data.cor ?? null,
  });
  if (error) {
    if (error.code === "42501")
      return fail("forbidden", "Esta sessão não pode mudar as etiquetas da organização.", 403, { requestId });
    if (error.code === "22023")
      return fail("validation_failed", "Confira o nome e a cor da etiqueta.", 422, { requestId });
    return fail("internal_error", "Não foi possível criar a etiqueta.", 500, { requestId });
  }

  const resultado = (data ?? {}) as { criou?: boolean; tag?: string };
  if (resultado.criou) {
    void audit({
      action: "tag_vocabulary.changed",
      actorUserId: auth.user.id,
      organizationId: auth.org.orgId,
      resourceType: "organization",
      resourceId: auth.org.orgId,
      requestId,
      metadata: { acao: "criar", tag: parsed.data.tag, cor: parsed.data.cor ?? null },
    });
  }
  return ok({ criou: resultado.criou === true, tag: resultado.tag ?? parsed.data.tag }, { requestId });
}
