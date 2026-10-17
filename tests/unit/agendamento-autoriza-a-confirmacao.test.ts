/**
 * Personalização do fork: o compromisso que a agenda acabou de gravar entra
 * como evidência do revisor de promessa — senão "Está agendado para segunda às
 * 13h" era vetado e o cliente ficava sem resposta depois de marcar.
 */
import { describe, expect, it } from "vitest";
import { criarEvidenciasComerciaisDoTurno } from "@/lib/agent-engine/guardrails/promise/evidencias-comerciais";

const marcado = {
  marcado: true,
  aguarda_confirmacao: false,
  compromisso: {
    id: "6cc4a018-37ee-4456-80c7-84da8330198b",
    starts_at: "2026-10-19T16:00:00Z",
    status: "confirmed",
    time_zone: "America/Sao_Paulo",
    meeting_state: "pending",
    quando: "segunda-feira, 19/10/2026, 13:00",
  },
};

describe("agendamento autoriza a confirmação (personalização do fork)", () => {
  it("o compromisso marcado vira evidência com data, situação, Meet e convite", () => {
    const e = criarEvidenciasComerciaisDoTurno([]);
    e.registrarAgendamento(marcado, { guest_email: "lead@exemplo.com" });
    const [ev] = e.ler("Pronto, está agendado para segunda às 13h");
    expect(ev?.origem).toBe("agenda");
    expect(ev?.referencia).toBe(marcado.compromisso.id);
    expect(ev?.conteudo).toContain("segunda-feira, 19/10/2026, 13:00");
    expect(ev?.conteudo).toContain("confirmado");
    expect(ev?.conteudo).toContain("WhatsApp");
    expect(ev?.conteudo).toContain("lead@exemplo.com");
  });

  it("reservado aguardando a equipe é dito como reservado, nunca confirmado", () => {
    const e = criarEvidenciasComerciaisDoTurno([]);
    e.registrarAgendamento({ ...marcado, aguarda_confirmacao: true });
    expect(e.ler()[0]?.conteudo).toContain("RESERVADO");
    expect(e.ler()[0]?.conteudo).not.toContain("Situação: confirmado");
  });

  it("sem convidado aceito, não fala de convite por e-mail", () => {
    const e = criarEvidenciasComerciaisDoTurno([]);
    e.registrarAgendamento(marcado);
    expect(e.ler()[0]?.conteudo).not.toContain("e-mail");
  });

  it("recusa, erro e retorno sem compromisso não autorizam nada", () => {
    const e = criarEvidenciasComerciaisDoTurno([]);
    for (const r of [
      { marcado: false, mensagem: "NADA foi marcado" },
      { error: "falhou" },
      { marcado: true },
      { marcado: true, compromisso: { id: "x" } },
      "Está agendado",
      null,
    ])
      e.registrarAgendamento(r, { guest_email: "lead@exemplo.com" });
    expect(e.ler()).toEqual([]);
  });

  it("remarcação também autoriza", () => {
    const e = criarEvidenciasComerciaisDoTurno([]);
    e.registrarAgendamento({ remarcado: true, compromisso: marcado.compromisso });
    expect(e.ler()[0]?.conteudo).toContain("remarcado");
  });
});
