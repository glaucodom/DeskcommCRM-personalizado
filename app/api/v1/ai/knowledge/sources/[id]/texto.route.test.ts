import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ErroDeExtracao, extrairTextoDoArquivo } from "@/lib/ai/rag/ingest/documento";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Ver e editar o texto de um material (.md/.txt) pela rota do próprio material.
 *
 * O que cada caso protege: o arquivo ativo nunca é sobrescrito, a versão
 * anterior entra no histórico, uma falha antes da troca deixa o material como
 * estava (e apaga só o arquivo novo), e nenhum caminho lê ou grava fora da
 * organização da sessão.
 */

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ai/rag/ingest/documento", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/ai/rag/ingest/documento")>();
  return { ...real, extrairTextoDoArquivo: vi.fn(async () => ({ texto: "ok", extensao: "md" })) };
});

const ORG = "22222222-2222-4222-8222-222222222222";
const OUTRA_ORG = "33333333-3333-4333-8333-333333333333";
const USER = "11111111-1111-4111-8111-111111111111";
const ID = "44444444-4444-4444-8444-444444444444";
const BLOB = `${ORG}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.md`;

function material(meta: Record<string, unknown>, sourceType = "documento") {
  return {
    id: ID,
    name: "Política de troca",
    agent_id: null,
    organization_id: ORG,
    source_type: sourceType,
    status: "ready",
    source_metadata: meta,
  };
}

function autorizar() {
  const user: AuthUser = {
    id: USER,
    email: "a@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    idioma: "pt-BR" as const,
    organizations: [{ organization_id: ORG, organization_name: "Org", role: "manager" }],
  };
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user,
    org: { orgId: ORG, name: "Org", role: "manager" },
  });
}

/** Cliente da sessão: devolve a linha do material (já filtrada por organização). */
function clienteDaSessao(linha: unknown) {
  const eqs: Array<[string, unknown]> = [];
  const b = {
    from: () => b,
    select: () => b,
    eq: (c: string, v: unknown) => {
      eqs.push([c, v]);
      return b;
    },
    order: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: () => Promise.resolve({ data: linha, error: null }),
  };
  vi.mocked(createClient).mockResolvedValue(b as never);
  return eqs;
}

interface AdminOpts {
  download?: string | null;
  uploadErr?: unknown;
  linhasTrocadas?: number;
}

