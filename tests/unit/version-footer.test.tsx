import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { VersionFooter } from "@/components/shell/VersionFooter";

/**
 * O rodapé da sidebar é o único caminho da tela de atualização para quem opera
 * a VPS: sem ele a página existe mas ninguém chega nela. Por isso, para o dono
 * do servidor ele é SEMPRE um link, com ou sem versão nova; quem não é dono vê
 * só o número, e não recebe um link para uma tela que não abre para ele.
 */

const dados = { current: null as null | Record<string, unknown> };

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (chave: string) => chave }));
vi.mock("@/hooks/system/useSystemVersion", () => ({
  useSystemVersion: () => ({ data: dados.current }),
}));

afterEach(() => {
  cleanup();
  dados.current = null;
});

describe("VersionFooter", () => {
  it("dono sem versão nova: link para a tela de atualização, sem o ponto de aviso", () => {
    dados.current = {
      current_version: "v1.73.0",
      latest_version: "v1.73.0",
      update_available: false,
      is_owner: true,
    };
    render(<VersionFooter collapsed={false} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/app/settings/atualizacao");
    expect(link).toHaveTextContent("versão 1.73.0");
    expect(link).not.toHaveTextContent("Nova versão");
    expect(link.querySelector(".animate-ping")).toBeNull();
  });

  it("dono com versão nova: link com o aviso e o número da nova versão", () => {
    dados.current = {
      current_version: "v1.73.0",
      latest_version: "v1.74.0",
      update_available: true,
      is_owner: true,
    };
    render(<VersionFooter collapsed={false} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/app/settings/atualizacao");
    expect(link).toHaveTextContent("Nova versão · 1.74.0");
    expect(link.querySelector(".animate-ping")).not.toBeNull();
  });

  it("quem não é dono: só o número, sem link", () => {
    dados.current = {
      current_version: "v1.73.0",
      latest_version: "v1.74.0",
      update_available: true,
      is_owner: false,
    };
    render(<VersionFooter collapsed={false} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("versão 1.73.0")).toBeInTheDocument();
  });

  it("sem versão instalada conhecida: não renderiza nada", () => {
    dados.current = { current_version: "", is_owner: true };
    const { container } = render(<VersionFooter collapsed={false} />);

    expect(container).toBeEmptyDOMElement();
  });
});
