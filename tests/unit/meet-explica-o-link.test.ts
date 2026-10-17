/**
 * Personalização do fork: quando o compromisso tem convidado com e-mail, a mensagem
 * automática do Meet sai limpa — a data numa linha, o link na de baixo, fuso dito
 * como "horário de Brasília". Sem convidado, o texto é o de sempre.
 */
import { describe, expect, it } from "vitest";
import { textoDoCompromisso } from "@/lib/agenda/texto-do-compromisso";

const base = {
  startsAt: "2030-01-02T13:05:00Z",
  timeZone: "America/Sao_Paulo",
  url: "https://meet.google.com/abc-defg-hij",
  idioma: "pt-BR" as const,
};

describe("mensagem do link do Meet (personalização do fork)", () => {
  it("com convidado, vai em duas linhas e diz horário de Brasília", () => {
    expect(textoDoCompromisso({ ...base, comConvite: true })).toBe(
      "Sua reunião está marcada para 02/01/2030, 10:05 (horário de Brasília).\nLink do Google Meet: https://meet.google.com/abc-defg-hij",
    );
  });

  it("outro fuso mantém o nome do fuso", () => {
    expect(textoDoCompromisso({ ...base, timeZone: "America/Manaus", comConvite: true })).toContain("(America/Manaus).\n");
  });

  it("não carrega explicação solta: a explicação é fala da Clara", () => {
    expect(textoDoCompromisso({ ...base, comConvite: true })).not.toContain("mesmo do convite");
  });

  it("sem convidado, o texto é o de sempre", () => {
    expect(textoDoCompromisso({ ...base })).toBe(
      "Sua reunião está marcada para 02/01/2030, 10:05 (America/Sao_Paulo). Link do Google Meet: https://meet.google.com/abc-defg-hij",
    );
  });

  it("sem link (presencial), não fala de link", () => {
    expect(textoDoCompromisso({ ...base, url: null, comConvite: true })).not.toContain("Link");
  });

  it("traduz para o idioma do contato", () => {
    expect(textoDoCompromisso({ ...base, idioma: "es", comConvite: true })).toContain("hora de Brasilia");
  });
});
