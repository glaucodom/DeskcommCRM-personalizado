import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

/**
 * A etiqueta CADASTRADA em Configurações › Tags aparece nas sugestões do Inbox (fork).
 *
 * "Nova etiqueta" grava no vocabulário da organização (`fn_vocabulario_de_tags_criar`), mas a lista de
 * sugestões do editor do Inbox só juntava as etiquetas canônicas com as EM USO: a etiqueta recém
 * cadastrada (uso zero) não aparecia para escolher — "eu cadastrei a tag e não exibe". Agora a rota
 * também lê o vocabulário (`fn_vocabulario_de_tags_pagina`), depois das que estão em uso. Se essa leitura
 * falhar, a lista é a de sempre: nunca vira um 500 sobre uma resposta que existe.
 */

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function banco(args: {
  emUso?: string[];
  conversas?: Array<{ tags: string[] }>;
  vocabulario?: string[];
  vocabularioFalha?: boolean;
}) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: { settings: {} }, error: null }),
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: args.conversas ?? [], error: null }).then(res),
  });
  return {
    from: () => chain,
    rpc: async (nome: string) => {
      if (nome === "fn_tags_de_conversa_em_uso") {
        return { data: (args.emUso ?? []).map((tag) => ({ tag })), error: null };
      }
      if (nome === "fn_vocabulario_de_tags_pagina") {
        if (args.vocabularioFalha) return { data: null, error: { message: "falhou" } };
        const items = (args.vocabulario ?? []).map((tag) => ({
          tag,
          uso_em_contatos: 0,
          uso_em_leads: 0,
          uso_em_conversas: 0,
          em_regras: 0,
          cor: null,
          descricao: null,
          no_vocabulario: true,
        }));
        return { data: { items, total: items.length, page: 1, per_page: 200 }, error: null };
      }
      throw new Error(`rpc inesperada: ${nome}`);
    },
  } as never;
}

async function sugestoes() {
  const { GET } = await import("@/app/api/v1/conversation-tags/route");
  const res = await GET(new NextRequest("http://x/api/v1/conversation-tags"));
  return { status: res.status, tags: ((await res.json()) as { data?: string[] }).data ?? [] };
}

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    org: { orgId: "org-1", name: "Org", role: "agent" },
  } as never);
});

describe("GET /api/v1/conversation-tags — vocabulário cadastrado", () => {
  it("etiqueta só do vocabulário (uso zero) aparece nas sugestões", async () => {
    vi.mocked(createClient).mockResolvedValue(banco({ vocabulario: ["Negociando"] }));
    const { status, tags } = await sugestoes();
    expect(status).toBe(200);
    expect(tags).toContain("negociando");
  });

  it("as em uso vêm primeiro e nada se repete", async () => {
    vi.mocked(createClient).mockResolvedValue(
      banco({
        emUso: ["urgente"],
        conversas: [{ tags: ["urgente"] }],
        vocabulario: ["urgente", "Negociando"],
      }),
    );
    const { tags } = await sugestoes();
    expect(tags).toEqual(["urgente", "negociando"]);
  });

  it("se a leitura do vocabulário falha, a lista de sempre continua inteira", async () => {
    vi.mocked(createClient).mockResolvedValue(
      banco({ emUso: ["urgente"], conversas: [{ tags: ["urgente"] }], vocabularioFalha: true }),
    );
    const { status, tags } = await sugestoes();
    expect(status).toBe(200);
    expect(tags).toEqual(["urgente"]);
  });
});
