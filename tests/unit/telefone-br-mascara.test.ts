import { describe, expect, it } from "vitest";
import {
  emailValido,
  mascaraTelefoneBr,
  telefoneBrParaE164,
  telefoneBrVazio,
  TELEFONE_BR_INICIAL,
} from "@/lib/personalizacoes/telefone-br-mascara";

describe("máscara do telefone BR (fork)", () => {
  it("nasce com +55 e vazio conta como não preenchido", () => {
    expect(mascaraTelefoneBr("")).toBe(TELEFONE_BR_INICIAL);
    expect(telefoneBrVazio(TELEFONE_BR_INICIAL)).toBe(true);
    expect(telefoneBrVazio("+55 (4")).toBe(false);
  });
  it("formata celular e fixo enquanto digita", () => {
    expect(mascaraTelefoneBr("4")).toBe("+55 (4");
    expect(mascaraTelefoneBr("41999")).toBe("+55 (41) 999");
    expect(mascaraTelefoneBr("41999998888")).toBe("+55 (41) 99999-8888");
    expect(mascaraTelefoneBr("4133334444")).toBe("+55 (41) 3333-4444");
  });
  it("aceita colagem com +55 e valor já gravado", () => {
    expect(mascaraTelefoneBr("+5541999998888")).toBe("+55 (41) 99999-8888");
    expect(mascaraTelefoneBr("+55 (41) 99999-8888")).toBe("+55 (41) 99999-8888");
  });
  it("volta a E.164 só quando completo", () => {
    expect(telefoneBrParaE164("+55 (41) 99999-8888")).toBe("+5541999998888");
    expect(telefoneBrParaE164("+55 (41) 3333-4444")).toBe("+554133334444");
    expect(telefoneBrParaE164("+55 (41) 9999")).toBeNull();
  });
  it("valida e-mail", () => {
    expect(emailValido("a@empresa.com.br")).toBe(true);
    expect(emailValido("a@empresa")).toBe(false);
    expect(emailValido("a empresa.com")).toBe(false);
  });
});

describe("cerca do merge com o oficial", () => {
  it("os diálogos de contato continuam usando a máscara e as validações do fork", async () => {
    const { readFileSync } = await import("node:fs");
    for (const arq of ["components/contacts/NewContactDialog.tsx", "components/contacts/EditContactDialog.tsx"]) {
      const src = readFileSync(arq, "utf8");
      expect(src, arq).toContain("@/lib/personalizacoes/telefone-br-mascara");
      expect(src, arq).toContain("mascaraTelefoneBr");
      expect(src, arq).toContain("emailValido");
    }
    expect(readFileSync("components/contacts/NewContactDialog.tsx", "utf8")).toContain("empresa");
  });
});
