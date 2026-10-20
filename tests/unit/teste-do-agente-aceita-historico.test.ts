// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { testRunSchema } from "@/lib/ai/agents/validation";

const capturado: { mensagens?: Array<{ direction: string; body: string; sent_at: string }> } = {};

vi.mock("@/lib/agent-engine/agent/agent-config", () => ({
  loadAgentVersionConfig: vi.fn(async () => ({ id: "agente" })),
}));
vi.mock("@/lib/agent-engine/agent/inbound-turn", () => ({
  runAgentPreview: vi.fn(async (_d: unknown, _p: unknown, preview: { context: { context: { messages: never[] } } }) => {
    capturado.mensagens = preview.context.context.messages;
  }),
}));

import { testAgentVersion } from "@/lib/agent-engine/agent/sandbox";

/** Fork: o teste do agente pode receber a conversa até aqui, para testar turno a turno. */
describe("o teste do agente aceita histórico", () => {
  it("o schema aceita histórico e continua recusando campo desconhecido", () => {
    expect(
      testRunSchema.safeParse({
        sample_message: "sim",
        sample_history: [{ direction: "outbound", body: "Topa?" }],
      }).success,
    ).toBe(true);
    expect(testRunSchema.safeParse({ sample_message: "oi", intruso: 1 }).success).toBe(false);
    expect(
      testRunSchema.safeParse({ sample_message: "oi", sample_history: [{ direction: "x", body: "a" }] }).success,
    ).toBe(false);
  });

  it("⛔ o histórico vai ANTES da última fala, em ordem, com horários crescentes", async () => {
    const agora = new Date("2026-10-20T15:00:00.000Z");
    await testAgentVersion({} as never, { clock: () => agora } as never, {
      organizationId: "o",
      agentId: "a",
      versionId: "v",
      runId: "r",
      sampleMessage: "sim",
      sampleHistory: [
        { direction: "inbound", body: "oi" },
        { direction: "outbound", body: "Bom dia! Aqui é a Clara." },
      ],
      channelId: null,
    });
    const m = capturado.mensagens!;
    expect(m.map((x) => x.body)).toEqual(["oi", "Bom dia! Aqui é a Clara.", "sim"]);
    expect(m.map((x) => x.direction)).toEqual(["inbound", "outbound", "inbound"]);
    const horas = m.map((x) => new Date(x.sent_at).getTime());
    expect([...horas].sort((a, b) => a - b)).toEqual(horas);
  });

  it("CONTROLE: sem histórico é a mensagem única de sempre", async () => {
    await testAgentVersion({} as never, { clock: () => new Date("2026-10-20T15:00:00.000Z") } as never, {
      organizationId: "o", agentId: "a", versionId: "v", runId: "r", sampleMessage: "oi", channelId: null,
    });
    expect(capturado.mensagens!.map((x) => x.body)).toEqual(["oi"]);
  });
});
