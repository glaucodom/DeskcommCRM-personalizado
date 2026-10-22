/**
 * Fork #24 — o formulário "Nova etiqueta" da tela de Tags.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { NovaEtiqueta } from "@/app/app/settings/tags/_nova-etiqueta";

function montar() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NovaEtiqueta idioma="pt-BR" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NovaEtiqueta", () => {
  it("só habilita com nome e envia nome + cor escolhida", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { criou: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    montar();
    const botao = screen.getByRole("button", { name: "Criar etiqueta" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "  cliente vip " } });
    expect(botao.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Escolher cor" }));
    fireEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
    fireEvent.click(botao);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/tags/vocabulario/criar");
    const corpo = JSON.parse(init.body as string) as { tag: string; cor: string | null };
    expect(corpo.tag).toBe("cliente vip");
    expect(corpo.cor).toMatch(/^#[0-9a-f]{6}$/i);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("etiqueta que já existe não recarrega a página", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { criou: false } }), { status: 200 })));
    montar();
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "vip" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();
  });
});
