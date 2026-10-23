import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";

/**
 * Padrão de cadastro (fork): a etiqueta aparece com a PRIMEIRA letra maiúscula, em todo lugar que usa o chip.
 *
 * É só na tela. O dado continua minúsculo — as buscas, os filtros, a regra da etiqueta `cliente` e o `?tag=`
 * comparam a forma normalizada, e gravar maiúscula quebraria esse casamento. Por isso é CSS (`first-letter`),
 * e não uma troca do texto: o texto do DOM não muda, só o que o olho vê. Só a primeira letra: "em negociação"
 * vira "Em negociação", e não "Em Negociação".
 */

vi.mock("@/hooks/auth/AuthProvider", () => ({ useAuth: () => ({ activeOrg: { orgId: "org-1" } }) }));

describe("ChipDeEtiqueta — primeira letra maiúscula só na tela", () => {
  it("o texto do DOM continua exatamente como foi gravado", () => {
    render(<ChipDeEtiqueta tag="em negociação" />);
    expect(screen.getByText("em negociação")).toBeTruthy();
  });

  it("o texto da etiqueta pede a primeira letra maiúscula (first-letter), não cada palavra", () => {
    render(<ChipDeEtiqueta tag="em negociação" />);
    const texto = screen.getByText("em negociação");
    expect(texto.className).toContain("first-letter:uppercase");
    // `capitalize` poria maiúscula em TODA palavra, o que não foi o pedido.
    expect(texto.className).not.toMatch(/(^|\s)capitalize(\s|$)/);
    expect(texto.closest("[class*='capitalize']")).toBeNull();
  });

  it("o botão de remover dos editores continua ao lado, fora do texto", () => {
    render(
      <ChipDeEtiqueta tag="vip">
        <button type="button" aria-label="Remover tag vip" />
      </ChipDeEtiqueta>,
    );
    const texto = screen.getByText("vip");
    expect(texto.contains(screen.getByRole("button", { name: "Remover tag vip" }))).toBe(false);
  });
});
