/**
 * Renomear um número conectado (personalização do fork).
 *
 * O nome (`channel_sessions.display_name`) é o que aparece no inbox e em
 * Conexões no lugar dos dígitos ("Comercial", "Financeiro"). A versão oficial só
 * o grava na criação da conexão; aqui ele muda a qualquer momento. Mesmo gate
 * das outras ações do cartão (admin), escrita pelo admin client com filtro
 * explícito por organização.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { normalizarNomeDoNumero } from "@/lib/personalizacoes/nome-do-numero";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Context): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: true });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Canal inválido.", 422, { requestId });
  const parsed = z.object({ display_name: z.string().nullable() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Informe o nome do número.", 422, { requestId });
  const nome = normalizarNomeDoNumero(parsed.data.display_name);

  const { data, error } = await createAdminClient()
    .from("channel_sessions")
    .update({ display_name: nome })
    .eq("organization_id", auth.org.orgId)
    .eq("id", id)
    .select("id, display_name")
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Canal não encontrado.", 404, { requestId });

  void audit({
    action: "channel.renamed",
    actorUserId: auth.user.id,
    organizationId: auth.org.orgId,
    resourceType: "channel_session",
    resourceId: id,
    requestId,
    metadata: { renomeado_para: nome },
  });
  return ok(data, { requestId });
}
