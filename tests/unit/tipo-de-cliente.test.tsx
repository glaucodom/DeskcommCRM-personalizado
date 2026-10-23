/**
 * Fork #20 — tipo de cliente por organização: B2B ("empresas", padrão) ou B2C ("pessoas").
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aplicarRegistroDoLead,
  dataDeNascimentoValida,
  definicaoDaFerramentaParaPessoas,
  registrarDadosPessoasShape,
} from "@/lib/agent-engine/agent/registrar-dados-do-lead";
import {
  cpfVazioOuValido,
  ehPessoas,
  lerTipoDeClienteSql,
  mascaraCpf,
  semCamposDeEmpresa,
  tipoDeCliente,
} from "@/lib/personalizacoes/tipo-de-cliente";
import { contactCreateSchema } from "@/lib/schemas/contacts";
import { RECURSOS_OPCIONAIS } from "@/lib/recursos-opcionais/catalogo";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";

const tipoMock = vi.hoisted(() => ({ pessoas: false }));
vi.mock("@/hooks/contacts/useTipoDeCliente", () => ({
  useTipoDeCliente: () => ({ tipo: tipoMock.pessoas ? "pessoas" : "empresas", pessoas: tipoMock.pessoas }),
  recarregarTipoDeCliente: vi.fn(),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ currency: "BRL", country: null }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

const CPF_VALIDO = "529.982.247-25";

describe("tipoDeCliente (helper único)", () => {
  it("padrão é empresas: ausente, vazio ou inválido", () => {
    expect(tipoDeCliente(undefined)).toBe("empresas");
    expect(tipoDeCliente(null)).toBe("empresas");
    expect(tipoDeCliente({})).toBe("empresas");
    expect(tipoDeCliente({ tipo_de_cliente: "outra-coisa" })).toBe("empresas");
    expect(tipoDeCliente({ tipo_de_cliente: 3 })).toBe("empresas");
    expect(ehPessoas({ visibilidade_por_numero: true })).toBe(false);
  });

  it("pessoas só quando o valor é exatamente 'pessoas'", () => {
    expect(tipoDeCliente({ tipo_de_cliente: "pessoas" })).toBe("pessoas");
    expect(tipoDeCliente({ tipo_de_cliente: "empresas" })).toBe("empresas");
    expect(ehPessoas({ tipo_de_cliente: "pessoas" })).toBe(true);
  });

  it("lê do banco e cai em empresas se a org não tem a chave", async () => {
    const db = (tipo: unknown) => ({ query: async () => ({ rows: [{ tipo }] }) }) as never;
    expect(await lerTipoDeClienteSql(db("pessoas"), "o")).toBe("pessoas");
    expect(await lerTipoDeClienteSql(db(null), "o")).toBe("empresas");
    expect(await lerTipoDeClienteSql({ query: async () => ({ rows: [] }) } as never, "o")).toBe("empresas");
  });
});

describe("CPF e corpo da API", () => {
  it("máscara e validação dos dígitos verificadores", () => {
    expect(mascaraCpf("52998224725")).toBe(CPF_VALIDO);
    expect(cpfVazioOuValido("")).toBe(true);
    expect(cpfVazioOuValido(CPF_VALIDO)).toBe(true);
    expect(cpfVazioOuValido("111.111.111-11")).toBe(false);
    expect(cpfVazioOuValido("529.982.247-24")).toBe(false);
    expect(contactCreateSchema.safeParse({ cpf: "123" }).success).toBe(false);
  });

  it("semCamposDeEmpresa tira empresa, cnpj e segmentos e mantém o resto", () => {
    const corpo = { name: "Ana", cpf: CPF_VALIDO, birthdate: "1990-01-02", empresa: "X", cnpj: "1", segmentos: ["a"] };
    expect(semCamposDeEmpresa(corpo)).toEqual({ name: "Ana", cpf: CPF_VALIDO, birthdate: "1990-01-02" });
  });
});

describe("NewContactDialog", () => {
  function desenhar() {
    const qc = new QueryClient();
    return render(
      <QueryClientProvider client={qc}>
        <NewContactDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
  }
  beforeEach(() => {
    tipoMock.pessoas = false;
  });

  it("empresas (padrão): mostra Empresa, CNPJ e Segmentos", () => {
    desenhar();
    expect(screen.getByLabelText("Empresa")).toBeTruthy();
    expect(screen.getByLabelText("CNPJ")).toBeTruthy();
    expect(screen.getByRole("group", { name: /Segmentos/ })).toBeTruthy();
    expect(screen.queryByLabelText(/Data de nascimento/)).toBeNull();
  });

  it("pessoas: sem Empresa/CNPJ/Segmentos, com CPF e data de nascimento", () => {
    tipoMock.pessoas = true;
    desenhar();
    expect(screen.queryByLabelText("Empresa")).toBeNull();
    expect(screen.queryByLabelText("CNPJ")).toBeNull();
    expect(screen.queryByRole("group", { name: /Segmentos/ })).toBeNull();
    expect(screen.getByLabelText(/CPF/)).toBeTruthy();
    expect(screen.getByLabelText(/Data de nascimento/)).toBeTruthy();
  });
});

type Chamada = { sql: string; valores: unknown[] };
function bancoFalso(opcoes: { falhaNoCpf?: boolean } = {}) {
  const chamadas: Chamada[] = [];
  const db = {
    async query(sql: string, valores: unknown[] = []) {
      chamadas.push({ sql, valores });
      const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (s.startsWith("select display_name, phone_number from contacts"))
        return { rows: [{ display_name: "+5531999916692", phone_number: "+5531999916692" }], rowCount: 1 };
      if (opcoes.falhaNoCpf && s.includes("encrypt_cpf")) throw new Error("CPF_ENCRYPTION_KEY ausente");
      return { rows: [], rowCount: 1 };
    },
  };
  return { db: db as never, chamadas };
}
const IDS = { tenantId: "org-1", leadId: "lead-1" };

describe("registrar_dados_do_lead em pessoas", () => {
  it("a definição para o modelo fala de CPF e nascimento e não de CNPJ", () => {
    expect(definicaoDaFerramentaParaPessoas.description).toMatch(/CPF/);
    expect(definicaoDaFerramentaParaPessoas.description).toMatch(/não há empresa, CNPJ/i);
    expect(Object.keys(registrarDadosPessoasShape.shape).sort()).toEqual(["cpf", "data_nascimento", "email", "nome"]);
  });

  it("ignora CNPJ/empresa (campo fora da lista) e não escreve nada", async () => {
    const { db, chamadas } = bancoFalso();
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Ana", empresa: "X", cnpj: "08.970.609/0001-03" }, "pessoas");
    expect(r.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("grava o CPF cifrado (encrypt_cpf + hash), nunca em claro nas colunas, e o nascimento", async () => {
    const { db, chamadas } = bancoFalso();
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Ana", cpf: CPF_VALIDO, data_nascimento: "14/09/1990" }, "pessoas");
    expect(r).toMatchObject({ ok: true });
    expect(r.registrado).toEqual(expect.arrayContaining(["nome", "cpf", "data_nascimento"]));
    const cpf = chamadas.find((c) => c.sql.includes("encrypt_cpf"))!;
    expect(cpf.sql).toMatch(/cpf_encrypted\s*=\s*public\.encrypt_cpf/);
    expect(cpf.sql).toMatch(/cpf_hash\s*=/);
    expect(cpf.valores[3]).toMatch(/^[0-9a-f]{64}$/);
    const up = chamadas.find((c) => c.sql.includes("birthdate"))!;
    expect(up.valores[5]).toBe("1990-09-14");
    expect(chamadas.some((c) => c.sql.includes("companies") || c.sql.includes("company_people"))).toBe(false);
  });

  it("CPF inválido é recusado com aviso e não é gravado", async () => {
    const { db, chamadas } = bancoFalso();
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Ana", cpf: "111.111.111-11" }, "pessoas");
    expect(r.ok).toBe(true);
    expect(r.registrado).toEqual(["nome"]);
    expect(r.avisos.join(" ")).toMatch(/cpf_invalido/);
    expect(chamadas.some((c) => c.sql.includes("encrypt_cpf"))).toBe(false);
  });

  it("só CPF inválido: erro, nada gravado", async () => {
    const { db, chamadas } = bancoFalso();
    const r = await aplicarRegistroDoLead(db, IDS, { cpf: "123" }, "pessoas");
    expect(r.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("sem chave de cifra o resto do cadastro fica e o CPF não", async () => {
    const { db } = bancoFalso({ falhaNoCpf: true });
    const r = await aplicarRegistroDoLead(db, IDS, { nome: "Ana", cpf: CPF_VALIDO }, "pessoas");
    expect(r.ok).toBe(true);
    expect(r.registrado).toEqual(["nome"]);
    expect(r.avisos.join(" ")).toMatch(/cpf_nao_gravado/);
  });

  it("empresas (padrão) continua gravando empresa e CNPJ como antes", async () => {
    const chamadas: Chamada[] = [];
    const db = {
      async query(sql: string, valores: unknown[] = []) {
        chamadas.push({ sql, valores });
        const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (s.startsWith("select name, display_name"))
          return { rows: [{ name: null, display_name: null, phone_number: null, email: null, person_id: null }], rowCount: 1 };
        if (s.startsWith("insert into companies") || s.startsWith("insert into people")) return { rows: [{ id: "x" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    } as never;
    const r = await aplicarRegistroDoLead(db, IDS, { empresa: "Pedreira Central", cnpj: "08.970.609/0001-03" });
    expect(r.registrado).toEqual(expect.arrayContaining(["empresa", "cnpj"]));
  });
});

describe("data de nascimento", () => {
  it("aceita dd/mm/aaaa e aaaa-mm-dd; recusa inexistente, futura e antiga", () => {
    const hoje = new Date("2026-10-21T12:00:00Z");
    expect(dataDeNascimentoValida("14/09/1990", hoje)).toBe("1990-09-14");
    expect(dataDeNascimentoValida("1990-09-14", hoje)).toBe("1990-09-14");
    expect(dataDeNascimentoValida("31/02/1990", hoje)).toBeNull();
    expect(dataDeNascimentoValida("01/01/2030", hoje)).toBeNull();
    expect(dataDeNascimentoValida("01/01/1850", hoje)).toBeNull();
    expect(dataDeNascimentoValida("ontem", hoje)).toBeNull();
  });
});

describe("menu, rotas e recursos", () => {
  it("o recurso aparece em Recursos opcionais, ligado só em pessoas", () => {
    const r = RECURSOS_OPCIONAIS.find((x) => x.id === "clientes_sao_pessoas")!;
    expect(r.nivel).toBe("organizacao");
    const fontes = (settings: Record<string, unknown>) => ({ modulos: [], settings, servidor: {} }) as never;
    expect(r.ler!(fontes({ tipo_de_cliente: "pessoas" }))).toBe("ligado");
    expect(r.ler!(fontes({}))).toBe("desligado");
  });
});
