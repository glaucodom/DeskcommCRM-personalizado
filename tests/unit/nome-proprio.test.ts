import { describe, expect, it } from "vitest";
import { nomeProprio, nomeProprioOpcional } from "@/lib/personalizacoes/nome-proprio";

describe("nomeProprio", () => {
  it.each([
    ["glauco satler neiva", "Glauco Satler Neiva"],
    ["MARIA DA SILVA OLIVEIRA", "Maria da Silva Oliveira"],
    ["  joão   dos  santos e souza ", "João dos Santos e Souza"],
    ["ana-maria d'ávila", "Ana-Maria D'Ávila"],
    ["de souza", "De Souza"],
    ["ÉRICA DAS NEVES", "Érica das Neves"],
    ["+55 41 99999-8888", "+55 41 99999-8888"],
    ["", ""],
  ])("%s → %s", (entrada, saida) => {
    expect(nomeProprio(entrada)).toBe(saida);
  });
  it("opcional preserva undefined, null e vazio", () => {
    expect(nomeProprioOpcional(undefined)).toBeUndefined();
    expect(nomeProprioOpcional(null)).toBeNull();
    expect(nomeProprioOpcional("  ")).toBe("  ");
    expect(nomeProprioOpcional("pedro DO carmo")).toBe("Pedro do Carmo");
  });
});
