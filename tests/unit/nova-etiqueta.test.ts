/**
 * Fork #24 — "Nova etiqueta" em Configurações › Tags.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ support: vi.fn(), role: vi.fn(), mfa: vi.fn(), audit: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDivida: mocks.mfa }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));

import { POST } from "@/app/api/v1/tags/vocabulario/criar/route";

const req = (corpo: unknown) =>
  new NextRequest("http://local/api/v1/tags/vocabulario/criar", { method: "POST", body: JSON.stringify(corpo) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.support.mockResolvedValue(null);
  mocks.mfa.mockResolvedValue(false);
  mocks.role.mockResolvedValue({ ok: true, user: { id: "u" }, org: { orgId: "o1" } });
});

describe("POST /api/v1/tags/vocabulario/criar", () => {
  it("exige gerente", async () => {
    mocks.role.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await POST(req({ tag: "vip" }))).status).toBe(403);
    expect(mocks.role).toHaveBeenCalledWith("manager", expect.anything());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("recusa nome vazio, longo ou cor fora do padrão sem chegar ao banco", async () => {
    for (const corpo of [{ tag: "  " }, { tag: "x".repeat(61) }, { tag: "vip", cor: "azul" }]) {
      expect((await POST(req(corpo))).status).toBe(422);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("cria pela função de banco, da empresa ativa, e audita", async () => {
    mocks.rpc.mockResolvedValue({ data: { criou: true, tag: "vip" }, error: null });
    const r = await POST(req({ tag: " vip ", cor: "#AB4ABA" }));
    expect(r.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("fn_vocabulario_de_tags_criar", { p_org: "o1", p_tag: "vip", p_cor: "#ab4aba" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "tag_vocabulary.changed" }));
  });

  it("nome que já existe devolve criou=false e não audita", async () => {
    mocks.rpc.mockResolvedValue({ data: { criou: false, tag: "vip" }, error: null });
    const corpo = (await (await POST(req({ tag: "VIP" }))).json()) as { data: { criou: boolean } };
    expect(corpo.data.criou).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("42501 do banco vira 403", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await POST(req({ tag: "vip" }))).status).toBe(403);
  });
});

describe("função de banco", () => {
  const sql = readFileSync("supabase/personalizacoes.sql", "utf8");
  it("nasce em personalizacoes.sql com portão de gerente e sem acesso anônimo", () => {
    expect(sql).toContain("function public.fn_vocabulario_de_tags_criar(");
    expect(sql).toContain("fn_role_at_least(p_org, 'manager')");
    expect(sql).toContain("revoke execute on function public.fn_vocabulario_de_tags_criar(uuid, text, text) from anon");
  });
});
