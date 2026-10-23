/**
 * Fork #32 — o seletor mostra os segmentos cadastrados da empresa e mantém os que o contato já tem.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SeletorDeSegmentos } from "@/components/contacts/SeletorDeSegmentos";

const estado = vi.hoisted(() => ({ lista: [] as Array<{ nome: string; usos: number }>, carregando: false }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/contacts/useSegmentos", () => ({
  useSegmentos: () => ({ data: { data: estado.lista }, isLoading: estado.carregando }),
}));

beforeEach(() => {
  estado.lista = [];
  estado.carregando = false;
});

describe("SeletorDeSegmentos", () => {
  it("empresa sem segmentos cadastrados: aviso com link para cadastrar", () => {
    render(<SeletorDeSegmentos value="" onChange={() => {}} />);
    expect(screen.getByText("Nenhum segmento cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/segmentos");
  });

  it("marca e desmarca, devolvendo o texto 'A, B'", () => {
    estado.lista = [{ nome: "Concreteira", usos: 0 }, { nome: "Pedreira", usos: 0 }];
    const onChange = vi.fn();
    const { rerender } = render(<SeletorDeSegmentos value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Concreteira" }));
    expect(onChange).toHaveBeenLastCalledWith("Concreteira");
    rerender(<SeletorDeSegmentos value="Concreteira" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pedreira" }));
    expect(onChange).toHaveBeenLastCalledWith("Concreteira, Pedreira");
    fireEvent.click(screen.getByRole("button", { name: "Concreteira" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("segmento que o contato já tem e saiu da lista continua aparecendo, marcado", () => {
    estado.lista = [{ nome: "Concreteira", usos: 0 }];
    render(<SeletorDeSegmentos value="mineração" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "mineração" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Concreteira" })).toHaveAttribute("aria-pressed", "false");
  });
});
