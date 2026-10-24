import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TipoDeClienteForm } from "@/app/app/settings/tenant/_tipo-de-cliente-form";

/**
 * Empresas, Pessoas e Segmentos são UM módulo (`crm_b2b`), desligado por padrão
 * na instalação. A tela de Organização já pergunta "Meus clientes são Empresas
 * (B2B)" — e quem escolhe B2B esperava ter Segmentos, mas recebia 404. Agora o
 * cartão do tipo de cliente diz em que pé está o módulo e, para quem administra
 * a plataforma, liga com UM clique (pelo mesmo action da tela de administração,
 * que audita). Quem não administra a plataforma vê a quem pedir.
 */

const acao = vi.hoisted(() => ({ ligar: vi.fn() }));
const nav = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/app/actions/settings/updateModuloDaInstalacao", () => ({
  updateModuloDaInstalacao: acao.ligar,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (texto: string) => texto }));
vi.mock("@/hooks/contacts/useTipoDeCliente", () => ({ recarregarTipoDeCliente: vi.fn() }));

beforeEach(() => {
  acao.ligar.mockReset();
  nav.refresh.mockReset();
});

describe("Organização › módulo Empresas, Pessoas e Segmentos", () => {
  it("ligado: só informa, sem botão", () => {
    render(
      <TipoDeClienteForm inicial="empresas" podeEditar modulo={{ ligado: true, podeLigar: true }} />,
    );
    expect(screen.getByText(/Empresas, Pessoas e Segmentos estão ligados/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ligar agora" })).toBeNull();
  });

  it("desligado, administrador da plataforma: botão Ligar agora", () => {
    render(
      <TipoDeClienteForm inicial="empresas" podeEditar modulo={{ ligado: false, podeLigar: true }} />,
    );
    expect(screen.getByText(/estão desligados nesta instalação/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ligar agora" })).toBeTruthy();
  });

  it("desligado, quem não administra a plataforma: diz a quem pedir, sem botão", () => {
    render(
      <TipoDeClienteForm inicial="empresas" podeEditar modulo={{ ligado: false, podeLigar: false }} />,
    );
    expect(screen.getByText(/Peça a quem administra o servidor/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ligar agora" })).toBeNull();
  });

  it("clicar liga o módulo crm_b2b e recarrega a tela", async () => {
    acao.ligar.mockResolvedValue({ ok: true });
    const u = userEvent.setup();
    render(
      <TipoDeClienteForm inicial="empresas" podeEditar modulo={{ ligado: false, podeLigar: true }} />,
    );
    await u.click(screen.getByRole("button", { name: "Ligar agora" }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(acao.ligar).toHaveBeenCalledWith({ modulo: "crm_b2b", ligado: true });
  });

  it("recusa do servidor aparece na tela e não recarrega", async () => {
    acao.ligar.mockResolvedValue({ ok: false, error: "forbidden" });
    const u = userEvent.setup();
    render(
      <TipoDeClienteForm inicial="empresas" podeEditar modulo={{ ligado: false, podeLigar: true }} />,
    );
    await u.click(screen.getByRole("button", { name: "Ligar agora" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("Pessoas (B2C): o módulo B2B não é assunto, nada aparece", () => {
    render(
      <TipoDeClienteForm inicial="pessoas" podeEditar modulo={{ ligado: false, podeLigar: true }} />,
    );
    expect(screen.queryByText(/Empresas, Pessoas e Segmentos/)).toBeNull();
  });

  it("sem a informação do módulo (uso antigo do componente), nada muda", () => {
    render(<TipoDeClienteForm inicial="empresas" podeEditar />);
    expect(screen.queryByText(/Empresas, Pessoas e Segmentos/)).toBeNull();
  });
});
