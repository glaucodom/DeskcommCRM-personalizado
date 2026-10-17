/**
 * Personalização do fork: as instruções do agente vão até 50.000 caracteres
 * (o oficial para em 20.000). O servidor mede depois do trim, igual à tela.
 */
import { describe, expect, it } from "vitest";
import { LIMITE_DAS_INSTRUCOES } from "@/lib/ai/agents/limite-das-instrucoes";
import { versionCreateSchema } from "@/lib/ai/agents/validation";

function errosDoPrompt(prompt: string) {
  const r = versionCreateSchema.safeParse({ system_prompt: prompt });
  return r.success ? [] : r.error.issues.filter((i) => i.path[0] === "system_prompt");
}

describe("limite das instruções do agente (personalização do fork)", () => {
  it("é 50.000", () => {
    expect(LIMITE_DAS_INSTRUCOES).toBe(50_000);
  });

  it("aceita 50.000 caracteres, inclusive acima do teto oficial de 20.000", () => {
    expect(errosDoPrompt("a".repeat(20_001))).toEqual([]);
    expect(errosDoPrompt("a".repeat(50_000))).toEqual([]);
  });

  it("recusa 50.001", () => {
    expect(errosDoPrompt("a".repeat(50_001))).toHaveLength(1);
  });

  it("mede depois do trim, como a tela", () => {
    expect(errosDoPrompt("a".repeat(50_000) + "\n\n   ")).toEqual([]);
  });
});
