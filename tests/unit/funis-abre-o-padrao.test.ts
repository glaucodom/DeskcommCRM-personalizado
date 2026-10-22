/**
 * Fork #23 — "Funis" no menu abre direto o funil padrão.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const redirecionar = vi.hoisted(() => vi.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
}));
const funisDoBanco = vi.hoisted(() => ({
  lista: [] as Array<Record<string, unknown>>,
  funilDaPessoa: null as string | null,
}));

vi.mock("next/navigation", () => ({ redirect: redirecionar }));
vi.mock("@/lib/auth/server", () => ({
  requireAuth: async () => ({ idioma: "pt-BR", id: "u1" }),
  resolveActiveOrg: async () => ({ orgId: "o1", role: "admin" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => ({
      select: () => ({
        eq: () =>
          tabela === "user_organizations"
            ? { eq: () => ({ maybeSingle: async () => ({ data: { funil_padrao_id: funisDoBanco.funilDaPessoa } }) }) }
            : { order: async () => ({ data: funisDoBanco.lista }) },
      }),
    }),
  }),
}));
vi.mock("./_client", () => ({ FunisClient: () => null }));
vi.mock("@/app/app/kanban/_client", () => ({ FunisClient: () => null }));

import KanbanPickerPage from "@/app/app/kanban/page";

const funil = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: id, slug: id, description: null, position: 0, is_default: false,
  is_client_pipeline: false, is_archived: false, ...extra,
});

beforeEach(() => {
  redirecionar.mockClear();
  funisDoBanco.funilDaPessoa = null;
});

describe("/app/kanban abre o funil padrão", () => {
  it("sem parâmetros e com funil padrão: redireciona para o quadro dele", async () => {
    funisDoBanco.lista = [funil("a"), funil("geral", { is_default: true })];
    await expect(KanbanPickerPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/app/pipelines/geral");
  });

  it("o funil marcado para a pessoa vence o padrão da empresa", async () => {
    funisDoBanco.lista = [funil("a"), funil("geral", { is_default: true })];
    funisDoBanco.funilDaPessoa = "a";
    await expect(KanbanPickerPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/app/pipelines/a");
  });

  it("funil da pessoa arquivado ou inexistente cai no padrão da empresa", async () => {
    funisDoBanco.lista = [funil("geral", { is_default: true }), funil("velho", { is_archived: true })];
    funisDoBanco.funilDaPessoa = "velho";
    await expect(KanbanPickerPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/app/pipelines/geral");
  });

  it("?todos=1 mostra a lista", async () => {
    funisDoBanco.lista = [funil("geral", { is_default: true })];
    await expect(KanbanPickerPage({ searchParams: Promise.resolve({ todos: "1" }) })).resolves.toBeTruthy();
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it("links com outro parâmetro (?lead=) continuam na lista", async () => {
    funisDoBanco.lista = [funil("geral", { is_default: true })];
    await KanbanPickerPage({ searchParams: Promise.resolve({ lead: "x" }) });
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it("sem funil padrão (ou só arquivado) não redireciona", async () => {
    funisDoBanco.lista = [funil("a"), funil("b", { is_default: true, is_archived: true })];
    await KanbanPickerPage({ searchParams: Promise.resolve({}) });
    expect(redirecionar).not.toHaveBeenCalled();
  });
});
