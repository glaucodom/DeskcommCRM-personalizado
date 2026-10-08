/**
 * Liga/desliga a "visibilidade por número" (personalização do fork).
 *
 * Grava `organizations.settings.visibilidade_por_numero`, a chave que a política
 * restritiva `conversations_select_pelo_numero` lê (supabase/personalizacoes.sql).
 * Mesmo gate e mesmo caminho de escrita de `settings/routing`: papel manager+ e
 * admin client com filtro explícito por organização (a policy de escrita de
 * organizations só deixa o platform admin escrever pela sessão).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  CHAVE_VISIBILIDADE_POR_NUMERO,
  visibilidadePorNumeroLigada,
} from "@/lib/personalizacoes/visibilidade-por-numero";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_routing" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const settings = (data?.settings as Record<string, unknown> | null) ?? {};
  return ok({ ligada: visibilidadePorNumeroLigada(settings) }, { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_routing" });
  if (!authz.ok) return authz.response;
  const { user, org } = authz;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Corpo inválido.", 400, { requestId });
  }
  const ligada = (body as { ligada?: unknown } | null)?.ligada;
  if (typeof ligada !== "boolean") {
    return fail("validation_error", "Informe ligada: true ou false.", 400, { requestId });
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
    .update({ settings: { ...atual, [CHAVE_VISIBILIDADE_POR_NUMERO]: ligada } })
    .eq("id", org.orgId);
  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  void audit({
    action: "routing.config_changed",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "organization",
    resourceId: org.orgId,
    requestId,
    metadata: { [CHAVE_VISIBILIDADE_POR_NUMERO]: ligada },
  });

  return ok({ ligada }, { requestId });
}
