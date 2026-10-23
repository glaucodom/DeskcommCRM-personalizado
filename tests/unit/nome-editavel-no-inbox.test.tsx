/**
 * Fork #28 — lápis para trocar o nome do contato no painel lateral do Inbox.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NomeEditavelDoContato } from "@/components/inbox/NomeEditavelDoContato";

const patch = vi.hoisted(() => vi.fn(async () => ({ data: {} })));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: { patch } }));

function ver(nomeSalvo = "Engenheiro Marcelo Menezes") {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NomeEditavelDoContato contactId="c1" rotulo="Engenheiro Marcelo Menezes" nomeSalvo={nomeSalvo} />
    </QueryClientProvider>,
  );
}

beforeEach(() => patch.mockClear());

describe("NomeEditavelDoContato", () => {
  it("lápis abre o campo, Enter salva com a máscara de maiúsculas", async () => {
    ver();
    fireEvent.click(screen.getByLabelText("Editar nome"));
    const campo = screen.getByLabelText("Nome");
    fireEvent.change(campo, { target: { value: "marcelo DA silva menezes" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/v1/contacts/c1", { name: "Marcelo da Silva Menezes" }));
    await waitFor(() => expect(screen.queryByLabelText("Nome")).toBeNull());
  });

  it("Esc cancela sem gravar", () => {
    ver();
    fireEvent.click(screen.getByLabelText("Editar nome"));
    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Escape" });
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText("Engenheiro Marcelo Menezes")).toBeTruthy();
  });

  it("nome igual ao salvo não chama a API", () => {
    ver();
    fireEvent.click(screen.getByLabelText("Editar nome"));
    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Enter" });
    expect(patch).not.toHaveBeenCalled();
  });
});
