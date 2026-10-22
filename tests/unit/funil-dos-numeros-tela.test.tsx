/**
 * Fork #25 — lista de números com o funil de cada um (Configurações › Atendimento).
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

import { FunilDosNumeros } from "@/app/app/settings/atendimento/_funil-dos-numeros";

afterEach(() => vi.unstubAllGlobals());

describe("FunilDosNumeros", () => {
  it("mostra um seletor de funil por número conectado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/v1/channel-sessions")
          return new Response(
            JSON.stringify({ data: [
              { id: "c1", display_name: "Comercial", phone_number: "+5541" },
              { id: "c2", display_name: "Suporte", phone_number: "+5542" },
            ] }),
          );
        return new Response(JSON.stringify({ data: { funil_id: null, funis: [{ id: "f1", name: "Geral" }] } }));
      }),
    );
    render(<FunilDosNumeros />);
    await waitFor(() => expect(screen.getAllByTestId("funil-do-numero")).toHaveLength(2));
    expect(screen.getByText("Comercial")).toBeTruthy();
    expect(screen.getByText("Suporte")).toBeTruthy();
  });

  it("sem números conectados não mostra nada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }))));
    const { container } = render(<FunilDosNumeros />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
