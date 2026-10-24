import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";

/**
 * Renomear etiqueta: a recusa diz POR QUÊ (fork).
 *
 * Renomear "negociando" para "Negociando" muda só a caixa, e a regra do vocabulário trata isso como o MESMO
 * nome (`destino_igual_a_tag`). A tela mostrava, para qualquer recusa, "Confira a etiqueta, o novo nome e a
 * cor." — quem tentava só trocar a maiúscula achava que faltava uma cor. Agora cada motivo conhecido tem
 * a sua frase; o que não é conhecido continua com a mensagem de sempre, e `details` segue na resposta.
 */

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDivida: vi.fn(async () => false) }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

async function post(corpo: unknown) {
  const { POST } = await import("@/app/api/v1/tags/vocabulario/route");
  const res = await POST(
    new NextRequest("http://x/api/v1/tags/vocabulario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
  const json = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
  return { status: res.status, erro: json.error };
}

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    org: { orgId: "org-1", name: "Org", role: "manager" },
    user: { id: "u1" },
  } as never);
});

describe("POST /api/v1/tags/vocabulario — mensagem de recusa", () => {
  it("renomear só trocando a caixa explica que maiúscula e minúscula não contam", async () => {
    const { status, erro } = await post({ acao: "renomear", tag: "negociando", destino: "Negociando" });
    expect(status).toBe(422);
    expect(erro?.code).toBe("validation_failed");
    expect(erro?.message).toMatch(/igual ao atual/i);
    expect(erro?.message).toMatch(/maiúscula e minúscula/i);
    expect(erro?.message).not.toMatch(/cor/i);
  });

  it("renomear sem digitar o novo nome pede o novo nome", async () => {
    const { status, erro } = await post({ acao: "renomear", tag: "negociando" });
    expect(status).toBe(422);
    expect(erro?.message).toMatch(/digite o novo nome/i);
    expect(erro?.message).not.toMatch(/maiúscula/i);
  });

  it("problema de cor continua falando de cor", async () => {
    const { status, erro } = await post({ acao: "definir_cor", tag: "negociando", cor: "roxo-invalido" });
    expect(status).toBe(422);
    expect(erro?.message).toMatch(/cor/i);
  });

  it("a lista de motivos continua em details", async () => {
    const { erro } = await post({ acao: "renomear", tag: "negociando", destino: "NEGOCIANDO" });
    expect(JSON.stringify(erro?.details)).toContain("destino_igual_a_tag");
  });
});
