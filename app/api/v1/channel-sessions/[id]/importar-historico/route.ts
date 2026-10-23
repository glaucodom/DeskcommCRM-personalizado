/**
 * Importar histórico para o CRM (fork #30).
 *
 * GET devolve o andamento (prévia, progresso ou resumo). POST `{ acao: "analisar" | "importar" }`
 * dispara o trabalho em segundo plano. Só administrador; só número com "Guardar o histórico" ligado.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { lerGuardarHistorico } from "@/lib/channels/acervo-do-historico";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { iniciarImportacao, lerEstadoDaImportacao } from "@/lib/waha/importar-historico";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: "leitura" });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Canal inválido.", 422, { requestId });
  const estado = await lerEstadoDaImportacao(createAdminClient(), auth.org.orgId, id);
  return ok({ estado }, { requestId });
}

export async function POST(req: NextRequest, { params }: Context): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: true });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Canal inválido.", 422, { requestId });
  const parsed = z.object({ acao: z.enum(["analisar", "importar"]) }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Pedido inválido.", 422, { requestId });

  const db = createAdminClient();
  const { data: canal } = await db
    .from("channel_sessions")
    .select("id, organization_id, waha_session_name, provider, status, metadata")
    .eq("organization_id", auth.org.orgId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!canal) return fail("not_found", "Canal não encontrado.", 404, { requestId });
  if (canal.provider !== "waha" || !canal.waha_session_name) {
    return fail("validation_failed", "A importação vale só para números conectados por QR.", 422, { requestId });
  }
  if (!lerGuardarHistorico(canal.metadata)) {
    return fail("validation_failed", "Ligue “Guardar o histórico” neste número antes de importar.", 422, { requestId });
  }
  if (canal.status !== "WORKING") {
    return fail("conflict", "O número precisa estar conectado para importar o histórico.", 409, { requestId });
  }

  const r = await iniciarImportacao(
    db,
    { id: canal.id, organization_id: canal.organization_id, waha_session_name: canal.waha_session_name, metadata: canal.metadata },
    parsed.data.acao,
  );
  if (!r.iniciou) {
    return r.motivo === "ja_rodando"
      ? fail("conflict", "Já há uma importação em andamento neste número.", 409, { requestId })
      : fail("service_unavailable", "O servidor do canal não está disponível.", 503, { requestId });
  }
  void audit({
    action: "channel.history_import_started",
    actorUserId: auth.user.id,
    organizationId: auth.org.orgId,
    resourceType: "channel_session",
    resourceId: id,
    requestId,
    metadata: { acao: parsed.data.acao },
  });
  return ok({ iniciou: true }, { requestId, status: 201 });
}
