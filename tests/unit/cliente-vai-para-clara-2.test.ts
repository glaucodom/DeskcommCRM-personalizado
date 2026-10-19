import { describe, expect, it, vi } from "vitest";

import { resolveTurnAgent } from "@/lib/agent-engine/agent/resolve-turn-agent";
import { INTENCAO_DO_CLIENTE, contatoEhCliente, temEtiquetaDeCliente } from "@/lib/personalizacoes/cliente-para-clara-2";

const membros = [
  { agentId: "clara-1", intentName: "comercial_e_geral", intentDescription: "resto", examples: [] },
  { agentId: "clara-2", intentName: INTENCAO_DO_CLIENTE, intentDescription: "cliente", examples: [] },
];
const router = { id: "r1", name: "R", classifierModel: "m", classifierProvider: null, sticky: true, minConfidence: 0.6, fallbackAgentId: "clara-1", members: membros };
const entrada = { tenantId: "o", leadId: "c", jobId: "j", channelSessionId: "s", conversationId: "v", signal: "oi", stickyAgentId: "clara-1", stickyIntent: "comercial_e_geral" };
const cfg = (agentId: string) => ({ agentId }) as never;

function deps(ehCliente: boolean, publicado = true) {
  const classifyIntent = vi.fn();
  return {
    classifyIntent,
    d: {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      agenteDaCampanha: vi.fn().mockResolvedValue(null),
      loadActiveRouter: vi.fn().mockResolvedValue(router),
      loadPublishedAgentConfigById: vi.fn(async (_d: unknown, _o: unknown, id: string) => (id === "clara-2" && !publicado ? null : cfg(id))),
      loadPublishedAgentConfig: vi.fn(),
      contatoEhCliente: vi.fn().mockResolvedValue(ehCliente),
      classifyIntent,
      consultarJev: vi.fn(() => ({ estado: Promise.resolve("desligada"), escolha: Promise.resolve(null), modo: Promise.resolve("comparacao"), observar: vi.fn() })),
      temIaDeSempre: vi.fn().mockResolvedValue(true),
      registrarDecisao: vi.fn(),
    } as never,
  };
}

describe("cliente vai para a Clara 2", () => {
  it("etiqueta cliente: Clara 2 atende, mesmo com a conversa grudada na Clara 1 e sem classificar", async () => {
    const { d, classifyIntent } = deps(true);
    const out = await resolveTurnAgent({} as never, {} as never, entrada, d);
    expect(out.config?.agentId).toBe("clara-2");
    expect(classifyIntent).not.toHaveBeenCalled();
  });

  it("sem etiqueta: segue o roteador de sempre (fica na Clara 1)", async () => {
    const { d, classifyIntent } = deps(false);
    classifyIntent.mockResolvedValue({ intentName: "comercial_e_geral", confidence: 0.9 });
    const out = await resolveTurnAgent({} as never, {} as never, entrada, d);
    expect(out.config?.agentId).toBe("clara-1");
  });

  it("Clara 2 sem versão publicada: não cala, volta para a régua do roteador", async () => {
    const { d, classifyIntent } = deps(true, false);
    classifyIntent.mockResolvedValue({ intentName: "comercial_e_geral", confidence: 0.9 });
    const out = await resolveTurnAgent({} as never, {} as never, entrada, d);
    expect(out.config?.agentId).toBe("clara-1");
  });

  it("a etiqueta vale sem diferença de maiúsculas ou espaços", () => {
    expect(temEtiquetaDeCliente(["Lead", " Cliente "])).toBe(true);
    expect(temEtiquetaDeCliente(["lead"])).toBe(false);
    expect(temEtiquetaDeCliente(null)).toBe(false);
  });

  it("erro ao ler as etiquetas não derruba o turno", async () => {
    await expect(contatoEhCliente({ query: () => Promise.reject(new Error("banco")) } as never, "o", "c")).resolves.toBe(false);
  });
});
