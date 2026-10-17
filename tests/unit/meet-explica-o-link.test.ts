/**
 * Personalização do fork: quando o compromisso tem convidado com e-mail, a mensagem
 * automática do link do Meet explica que é o link da reunião, o mesmo do convite.
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
  it("com convidado, explica que o link é o mesmo do convite por e-mail", () => {
    expect(textoDoCompromisso({ ...base, comConvite: true })).toBe(
      "Sua reunião está marcada para 02/01/2030, 10:05 (America/Sao_Paulo). Link do Google Meet: https://meet.google.com/abc-defg-hij Esse é o link da sua reunião, o mesmo do convite enviado para o seu e-mail.",
    );
  });

  it("sem convidado, o texto é o de sempre", () => {
    expect(textoDoCompromisso({ ...base })).toBe(
      "Sua reunião está marcada para 02/01/2030, 10:05 (America/Sao_Paulo). Link do Google Meet: https://meet.google.com/abc-defg-hij",
    );
  });

  it("sem link (presencial), não fala de convite nem de link", () => {
    expect(textoDoCompromisso({ ...base, url: null, comConvite: true })).not.toContain("link");
  });

  it("traduz para o idioma do contato", () => {
    expect(textoDoCompromisso({ ...base, idioma: "es", comConvite: true })).toContain("Ese es el enlace de tu reunión");
  });
});
