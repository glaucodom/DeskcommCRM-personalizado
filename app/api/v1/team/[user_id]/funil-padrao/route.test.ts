import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  support: vi.fn(),
  role: vi.fn(),
  audit: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
import { PATCH } from "./route";
const user = "f2310000-0000-4000-8000-000000000001";
const org = "f2310000-0000-4000-8000-000000000002";
const funil = "f2310000-0000-4000-8000-000000000003";
const ctx = { params: Promise.resolve({ user_id: user }) };
const request = (corpo: unknown) =>
  new NextRequest("http://local/api/v1/team/x/funil-padrao", { method: "PATCH", body: JSON.stringify(corpo) });
const cadeia = (resultado: unknown) => {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq", "is", "not"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(resultado);
  return c as Record<string, ReturnType<typeof vi.fn>>;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.support.mockResolvedValue(null);
  mocks.role.mockResolvedValue({ ok: true, user: { id: "admin" }, org: { orgId: org } });
});
it("só administrador muda o funil padrão de alguém", async () => {
  mocks.role.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
  expect((await PATCH(request({ pipeline_id: funil }), ctx)).status).toBe(403);
  expect(mocks.role).toHaveBeenCalledWith("admin", expect.anything());
  expect(mocks.from).not.toHaveBeenCalled();
});
it("corpo inválido não chega ao banco", async () => {
  expect((await PATCH(request({ pipeline_id: "x" }), ctx)).status).toBe(400);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("funil de outra empresa ou arquivado é recusado", async () => {
  const funis = cadeia({ data: null, error: null });
  mocks.from.mockReturnValue(funis);
  expect((await PATCH(request({ pipeline_id: funil }), ctx)).status).toBe(404);
  expect(funis.eq).toHaveBeenCalledWith("organization_id", org);
  expect(funis.eq).toHaveBeenCalledWith("is_archived", false);
  expect(mocks.audit).not.toHaveBeenCalled();
});
it("grava no membro ativo da empresa e audita", async () => {
  const funis = cadeia({ data: { id: funil }, error: null });
  const membros = cadeia({ data: { id: "m1", user_id: user, funil_padrao_id: funil }, error: null });
  mocks.from.mockImplementation((t: string) => (t === "crm_pipelines" ? funis : membros));
  expect((await PATCH(request({ pipeline_id: funil }), ctx)).status).toBe(200);
  expect(membros.update).toHaveBeenCalledWith({ funil_padrao_id: funil });
  expect(membros.eq).toHaveBeenCalledWith("organization_id", org);
  expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.funil_padrao_changed" }));
});
it("null volta ao padrão da empresa sem consultar funil", async () => {
  const membros = cadeia({ data: { id: "m1", user_id: user, funil_padrao_id: null }, error: null });
  mocks.from.mockReturnValue(membros);
  expect((await PATCH(request({ pipeline_id: null }), ctx)).status).toBe(200);
  expect(mocks.from).toHaveBeenCalledTimes(1);
  expect(membros.update).toHaveBeenCalledWith({ funil_padrao_id: null });
});
