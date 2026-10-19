import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cnpjVazioOuValido, mascaraCnpj, segmentosDeTexto } from "@/lib/personalizacoes/dados-da-empresa";

describe("dados da empresa (fork)", () => {
  it("mascara o CNPJ enquanto digita", () => {
    expect(mascaraCnpj("12")).toBe("12");
    expect(mascaraCnpj("12345678")).toBe("12.345.678");
    expect(mascaraCnpj("12345678000199")).toBe("12.345.678/0001-99");
    expect(mascaraCnpj("12.345.678/0001-99999")).toBe("12.345.678/0001-99");
  });
  it("CNPJ vazio vale; preenchido precisa ter 14 números válidos", () => {
    expect(cnpjVazioOuValido("")).toBe(true);
    expect(cnpjVazioOuValido("12.345.678/0001-99")).toBe(true);
    expect(cnpjVazioOuValido("12.345.678")).toBe(false);
    expect(cnpjVazioOuValido("00.000.000/0000-00")).toBe(false);
  });
  it("segmentos separados por vírgula ou ponto e vírgula, sem repetir", () => {
    expect(segmentosDeTexto("Concreteira, Pedreira; Concreteira ,")).toEqual(["Concreteira", "Pedreira"]);
    expect(segmentosDeTexto("")).toEqual([]);
  });
});

describe("cerca do merge com o oficial", () => {
  it("o painel do Inbox e o Novo Lead continuam usando os dados da empresa em vez de valor", () => {
    const painel = readFileSync("components/inbox/CRMSidePanel.tsx", "utf8");
    expect(painel).toContain("DadosDaEmpresaDoContato");
    expect(painel).toContain("dadosDaEmpresa=");
    const lead = readFileSync("components/kanban/NewLeadDialog.tsx", "utf8");
    expect(lead).toContain("dadosDaEmpresa");
    expect(lead).toContain("@/lib/personalizacoes/dados-da-empresa");
    expect(readFileSync("app/app/pipelines/[id]/_client.tsx", "utf8")).toContain("dadosDaEmpresa=");
  });
});
