import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizarNomeDoNumero, TETO_DO_NOME_DO_NUMERO } from "@/lib/personalizacoes/nome-do-numero";

describe("personalização: nome do número", () => {
  it("tira espaços sobrando e junta espaços repetidos", () => {
    expect(normalizarNomeDoNumero("  Comercial   CRTI ")).toBe("Comercial CRTI");
  });

  it("vazio vira sem nome (a tela volta a mostrar o número)", () => {
    expect(normalizarNomeDoNumero("   ")).toBeNull();
    expect(normalizarNomeDoNumero("")).toBeNull();
    expect(normalizarNomeDoNumero(null)).toBeNull();
    expect(normalizarNomeDoNumero(undefined)).toBeNull();
  });

  it("corta no teto", () => {
    expect(normalizarNomeDoNumero("x".repeat(100))).toHaveLength(TETO_DO_NOME_DO_NUMERO);
  });

  it("conectar número novo pergunta o nome antes do QR e o cartão tem Renomear", () => {
    const tela = readFileSync("components/connections/ConnectionsClient.tsx", "utf8");
    expect(tela).toContain("onClick={() => setPerguntandoNome(true)}");
    expect(tela).toContain("display_name: displayName");
    expect(tela).toContain("<RenomearNumero channelId={c.id}");
  });
});
