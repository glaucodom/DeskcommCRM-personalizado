import type pg from "pg";
import { loadAgentVersionConfig } from "./agent-config";
import { runAgentPreview, type InboundTurnDeps } from "./inbound-turn";
import { newPreviewResult, scenarioContext } from "./preview";
export async function testAgentVersion(
  pool: pg.Pool,
  deps: InboundTurnDeps,
  input: {
    organizationId: string;
    agentId: string;
    versionId: string;
    runId: string;
    sampleMessage: string;
    /** Fork: a conversa até aqui, mais antiga primeiro (teste turno a turno). */
    sampleHistory?: Array<{ direction: "inbound" | "outbound"; body: string }>;
    sampleContact?: { name?: string; phone?: string };
    channelId: string | null;
  },
) {
  const agent = await loadAgentVersionConfig(
    pool,
    input.organizationId,
    input.agentId,
    input.versionId,
  );
  if (!agent) throw new Error("preview_version_unavailable");
  const result = newPreviewResult();
  const agora = deps.clock?.() ?? new Date();
  const historico = input.sampleHistory ?? [];
  // Cada fala do histórico ganha 1 minuto de diferença, terminando um minuto antes da última.
  const mensagens = [
    ...historico.map((m, i) => ({
      direction: m.direction,
      body: m.body,
      sent_at: new Date(agora.getTime() - (historico.length - i + 1) * 60_000).toISOString(),
    })),
    { direction: "inbound" as const, body: input.sampleMessage, sent_at: agora.toISOString() },
  ];
  const context = scenarioContext(mensagens, input.sampleContact);
  await runAgentPreview(deps, pool, {
    kind: "sandbox",
    organizationId: input.organizationId,
    runId: input.runId,
    agent,
    context,
    contactId: null,
    channelId: input.channelId,
    result,
  });
  return result;
}
