/**
 * Segmentos cadastrados da empresa (fork #32).
 *
 * GET (atendente em diante): a lista, com quantos contatos usam cada um.
 * POST/PATCH/DELETE (gerente em diante): adicionar, renomear (muda também nos contatos) e tirar da
 * lista (os contatos mantêm o que já têm). Só existe para empresa B2B com o módulo CRM B2B ligado.
 */
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { fail, handleRouteError, ok, requestIdOf, seModuloB2bDesligado } from "@/lib/crm-b2b/route-helpers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  chaveDoSegmento,
  MAXIMO_DE_SEGMENTOS,
  nomeDeSegmentoValido,
} from "@/lib/personalizacoes/segmentos";
import { segmentosCadastrados } from "@/lib/personalizacoes/segmentos-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function gravar(orgId: string, lista: string[]): Promise<void> {
  const { error } = await createAdminClient().rpc("fn_segmentos_salvar" as never, {
    p_org: orgId,
    p_lista: lista,
  } as never);
  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);
  const desligado = await seModuloB2bDesligado(requestId);
  if (desligado) return desligado;
  const authz = await requireRole("agent", { requestId, resource: "segmentos" });
  if (!authz.ok) return authz.response;
  try {
    const orgId = authz.org.orgId;
    const lista = await segmentosCadastrados(orgId);
    const { data } = await createAdminClient().rpc("fn_segmentos_uso" as never, { p_org: orgId } as never);
    const usos = new Map<string, number>();
    for (const l of (data ?? []) as Array<{ nome: string; usos: number | string }>) {
      usos.set(chaveDoSegmento(l.nome), (usos.get(chaveDoSegmento(l.nome)) ?? 0) + Number(l.usos));
    }
    return ok(
      lista.map((nome) => ({ nome, usos: usos.get(chaveDoSegmento(nome)) ?? 0 })),
      { requestId },
    );
  } catch (e) {
    return handleRouteError(e, requestId);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);
  const desligado = await seModuloB2bDesligado(requestId);
  if (desligado) return desligado;
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const authz = await requireRole("manager", { requestId, resource: "segmentos" });
  if (!authz.ok) return authz.response;
  try {
    const corpo = (await req.json().catch(() => null)) as { nome?: unknown } | null;
    const nome = nomeDeSegmentoValido(corpo?.nome);
    if (!nome) return fail("validation_failed", "Informe o nome do segmento (até 80 letras).", 422, { requestId });
    const lista = await segmentosCadastrados(authz.org.orgId);
    if (lista.some((s) => chaveDoSegmento(s) === chaveDoSegmento(nome))) {
      return fail("conflict", "Esse segmento já está cadastrado.", 409, { requestId });
    }
    if (lista.length >= MAXIMO_DE_SEGMENTOS) {
      return fail("validation_failed", "Limite de segmentos atingido.", 422, { requestId });
    }
    await gravar(authz.org.orgId, [...lista, nome]);
    void audit({ action: "segmentos.updated", actorUserId: authz.user.id, organizationId: authz.org.orgId, requestId, metadata: { acao: "criar" } });
    return ok({ nome }, { requestId, status: 201 });
  } catch (e) {
    return handleRouteError(e, requestId);
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);
  const desligado = await seModuloB2bDesligado(requestId);
  if (desligado) return desligado;
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const authz = await requireRole("manager", { requestId, resource: "segmentos" });
  if (!authz.ok) return authz.response;
  try {
    const corpo = (await req.json().catch(() => null)) as { de?: unknown; para?: unknown } | null;
    const de = nomeDeSegmentoValido(corpo?.de);
    const para = nomeDeSegmentoValido(corpo?.para);
    if (!de || !para) return fail("validation_failed", "Informe o nome atual e o novo.", 422, { requestId });
    const lista = await segmentosCadastrados(authz.org.orgId);
    const atual = lista.find((s) => chaveDoSegmento(s) === chaveDoSegmento(de));
    if (!atual) return fail("not_found", "Segmento não encontrado.", 404, { requestId });
    if (lista.some((s) => s !== atual && chaveDoSegmento(s) === chaveDoSegmento(para))) {
      return fail("conflict", "Já existe um segmento com esse nome.", 409, { requestId });
    }
    const { data, error } = await createAdminClient().rpc("fn_segmentos_renomear" as never, {
      p_org: authz.org.orgId,
      p_de: atual,
      p_para: para,
    } as never);
    if (error) throw new Error(error.message);
    void audit({ action: "segmentos.updated", actorUserId: authz.user.id, organizationId: authz.org.orgId, requestId, metadata: { acao: "renomear", contatos: data } });
    return ok({ nome: para, contatos_atualizados: Number(data ?? 0) }, { requestId });
  } catch (e) {
    return handleRouteError(e, requestId);
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);
  const desligado = await seModuloB2bDesligado(requestId);
  if (desligado) return desligado;
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const authz = await requireRole("manager", { requestId, resource: "segmentos" });
  if (!authz.ok) return authz.response;
  try {
    const nome = nomeDeSegmentoValido(req.nextUrl.searchParams.get("nome"));
    if (!nome) return fail("validation_failed", "Informe o segmento.", 422, { requestId });
    const lista = await segmentosCadastrados(authz.org.orgId);
    const resto = lista.filter((s) => chaveDoSegmento(s) !== chaveDoSegmento(nome));
    if (resto.length === lista.length) return fail("not_found", "Segmento não encontrado.", 404, { requestId });
    await gravar(authz.org.orgId, resto);
    void audit({ action: "segmentos.updated", actorUserId: authz.user.id, organizationId: authz.org.orgId, requestId, metadata: { acao: "tirar_da_lista" } });
    return ok({ removido: nome }, { requestId });
  } catch (e) {
    return handleRouteError(e, requestId);
  }
}
