/**
 * Fork #32 — segmentos cadastrados por empresa (funções puras).
 */
import { describe, expect, it } from "vitest";

import {
  chaveDoSegmento,
  nomeDeSegmentoValido,
  segmentoDaLista,
  segmentosDasConfiguracoes,
} from "@/lib/personalizacoes/segmentos";

describe("segmentos cadastrados", () => {
  it("compara sem acento, caixa nem espaço repetido", () => {
    expect(chaveDoSegmento("Construção  Pesada")).toBe(chaveDoSegmento("construcao pesada"));
    expect(segmentoDaLista(["Concreteira", "Pré-moldados"], "pre-moldados")).toBe("Pré-moldados");
    expect(segmentoDaLista(["Concreteira", "Pré-moldados"], "PRÉ-MOLDADOS")).toBe("Pré-moldados");
  });

  it("valida o nome", () => {
    expect(nomeDeSegmentoValido("  Usina   de asfalto ")).toBe("Usina de asfalto");
    expect(nomeDeSegmentoValido("   ")).toBeNull();
    expect(nomeDeSegmentoValido("x".repeat(81))).toBeNull();
    expect(nomeDeSegmentoValido(42)).toBeNull();
  });

  it("lê a lista das configurações: sem repetidos, lixo vira lista vazia", () => {
    expect(segmentosDasConfiguracoes({ segmentos_cadastrados: ["A", "a", " B ", 3, ""] })).toEqual(["A", "B"]);
    expect(segmentosDasConfiguracoes({})).toEqual([]);
    expect(segmentosDasConfiguracoes({ segmentos_cadastrados: "A" })).toEqual([]);
    expect(segmentosDasConfiguracoes(null)).toEqual([]);
  });
});
