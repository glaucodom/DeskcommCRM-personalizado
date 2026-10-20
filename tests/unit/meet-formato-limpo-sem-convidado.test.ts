// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { textoDoCompromisso } from "@/lib/agenda/texto-do-compromisso";

/**
 * Personalização do fork: a mensagem automática do link do Meet sai no formato limpo
 * ("(horário de Brasília)" e o link na linha de baixo) mesmo quando o agendamento não tem
 * `guest_email`. `guest_email` é o participante da equipe, quase sempre vazio, e o formato
 * antigo "(America/Sao_Paulo). Link do Google Meet: …" chegou ao cliente por causa disso.
 */
describe("o texto do Meet não depende de guest_email", () => {
  it("⛔ a entrega liga o formato limpo pela existência do Meet, não por guest_email", () => {
    const fonte = readFileSync("lib/agent-engine/agent/meet-delivery.ts", "utf8");
    expect(fonte).toMatch(/comConvite:\s*ehMeet,/);
    expect(fonte).not.toMatch(/comConvite:\s*Boolean\(row\.guest_email/);
  });

  it("CONTROLE: com o formato limpo o fuso de São Paulo sai como horário de Brasília", () => {
    const texto = textoDoCompromisso({
      startsAt: "2026-10-21T16:00:00.000Z",
      timeZone: "America/Sao_Paulo",
      url: "https://meet.google.com/abc-defg-hij",
      idioma: "pt-BR",
      comConvite: true,
    });
    expect(texto).toBe(
      "Sua reunião está marcada para 21/10/2026, 13:00 (horário de Brasília).\nLink do Google Meet: https://meet.google.com/abc-defg-hij",
    );
  });
});
