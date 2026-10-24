/**
 * Fork #32 — o seletor mostra os segmentos cadastrados da empresa e mantém os que o contato já tem.
 *
 * Lista suspensa de ESCOLHA ÚNICA: com muitos segmentos cadastrados, uma fila de botões vira um
 * paredão. `value`/`onChange` continuam sendo o texto "A, B" dos formulários, só que a escolha agora
 * grava um único segmento. Quem já tem vários (por exemplo, gravados pela IA) não os perde sozinho.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SeletorDeSegmentos } from "@/components/contacts/SeletorDeSegmentos";

const estado = vi.hoisted(() => ({ lista: [] as Array<{ nome: string; usos: number }>, carregando: false }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/contacts/useSegmentos", () => ({
  useSegmentos: () => ({ data: { data: estado.lista }, isLoading: estado.carregando }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  estado.lista = [];
  estado.carregando = false;
});

const LISTA = [
  { nome: "Concreteira", usos: 0 },
  { nome: "Pedreira", usos: 0 },
  { nome: "Panificadora", usos: 0 },
];

describe("SeletorDeSegmentos", () => {
  it("empresa sem segmentos cadastrados: aviso com link para cadastrar", () => {
    render(<SeletorDeSegmentos value="" onChange={() => {}} />);
    expect(screen.getByText("Nenhum segmento cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/segmentos");
  });

  it("é uma lista suspensa, não uma fila de botões", () => {
    estado.lista = LISTA;
    render(<SeletorDeSegmentos value="" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concreteira" })).toBeNull();
  });

  it("sem segmento escolhido mostra o texto de orientação", () => {
    estado.lista = LISTA;
    render(<SeletorDeSegmentos value="" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Selecione o segmento");
  });

  it("escolher uma opção devolve só aquele segmento (escolha única)", async () => {
    estado.lista = LISTA;
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<SeletorDeSegmentos value="Concreteira" onChange={onChange} />);
    await u.click(screen.getByRole("combobox"));
    await u.click(screen.getByRole("option", { name: "Pedreira" }));
    expect(onChange).toHaveBeenLastCalledWith("Pedreira");
  });

  it("a opção Nenhum limpa o segmento", async () => {
    estado.lista = LISTA;
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<SeletorDeSegmentos value="Pedreira" onChange={onChange} />);
    await u.click(screen.getByRole("combobox"));
    await u.click(screen.getByRole("option", { name: "Nenhum" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("segmento que o contato já tem e saiu da lista continua aparecendo, escolhido", async () => {
    estado.lista = [{ nome: "Concreteira", usos: 0 }];
    const u = userEvent.setup();
    render(<SeletorDeSegmentos value="mineração" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("mineração");
    await u.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Concreteira" })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "mineração" }).length).toBeGreaterThan(0);
  });

  it("contato com vários segmentos: mostra todos e só troca se a pessoa escolher outro", async () => {
    estado.lista = LISTA;
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<SeletorDeSegmentos value="Concreteira, Pedreira" onChange={onChange} />);
    const gatilho = screen.getByRole("combobox");
    expect(gatilho).toHaveTextContent("Concreteira, Pedreira");
    expect(onChange).not.toHaveBeenCalled();
    await u.click(gatilho);
    await u.click(screen.getByRole("option", { name: "Panificadora" }));
    expect(onChange).toHaveBeenLastCalledWith("Panificadora");
  });

  it("desabilitado: não abre", async () => {
    estado.lista = LISTA;
    render(<SeletorDeSegmentos value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("repassa o id para o rótulo apontar para o campo", () => {
    estado.lista = LISTA;
    render(<SeletorDeSegmentos id="segmentosRaw" value="" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("id", "segmentosRaw");
  });
});
