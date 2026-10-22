import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ support: vi.fn(), role: vi.fn(), audit: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
import { PATCH } from "./route";

const canal = "f2510000-0000-4000-8000-000000000001";
const org = "f2510000-0000-4000-8000-000000000002";
const funil = "f2510000-0000-4000-8000-000000000003";
const ctx = { params: Promise.resolve({ id: canal }) };
const req = (corpo: unknown) =>
  new NextRequest("http://local/x", { method: "PATCH", body: JSON.stringify(corpo) });
const cadeia = (resultado: unknown) => {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq", "order"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(resultado);
  return c as Record<string, ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.support.mockResolvedValue(null);
  mocks.role.mockResolvedValue({ ok: true, user: { id: "u" }, org: { orgId: org } });
});

it("só admin muda o funil do número", async () => {
  mocks.role.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
  expect((await PATCH(req({ funil_id: funil }), ctx)).status).toBe(403);
  expect(mocks.role).toHaveBeenCalledWith("admin", expect.anything());
  expect(mocks.from).not.toHaveBeenCalled();
});

it("corpo inválido não chega ao banco", async () => {
  expect((await PATCH(req({ funil_id: "x" }), ctx)).status).toBe(422);
  expect(mocks.from).not.toHaveBeenCalled();
});

it("funil de outra empresa ou arquivado é recusado", async () => {
  const funis = cadeia({ data: null });
  mocks.from.mockReturnValue(funis);
  expect((await PATCH(req({ funil_id: funil }), ctx)).status).toBe(404);
  expect(funis.eq).toHaveBeenCalledWith("organization_id", org);
  expect(funis.eq).toHaveBeenCalledWith("is_archived", false);
});

it("grava no canal da empresa e audita; null volta ao padrão", async () => {
  const funis = cadeia({ data: { id: funil } });
  const canais = cadeia({ data: { id: canal, funil_id: funil } });
  mocks.from.mockImplementation((t: string) => (t === "crm_pipelines" ? funis : canais));
  expect((await PATCH(req({ funil_id: funil }), ctx)).status).toBe(200);
  expect(canais.update).toHaveBeenCalledWith({ funil_id: funil });
  expect(canais.eq).toHaveBeenCalledWith("organization_id", org);
  expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "channel.funil_changed" }));

  mocks.from.mockReturnValue(cadeia({ data: { id: canal, funil_id: null } }));
  expect((await PATCH(req({ funil_id: null }), ctx)).status).toBe(200);
});
