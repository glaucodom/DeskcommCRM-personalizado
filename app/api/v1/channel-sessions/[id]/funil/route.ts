/**
 * Funil de um número conectado (fork #25).
 *
 * GET devolve o funil vinculado (`funil_id`) e a lista de funis vivos da empresa
 * para o seletor; PATCH grava `{ funil_id }` (null = usar o funil padrão da
 * empresa). Mesmo gate das outras ações do cartão do número (admin), escrita pelo
 * admin client com filtro explícito por organização.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: true });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Canal inválido.", 422, { requestId });

  const db = createAdminClient();
  const { data: canal, error } = await db
    .from("channel_sessions")
    .select("id, funil_id")
    .eq("organization_id", auth.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível ler o canal.", 500, { requestId });
  if (!canal) return fail("not_found", "Canal não encontrado.", 404, { requestId });

  const { data: funis } = await db
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", auth.org.orgId)
    .eq("is_archived", false)
    .order("position");
  return ok({ funil_id: canal.funil_id ?? null, funis: funis ?? [] }, { requestId });
}

export async function PATCH(req: NextRequest, { params }: Context): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: true });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Canal inválido.", 422, { requestId });
  const parsed = z.object({ funil_id: z.uuid().nullable() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Confira o funil escolhido.", 422, { requestId });

  const db = createAdminClient();
  const funilId = parsed.data.funil_id;
  if (funilId) {
    const { data: funil } = await db
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", auth.org.orgId)
      .eq("id", funilId)
      .eq("is_archived", false)
      .maybeSingle();
    if (!funil) return fail("not_found", "Funil não encontrado.", 404, { requestId });
  }

  const { data, error } = await db
    .from("channel_sessions")
    .update({ funil_id: funilId })
    .eq("organization_id", auth.org.orgId)
    .eq("id", id)
    .select("id, funil_id")
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível salvar o funil do número.", 500, { requestId });
  if (!data) return fail("not_found", "Canal não encontrado.", 404, { requestId });

  void audit({
    action: "channel.funil_changed",
    actorUserId: auth.user.id,
    organizationId: auth.org.orgId,
    resourceType: "channel_session",
    resourceId: id,
    requestId,
    metadata: { funil_id: funilId },
  });
  return ok(data, { requestId });
}
