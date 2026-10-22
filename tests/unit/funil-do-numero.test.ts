/**
 * Fork #25 — o número conectado pode ter funil próprio: o lead que nasce da
 * conversa desse número entra nele.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/leads/activity-emitter", () => ({ emitLeadActivity: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/contacts/cliente-pela-agenda", () => ({ lerClientePelaAgenda: async () => false }));
const campanha = vi.hoisted(() => ({ origem: null as null | { pipelineId: string | null; stageId: string | null } }));
vi.mock("@/lib/campanhas/origem-do-lead", () => ({
  origemDeCampanhaDaConversa: async () => campanha.origem,
  marcaDaOrigem: () => null,
}));

import { garantirLeadDaConversa } from "@/lib/leads/nascimento-do-lead";

interface Cena {
  canalDaConversa: string | null;
  funilDoCanal: string | null;
  funisArquivados: string[];
  etapasPorFunil: Record<string, string>;
}

function fakeDb(c: Cena) {
  const rpcs: Array<{ nome: string; args: Record<string, unknown> }> = [];
  const tabela = (nome: string) => {
    const f: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = (k: string, v: unknown) => {
      f[k] = v;
      return b;
    };
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = async () => {
      if (nome === "contacts")
        return { data: { is_blocked: false, is_personal: false, display_name: "Ana", name: "Ana", phone_number: "5511", source: null, source_metadata: null, first_service_at: null } };
      if (nome === "crm_leads") return { data: null };
      if (nome === "conversations") return { data: { channel_session_id: c.canalDaConversa } };
      if (nome === "channel_sessions") return { data: { funil_id: c.funilDoCanal } };
      if (nome === "crm_pipelines") {
        if (f.is_default === true) return { data: { id: "funil-padrao" } };
        const id = f.id as string;
        return { data: c.funisArquivados.includes(id) ? null : { id } };
      }
      if (nome === "crm_stages") {
        const id = c.etapasPorFunil[f.pipeline_id as string];
        return { data: id ? { id } : null };
      }
      return { data: null };
    };
    return b;
  };
  return {
    rpcs,
    from: (n: string) => tabela(n),
    rpc: async (nome: string, args: Record<string, unknown>) => {
      rpcs.push({ nome, args });
      return { data: "lead-novo", error: null };
    },
  };
}

const base: Cena = {
  canalDaConversa: "canal-1",
  funilDoCanal: "funil-vip",
  funisArquivados: [],
  etapasPorFunil: { "funil-padrao": "etapa-padrao", "funil-vip": "etapa-vip", "funil-camp": "etapa-camp" },
};

const dados = { organizationId: "o1", contactId: "c1", conversationId: "v1", nomeDoContato: "Ana" };

async function nascer(c: Cena) {
  const db = fakeDb(c);
  const r = await garantirLeadDaConversa(db as never, dados);
  return { r, rpc: db.rpcs.find((x) => x.nome === "fn_nascer_lead_da_conversa") };
}

beforeEach(() => {
  campanha.origem = null;
});

describe("funil do número", () => {
  it("o lead nasce no funil vinculado ao número, na primeira etapa", async () => {
    const { r, rpc } = await nascer(base);
    expect(r).toMatchObject({ criado: true, pipelineId: "funil-vip", stageId: "etapa-vip" });
    expect(rpc?.args).toMatchObject({ p_pipeline: "funil-vip", p_stage: "etapa-vip" });
  });

  it("número sem funil cai no funil padrão da empresa", async () => {
    const { r } = await nascer({ ...base, funilDoCanal: null });
    expect(r).toMatchObject({ criado: true, pipelineId: "funil-padrao" });
  });

  it("funil do número arquivado ou sem etapa cai no padrão (o lead não pode deixar de nascer)", async () => {
    expect((await nascer({ ...base, funisArquivados: ["funil-vip"] })).r).toMatchObject({ pipelineId: "funil-padrao" });
    expect((await nascer({ ...base, etapasPorFunil: { "funil-padrao": "etapa-padrao" } })).r).toMatchObject({ pipelineId: "funil-padrao" });
  });

  it("conversa sem número cai no padrão", async () => {
    expect((await nascer({ ...base, canalDaConversa: null })).r).toMatchObject({ pipelineId: "funil-padrao" });
  });

  it("a campanha que declara funil ganha do número", async () => {
    campanha.origem = { pipelineId: "funil-camp", stageId: null };
    expect((await nascer(base)).r).toMatchObject({ pipelineId: "funil-camp", stageId: "etapa-camp" });
  });
});

describe("coluna e rota", () => {
  it("a coluna nasce em personalizacoes.sql, com on delete set null", () => {
    const sql = readFileSync("supabase/personalizacoes.sql", "utf8");
    expect(sql).toMatch(/alter table public\.channel_sessions\s+add column if not exists funil_id uuid references public\.crm_pipelines\(id\) on delete set null/);
  });
});
