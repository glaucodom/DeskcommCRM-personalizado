/**
 * Personalização do fork: `registrar_dados_do_lead` grava nome, empresa, CNPJ, e-mail e
 * campos livres do lead nas tabelas do CRM (contacts, people, companies, company_people).
 */
import { describe, expect, it } from "vitest";
import { aplicarRegistroDoLead } from "@/lib/agent-engine/agent/registrar-dados-do-lead";

type Chamada = { sql: string; valores: unknown[] };

/** Banco falso: responde só o que a ferramenta lê e guarda toda escrita. */
function bancoFalso(contato: Record<string, unknown>, opcoes: { empresaPorCnpj?: string; empresaLigada?: Record<string, unknown> } = {}) {
  const chamadas: Chamada[] = [];
  const db = {
    async query(sql: string, valores: unknown[] = []) {
      chamadas.push({ sql, valores });
      const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (s.startsWith("select name, display_name")) return { rows: [contato], rowCount: 1 };
      if (s.startsWith("select id from companies where organization_id = $1 and normalized_cnpj = $2"))
        return { rows: opcoes.empresaPorCnpj ? [{ id: opcoes.empresaPorCnpj }] : [], rowCount: 0 };
      if (s.startsWith("select c.id, c.normalized_cnpj"))
        return { rows: opcoes.empresaLigada ? [opcoes.empresaLigada] : [], rowCount: 0 };
      if (s.startsWith("select id from companies")) return { rows: [], rowCount: 0 };
      if (s.startsWith("insert into companies")) return { rows: [{ id: "emp-1" }], rowCount: 1 };
      if (s.startsWith("insert into people")) return { rows: [{ id: "pes-1" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  };
  return { db, chamadas };
}

const IDS = { tenantId: "org-1", leadId: "lead-1" };
const SEM_NOME = { name: null, display_name: "+5531999916692", phone_number: "+5531999916692", email: null, person_id: null };

describe("registrar_dados_do_lead (personalização do fork)", () => {
  it("grava o nome e troca o display_name quando o atual é só o telefone", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Carlos" });
    expect(r).toMatchObject({ ok: true, registrado: ["nome"] });
    const up = chamadas.find((c) => c.sql.includes("update contacts"))!;
    expect(up.valores.slice(0, 5)).toEqual(["org-1", "lead-1", "Carlos", true, null]);
  });

  it("não troca um display_name bom que já tem o mesmo primeiro nome", async () => {
    const { db, chamadas } = bancoFalso({ ...SEM_NOME, display_name: "Glauco Dom" });
    await aplicarRegistroDoLead(db, IDS, { nome: "Glauco" });
    const up = chamadas.find((c) => c.sql.includes("update contacts"))!;
    expect(up.valores[3]).toBe(false);
  });

  it("troca um display_name que não bate com o nome dito (ex.: apelido do perfil)", async () => {
    const { db, chamadas } = bancoFalso({ ...SEM_NOME, display_name: "Mãe" });
    await aplicarRegistroDoLead(db, IDS, { nome: "Maria" });
    expect(chamadas.find((c) => c.sql.includes("update contacts"))!.valores[3]).toBe(true);
  });

  it("empresa + CNPJ criam a empresa (CNPJ formatado e normalizado), a pessoa e o vínculo", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Carlos", empresa: "Pedreira Central", cnpj: "08.970.609/0001-03" });
    expect(r.registrado).toEqual(expect.arrayContaining(["nome", "empresa", "cnpj"]));
    const emp = chamadas.find((c) => c.sql.includes("insert into companies"))!;
    expect(emp.valores).toEqual(["org-1", "Pedreira Central", "08.970.609/0001-03", "08970609000103"]);
    expect(chamadas.some((c) => c.sql.includes("insert into people"))).toBe(true);
    expect(chamadas.some((c) => c.sql.includes("update contacts set person_id"))).toBe(true);
    expect(chamadas.some((c) => c.sql.includes("insert into company_people"))).toBe(true);
  });

  it("CNPJ que já existe na organização reaproveita a empresa em vez de duplicar", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME, { empresaPorCnpj: "emp-existente" });
    await aplicarRegistroDoLead(db, IDS, { nome: "Carlos", cnpj: "08970609000103" });
    expect(chamadas.some((c) => c.sql.includes("insert into companies"))).toBe(false);
    const vinc = chamadas.find((c) => c.sql.includes("insert into company_people"))!;
    expect(vinc.valores[1]).toBe("emp-existente");
  });

  it("CNPJ chegando depois completa a empresa já ligada à pessoa", async () => {
    const { db, chamadas } = bancoFalso(
      { ...SEM_NOME, person_id: "pes-9" },
      { empresaLigada: { id: "emp-9", normalized_cnpj: null } },
    );
    await aplicarRegistroDoLead(db, IDS, { cnpj: "08970609000103" });
    expect(chamadas.some((c) => c.sql.includes("insert into companies"))).toBe(false);
    const up = chamadas.find((c) => c.sql.includes("update companies"))!;
    expect(up.valores).toEqual(["org-1", "emp-9", null, "08970609000103", "08.970.609/0001-03"]);
  });

  it("CNPJ inválido vira aviso e não grava o CNPJ; o resto é gravado", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    const r = await aplicarRegistroDoLead(db, IDS, { empresa: "Pedreira Central", cnpj: "123" });
    expect(r.ok).toBe(true);
    expect(r.avisos[0]).toContain("cnpj_invalido");
    expect(r.registrado).toContain("empresa");
    expect(r.registrado).not.toContain("cnpj");
    expect(chamadas.find((c) => c.sql.includes("insert into companies"))!.valores[3]).toBeNull();
  });

  it("campo fora da lista é recusado com ensino, sem tocar no banco", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Carlos", organization_id: "outra-org" });
    expect(r.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("sem nada para registrar, devolve erro de ensino", async () => {
    const { db } = bancoFalso(SEM_NOME);
    const r = await aplicarRegistroDoLead(db, IDS, { nome: " " });
    expect(r.ok).toBe(false);
  });

  it("tenant e lead vêm do closure, nunca do que o modelo mandou", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    await aplicarRegistroDoLead(db, IDS, { nome: "Carlos" });
    expect(chamadas.every((c) => c.valores[0] === "org-1")).toBe(true);
  });

  it("segmento, como conheceu e indicação vão para custom_fields", async () => {
    const { db, chamadas } = bancoFalso(SEM_NOME);
    await aplicarRegistroDoLead(db, IDS, { segmento: "construção pesada", como_conheceu: "indicação", indicado_por: "Pedreira Central" });
    const up = chamadas.find((c) => c.sql.includes("update contacts"))!;
    expect(JSON.parse(String(up.valores[5]))).toEqual({
      segmento: "construção pesada",
      como_conheceu: "Indicação",
      indicado_por: "Pedreira Central",
    });
  });
});
