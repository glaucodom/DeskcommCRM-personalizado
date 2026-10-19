import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contactPatchSchema } from "@/lib/schemas/contacts";

describe("qualificação no contato (empresa, CNPJ, segmentos)", () => {
  it("aceita CNPJ formatado e guarda só os 14 números", () => {
    const r = contactPatchSchema.parse({ cnpj: "12.345.678/0001-95", empresa: " Acme ", segmentos: ["mineração", "pedreira"] });
    expect(r.cnpj).toBe("12345678000195");
    expect(r.empresa).toBe("Acme");
    expect(r.segmentos).toEqual(["mineração", "pedreira"]);
  });
  it("recusa CNPJ com tamanho errado e aceita vazio (apagar)", () => {
    expect(contactPatchSchema.safeParse({ cnpj: "123" }).success).toBe(false);
    expect(contactPatchSchema.parse({ cnpj: "" }).cnpj).toBe("");
  });
  it("as colunas nascem em personalizacoes.sql e a rota as devolve", () => {
    const sql = readFileSync("supabase/personalizacoes.sql", "utf8");
    for (const c of ["empresa text", "cnpj text", "segmentos text[]"]) expect(sql).toContain(c);
    expect(readFileSync("app/api/v1/contacts/_handler.ts", "utf8")).toContain("empresa, cnpj, segmentos");
  });
});
