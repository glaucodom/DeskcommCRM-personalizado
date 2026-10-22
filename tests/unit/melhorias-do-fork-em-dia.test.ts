import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MELHORIAS_DO_FORK } from "@/lib/personalizacoes/melhorias-do-fork";

describe("lista de melhorias do fork (tela de Atualização)", () => {
  it("tem todos os números de PERSONALIZACOES-DO-FORK.md", () => {
    const md = readFileSync("PERSONALIZACOES-DO-FORK.md", "utf8");
    const doDocumento = [...md.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    const daTela = MELHORIAS_DO_FORK.map((m) => m.n);
    expect(doDocumento.length).toBeGreaterThan(0);
    for (const n of doDocumento) expect(daTela, `falta o #${n}`).toContain(n);
  });

  it("não repete número", () => {
    const ns = MELHORIAS_DO_FORK.map((m) => m.n);
    expect(new Set(ns).size).toBe(ns.length);
  });

  it("o histórico por versão começa com uma seção de versão do fork", () => {
    const md = readFileSync("MELHORIAS-POR-VERSAO.md", "utf8");
    const titulos = [...md.matchAll(/^## (v\d+\.\d+\.\d+-glauco\.\d+) · \d{4}-\d{2}-\d{2}$/gm)].map((m) => m[1]);
    expect(titulos.length).toBeGreaterThan(0);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
