/**
 * Personalização do fork: a instalação pode esconder idiomas
 * (`IDIOMAS_OCULTOS`, ex.: `es`) e ficar só em português. Vazio, o
 * produto é o oficial — por isso os testes oficiais do espanhol seguem
 * passando sem edição.
 */
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  IdiomaProvider,
  IdiomasOcultos,
  useIdiomasOferecidos,
} from "../../lib/i18n/IdiomaProvider";
import { idiomaDaTela, idiomasOcultosDaInstalacao } from "../../lib/i18n/ocultos";

const raiz = join(__dirname, "../..");

function Lista() {
  return <p data-testid="lista">{useIdiomasOferecidos().map((i) => i.codigo).join(",")}</p>;
}

describe("idiomas escondidos pela instalação", () => {
  it("lê a lista do .env, e o português nunca se esconde", () => {
    expect(idiomasOcultosDaInstalacao("es")).toEqual(["es"]);
    expect(idiomasOcultosDaInstalacao(" es , pt-BR ")).toEqual(["es"]);
    expect(idiomasOcultosDaInstalacao("")).toEqual([]);
    expect(idiomasOcultosDaInstalacao(undefined)).toEqual([]);
  });

  it("quem tinha espanhol salvo vê português; sem lista, nada muda", () => {
    expect(idiomaDaTela("es", ["es"])).toBe("pt-BR");
    expect(idiomaDaTela("pt-BR", ["es"])).toBe("pt-BR");
    expect(idiomaDaTela("es", [])).toBe("es");
  });

  it("a tela oferece só o que não está escondido", () => {
    render(
      <IdiomaProvider locale="pt-BR">
        <IdiomasOcultos ocultos={["es"]}>
          <Lista />
        </IdiomasOcultos>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId("lista").textContent).toBe("pt-BR");
  });

  it("sem lista, a tela oferece o mesmo que o oficial", () => {
    render(
      <IdiomaProvider locale="pt-BR">
        <Lista />
      </IdiomaProvider>,
    );
    expect(screen.getByTestId("lista").textContent).toContain("es");
  });

  it("os pontos de entrada passam pela regra", () => {
    const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
    expect(ler("lib/auth/server.ts")).toContain("idiomaDaTela(");
    expect(ler("lib/i18n/idiomaAnonimo.ts")).toContain("idiomasOcultosDaInstalacao()");
    expect(ler("app/actions/settings/trocarIdioma.ts")).toContain("idiomasOcultosDaInstalacao()");
    expect(ler("app/app/layout.tsx")).toContain(
      "<IdiomasOcultos ocultos={idiomasOcultosDaInstalacao()}>",
    );
    for (const tela of [
      "components/shell/SeletorDeIdioma.tsx",
      "app/app/settings/profile/_form.tsx",
      "app/app/settings/tenant/_form.tsx",
    ]) {
      expect(ler(tela), tela).toContain("useIdiomasOferecidos()");
    }
  });
});
