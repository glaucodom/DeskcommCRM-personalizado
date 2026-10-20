// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  descricaoDaReuniao,
  nomeCurtoDoAgente,
  tituloDaReuniao,
} from "@/lib/personalizacoes/dados-do-lead-na-agenda";

describe("o evento da agenda diz de quem é a reunião", () => {
  const lead = {
    nome: "Glauco Satler",
    empresa: "Contrutora Minas Gerais",
    telefone: "+5531999916692",
    email: "xgedsistemas@gmail.com",
    segmentos: ["construção pesada", "pedreira"],
    agente: "Clara 1 (Comercial Não Clientes CRTI)",
  };

  it("título com empresa e primeiro nome", () => {
    expect(tituloDaReuniao("Apresentação CRTI ERP", lead)).toBe(
      "Apresentação CRTI ERP — Contrutora Minas Gerais (Glauco)",
    );
  });

  it("⛔ sem empresa nem nome o título continua o do tipo", () => {
    expect(tituloDaReuniao("Apresentação CRTI ERP", {})).toBe("Apresentação CRTI ERP");
  });

  it("só o nome, sem empresa", () => {
    expect(tituloDaReuniao("Apresentação CRTI ERP", { nome: "Glauco Satler" })).toBe(
      "Apresentação CRTI ERP — Glauco",
    );
  });

  it("descrição diz quem agendou, a empresa, o contato e o segmento", () => {
    expect(descricaoDaReuniao(lead)).toBe(
      [
        "Agendado pela Clara 1 (IA), pelo WhatsApp.",
        "",
        "Empresa: Contrutora Minas Gerais",
        "Contato: Glauco Satler",
        "WhatsApp: +5531999916692",
        "E-mail: xgedsistemas@gmail.com",
        "Segmento: construção pesada, pedreira",
      ].join("\n"),
    );
  });

  it("⛔ campo vazio não vira linha vazia nem 'null'", () => {
    const d = descricaoDaReuniao({ nome: "Ana", empresa: null, segmentos: [] });
    expect(d).toBe("Agendado pela IA, pelo WhatsApp.\n\nContato: Ana");
    expect(d).not.toMatch(/null|undefined/);
  });

  it("nome curto do agente", () => {
    expect(nomeCurtoDoAgente("Clara 2 (Comercial Clientes CRTI)")).toBe("Clara 2");
    expect(nomeCurtoDoAgente(null)).toBe("");
  });
});
