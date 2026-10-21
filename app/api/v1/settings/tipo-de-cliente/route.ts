/**
 * Tipo de cliente da organização (personalização do fork #20): "empresas" (B2B, padrão) ou
 * "pessoas" (B2C). Grava `organizations.settings.tipo_de_cliente`. Ler: qualquer membro (as
 * telas de contato precisam saber). Trocar: só administrador. Mesmo caminho de escrita de
 * `settings/visibilidade-por-numero` (admin client com filtro explícito por organização).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  CHAVE_TIPO_DE_CLIENTE,
  ehTipoDeCliente,
  tipoDeCliente,
} from "@/lib/personalizacoes/tipo-de-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "settings_tipo_de_cliente" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const settings = (data?.settings as Record<string, unknown> | null) ?? {};
  return ok({ tipo: tipoDeCliente(settings) }, { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "settings_tipo_de_cliente" });
  if (!authz.ok) return authz.response;
  const { user, org } = authz;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Corpo inválido.", 400, { requestId });
  }
  const tipo = (body as { tipo?: unknown } | null)?.tipo;
  if (!ehTipoDeCliente(tipo)) {
    return fail("validation_error", 'Informe tipo: "empresas" ou "pessoas".', 400, { requestId });
  }

  const supabase = createAdminClient();
  const { data, error: readErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", org.orgId)
    .maybeSingle();
  if (readErr) return fail("internal_error", readErr.message, 500, { requestId });

  const atual = (data?.settings as Record<string, unknown> | null) ?? {};
  const { error: updErr } = await supabase
    .from("organizations")
    .update({ settings: { ...atual, [CHAVE_TIPO_DE_CLIENTE]: tipo } })
    .eq("id", org.orgId);
  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  void audit({
    action: "settings.tipo_de_cliente_changed",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "organization",
    resourceId: org.orgId,
    requestId,
    metadata: { [CHAVE_TIPO_DE_CLIENTE]: tipo },
  });

  return ok({ tipo }, { requestId });
}
