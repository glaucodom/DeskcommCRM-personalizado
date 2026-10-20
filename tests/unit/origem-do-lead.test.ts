// @vitest-environment node
import { describe, expect, it } from "vitest";

import { padronizarOrigem } from "@/lib/personalizacoes/origem-do-lead";

describe("a origem do lead sai padronizada", () => {
  it.each([
    ["vi na ia", "IA"],
    ["Vi numa inteligência artificial", "IA"],
    ["o ChatGPT me indicou vocês", "IA (ChatGPT)"],
    ["perguntei pro gemini", "IA (Gemini)"],
    ["achei pelo Claude", "IA (Claude)"],
    ["pelo google", "Google"],
    ["Gogle", "Google"],
    ["no insta", "Instagram"],
    ["Instagram de vocês", "Instagram"],
    ["foi um amigo que indicou", "Indicação"],
    ["linkedin", "LinkedIn"],
    ["numa feira em Curitiba", "Numa feira em Curitiba"],
  ])("%s → %s", (entrada, esperado) => {
    expect(padronizarOrigem(entrada)).toBe(esperado);
  });

  it("⛔ CONTROLE: IA com nome ganha do Google (Gemini é do Google, mas a origem é IA)", () => {
    expect(padronizarOrigem("o gemini do google")).toBe("IA (Gemini)");
  });

  it("vazio continua vazio", () => {
    expect(padronizarOrigem("  ")).toBe("");
  });
});