function admin(opts: AdminOpts = {}) {
  const chamadas = {
    download: [] as string[],
    upload: [] as Array<{ path: string; body: Buffer; contentType: string }>,
    remove: [] as string[][],
    update: [] as Record<string, unknown>[],
    filtros: [] as Array<[string, string, unknown]>,
    eqs: [] as Array<[string, unknown]>,
    rpc: [] as Array<[string, Record<string, unknown>]>,
  };
  const bucket = {
    download: vi.fn(async (path: string) => {
      chamadas.download.push(path);
      if (opts.download === null) return { data: null, error: { message: "not found" } };
      return { data: new Blob([opts.download ?? "# Troca\n\nAté 7 dias."]), error: null };
    }),
    upload: vi.fn(async (path: string, body: Buffer, o: { contentType: string }) => {
      chamadas.upload.push({ path, body, contentType: o.contentType });
      return { data: {}, error: opts.uploadErr ?? null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      chamadas.remove.push(paths);
      return { data: [], error: null };
    }),
  };
  const q = {
    update: (p: Record<string, unknown>) => {
      chamadas.update.push(p);
      return q;
    },
    eq: (c: string, v: unknown) => {
      chamadas.eqs.push([c, v]);
      return q;
    },
    filter: (c: string, op: string, v: unknown) => {
      chamadas.filtros.push([c, op, v]);
      return q;
    },
    select: () =>
      Promise.resolve({
        data: Array.from({ length: opts.linhasTrocadas ?? 1 }, () => ({ id: ID })),
        error: null,
      }),
  };
  vi.mocked(createAdminClient).mockReturnValue({
    storage: { from: () => bucket },
    from: () => q,
    rpc: (nome: string, args: Record<string, unknown>) => {
      chamadas.rpc.push([nome, args]);
      return Promise.resolve({ error: null });
    },
  } as never);
  return chamadas;
}

function get(conteudo = true) {
  return new NextRequest(
    `http://localhost/api/v1/ai/knowledge/sources/${ID}${conteudo ? "?conteudo=1" : ""}`,
  );
}

function patch(body: unknown) {
  return new NextRequest(`http://localhost/api/v1/ai/knowledge/sources/${ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  autorizar();
});

describe("GET ?conteudo=1 — Ver arquivo enviado", () => {
  it("devolve o texto do arquivo ativo, lido no caminho da organização", async () => {
    const eqs = clienteDaSessao(material({ blob_path: BLOB, ext: "md", filename: "troca.md" }));
    const ch = admin({ download: "# Troca\n\n<script>x</script>" });
    const { GET } = await import("./route");

    const res = await GET(get(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.conteudo).toMatchObject({
      texto: "# Troca\n\n<script>x</script>",
      filename: "troca.md",
      ext: "md",
      blob_path: BLOB,
      versao: 1,
    });
    expect(ch.download).toEqual([BLOB]);
    expect(eqs).toContainEqual(["organization_id", ORG]);
  });

  it("PDF não tem texto para ver por aqui", async () => {
    clienteDaSessao(material({ blob_path: `${ORG}/x.pdf`, ext: "pdf" }));
    const ch = admin();
    const { GET } = await import("./route");

    const res = await GET(get(), params);
    expect(res.status).toBe(422);
    expect(ch.download).toEqual([]);
  });

  it("arquivo fora da pasta da organização não é lido", async () => {
    clienteDaSessao(material({ blob_path: `${OUTRA_ORG}/x.md`, ext: "md" }));
    const ch = admin();
    const { GET } = await import("./route");

    const res = await GET(get(), params);
    expect(res.status).toBe(422);
    expect(ch.download).toEqual([]);
  });

  it("arquivo sumido do bucket vira erro claro, não 500", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    admin({ download: null });
    const { GET } = await import("./route");

    const res = await GET(get(), params);
    expect(res.status).toBe(404);
  });
});

describe("PATCH { texto } — Editar texto", () => {
  it("grava versão nova, guarda a anterior no histórico e só então troca o ponteiro", async () => {
    clienteDaSessao(
      material({ blob_path: BLOB, ext: "md", filename: "troca.md", size_bytes: 20, origem: "texto_colado" }),
    );
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "# Troca\n\nAté 30 dias.", blob_path_atual: BLOB }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.versao).toBe(2);

    expect(ch.upload).toHaveLength(1);
    const novo = ch.upload[0]!;
    expect(novo.path).toMatch(new RegExp(`^${ORG}/[0-9a-f-]{36}\\.md$`));
    expect(novo.path).not.toBe(BLOB);
    expect(novo.contentType).toBe("text/markdown");
    expect(novo.body.toString("utf8")).toBe("# Troca\n\nAté 30 dias.");
    expect(vi.mocked(extrairTextoDoArquivo)).toHaveBeenCalledWith(novo.path, "md");

    const meta = ch.update[0]!.source_metadata as Record<string, unknown>;
    expect(meta.blob_path).toBe(novo.path);
    expect(meta.ext).toBe("md");
    expect(meta.origem).toBe("texto_colado");
    expect(meta.versao).toBe(2);
    expect(meta.historico).toEqual([
      expect.objectContaining({ versao: 1, blob_path: BLOB, ext: "md", substituida_por: USER }),
    ]);
    // A troca só acontece se o material ainda aponta para o arquivo carregado.
    expect(ch.filtros).toContainEqual(["source_metadata->>blob_path", "eq", BLOB]);
    expect(ch.eqs).toContainEqual(["organization_id", ORG]);
    // O arquivo antigo nunca é apagado, e o material não é arquivado.
    expect(ch.remove).toEqual([]);
    expect(ch.update[0]).not.toHaveProperty("status");
    expect(ch.update[0]).not.toHaveProperty("is_active");
    expect(ch.rpc[0]?.[1]).toMatchObject({ p_event_type: "knowledge_source.updated" });
  });

  it("a terceira edição acumula as duas versões anteriores", async () => {
    const v1 = { versao: 1, blob_path: `${ORG}/v1.txt`, ext: "txt" };
    clienteDaSessao(material({ blob_path: `${ORG}/v2.txt`, ext: "txt", versao: 2, historico: [v1] }));
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "novo", blob_path_atual: `${ORG}/v2.txt` }), params);
    expect(res.status).toBe(200);
    expect(ch.upload[0]!.contentType).toBe("text/plain");
    const meta = ch.update[0]!.source_metadata as Record<string, unknown>;
    expect(meta.versao).toBe(3);
    expect(meta.historico).toEqual([
      v1,
      expect.objectContaining({ versao: 2, blob_path: `${ORG}/v2.txt` }),
    ]);
  });

  it("editor aberto numa versão que já mudou: 409, nada gravado", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: `${ORG}/outro.md` }), params);
    expect(res.status).toBe(409);
    expect(ch.upload).toEqual([]);
    expect(ch.update).toEqual([]);
  });

  it("nova versão ilegível: apaga só o arquivo novo e não troca o ponteiro", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin();
    vi.mocked(extrairTextoDoArquivo).mockRejectedValueOnce(
      new ErroDeExtracao("o arquivo não tem texto nenhum para indexar"),
    );
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: BLOB }), params);
    expect(res.status).toBe(422);
    expect(ch.update).toEqual([]);
    expect(ch.remove).toEqual([[ch.upload[0]!.path]]);
    expect(ch.remove.flat()).not.toContain(BLOB);
  });

  it("falha ao gravar o arquivo novo: nada muda", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin({ uploadErr: { message: "quota" } });
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: BLOB }), params);
    expect(res.status).toBe(500);
    expect(ch.update).toEqual([]);
  });

  it("outra pessoa trocou o arquivo durante o salvamento: 409 e o arquivo novo sai", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin({ linhasTrocadas: 0 });
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: BLOB }), params);
    expect(res.status).toBe(409);
    expect(ch.remove).toEqual([[ch.upload[0]!.path]]);
    expect(ch.rpc).toEqual([]);
  });

  it("PDF não ganha edição de texto", async () => {
    clienteDaSessao(material({ blob_path: `${ORG}/x.pdf`, ext: "pdf" }));
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: `${ORG}/x.pdf` }), params);
    expect(res.status).toBe(422);
    expect(ch.upload).toEqual([]);
  });

  it("texto vazio é recusado", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "   \n", blob_path_atual: BLOB }), params);
    expect(res.status).toBe(422);
    expect(ch.upload).toEqual([]);
  });

  it("texto junto com outros campos é recusado", async () => {
    clienteDaSessao(material({ blob_path: BLOB, ext: "md" }));
    const ch = admin();
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ texto: "x", blob_path_atual: BLOB, name: "Outro" }), params);
    expect(res.status).toBe(422);
    expect(ch.upload).toEqual([]);
  });
});
