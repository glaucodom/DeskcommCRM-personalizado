import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/types";
import {
  arquivoEditavel,
  metadataDaNovaVersao,
  versaoAtual,
} from "@/lib/ai/rag/texto-editavel";

/**
 * Ver arquivo enviado e Editar texto, na Base de Conhecimento.
 *
 * Pela tela: abrir, copiar, fechar por botão e por Esc, cancelar sem gravar,
 * salvar com o arquivo que foi carregado, erro sem quebrar a tela, e a nova
 * tentativa de preparação aos 35 s (o indexador ignora pedidos repetidos do
 * mesmo material dentro de 30 s).
 */

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (chave: string) => chave }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conteudo = {
  texto: "# Troca\n\nAté 7 dias. <b>negrito</b>",
  nome: "Política de troca",
  filename: "troca.md",
  ext: "md" as const,
  blob_path: "org/v1.md",
  versao: 1,
};

const estadoDoHook = {
  data: conteudo as typeof conteudo | undefined,
  isLoading: false,
  isError: false,
};

const salvarTextoDoMaterial = vi.fn();
const lerMaterial = vi.fn();
const pedirReindexacao = vi.fn(async () => undefined);

vi.mock("@/hooks/ai/useTextoDoMaterial", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/ai/useTextoDoMaterial")>();
  return {
    ...real,
    useTextoDoMaterial: () => estadoDoHook,
    salvarTextoDoMaterial: (...a: unknown[]) => salvarTextoDoMaterial(...a),
    lerMaterial: (...a: unknown[]) => lerMaterial(...a),
    pedirReindexacao: (...a: unknown[]) => pedirReindexacao(...(a as [])),
  };
});

import { VerArquivoDialog } from "@/components/ai/VerArquivoDialog";
import { EditarTextoDialog } from "@/components/ai/EditarTextoDialog";
import { temTextoEditavel } from "@/hooks/ai/useTextoDoMaterial";

function comQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  estadoDoHook.data = conteudo;
  estadoDoHook.isLoading = false;
  estadoDoHook.isError = false;
  salvarTextoDoMaterial.mockReset();
  lerMaterial.mockReset();
  pedirReindexacao.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("quem tem texto para ver e editar", () => {
  const ORG = "org-1";

  it(".md e .txt de documento sim; PDF, CSV e FAQ não", () => {
    const doc = (ext: string) => ({ source_type: "documento", source_metadata: { ext, blob_path: `${ORG}/a.${ext}` } });
    expect(temTextoEditavel(doc("md"))).toBe(true);
    expect(temTextoEditavel(doc("txt"))).toBe(true);
    expect(temTextoEditavel(doc("pdf"))).toBe(false);
    expect(temTextoEditavel(doc("csv"))).toBe(false);
    expect(temTextoEditavel({ source_type: "faq", source_metadata: {} })).toBe(false);

    expect(arquivoEditavel(doc("md"), ORG)).toEqual({ blobPath: `${ORG}/a.md`, ext: "md", filename: null });
    expect(arquivoEditavel(doc("pdf"), ORG)).toBeNull();
  });

  it("o servidor só aceita arquivo dentro da pasta da organização", () => {
    const m = { source_type: "documento", source_metadata: { ext: "md", blob_path: "outra/a.md" } };
    expect(arquivoEditavel(m, ORG)).toBeNull();
    const fuga = { source_type: "documento", source_metadata: { ext: "md", blob_path: `${ORG}/../outra/a.md` } };
    expect(arquivoEditavel(fuga, ORG)).toBeNull();
  });

  it("a versão nova guarda a anterior e não mexe no resto do material", () => {
    const meta = { blob_path: "o/v1.md", ext: "md", filename: "t.md", origem: "texto_colado" };
    const nova = metadataDaNovaVersao(meta, { blobPath: "o/v2.md", sizeBytes: 3, mimeType: "text/markdown" }, "u", "2026-10-05T00:00:00Z");
    expect(versaoAtual(meta)).toBe(1);
    expect(nova).toMatchObject({ blob_path: "o/v2.md", ext: "md", origem: "texto_colado", versao: 2 });
    expect(nova.historico).toEqual([
      { versao: 1, blob_path: "o/v1.md", ext: "md", filename: "t.md", size_bytes: null, substituida_em: "2026-10-05T00:00:00Z", substituida_por: "u" },
    ]);
  });
});

describe("Ver arquivo enviado", () => {
  it("mostra o texto como texto (não como HTML), com o nome do arquivo", () => {
    comQuery(<VerArquivoDialog sourceId="s1" nome="Política de troca" aberto onFechar={() => {}} />);
    const area = screen.getByTestId("material-arquivo-conteudo");
    expect(area.textContent).toContain("<b>negrito</b>");
    expect(area.querySelector("b")).toBeNull();
    expect(screen.getByText(/troca\.md/)).toBeInTheDocument();
  });

  it("Copiar põe o texto inteiro na área de transferência", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    comQuery(<VerArquivoDialog sourceId="s1" nome="x" aberto onFechar={() => {}} />);
    fireEvent.click(screen.getByTestId("material-arquivo-copiar"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(conteudo.texto));
  });

  it("Fechar e Esc fecham", () => {
    const onFechar = vi.fn();
    comQuery(<VerArquivoDialog sourceId="s1" nome="x" aberto onFechar={onFechar} />);
    fireEvent.click(screen.getByTestId("material-arquivo-fechar"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(2);
  });

  it("erro de leitura aparece na tela sem quebrar", () => {
    estadoDoHook.data = undefined;
    estadoDoHook.isError = true;
    comQuery(<VerArquivoDialog sourceId="s1" nome="x" aberto onFechar={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não consegui ler o arquivo agora");
    expect(screen.getByTestId("material-arquivo-copiar")).toBeDisabled();
  });
});

describe("Editar texto", () => {
  function abrir(onFechar = vi.fn(), onSalvo = vi.fn()) {
    comQuery(
      <EditarTextoDialog sourceId="s1" nome="x" aberto onFechar={onFechar} onSalvo={onSalvo} />,
    );
    return { onFechar, onSalvo, editor: screen.getByTestId("material-texto-editor") };
  }

  it("carrega o texto atual; Salvar só liga depois de mudar", () => {
    const { editor } = abrir();
    expect(editor).toHaveValue(conteudo.texto);
    expect(screen.getByTestId("material-texto-salvar")).toBeDisabled();
    fireEvent.change(editor, { target: { value: "novo" } });
    expect(screen.getByTestId("material-texto-salvar")).toBeEnabled();
  });

  it("Cancelar fecha sem gravar nada", () => {
    const { editor, onFechar } = abrir();
    fireEvent.change(editor, { target: { value: "novo" } });
    fireEvent.click(screen.getByTestId("material-texto-cancelar"));
    expect(onFechar).toHaveBeenCalled();
    expect(salvarTextoDoMaterial).not.toHaveBeenCalled();
  });

  it("falha ao salvar mostra o motivo e mantém o texto para tentar de novo", async () => {
    salvarTextoDoMaterial.mockRejectedValueOnce(
      new ApiError(409, "conflict", undefined, "r", "Este material mudou desde que você abriu o editor."),
    );
    const { editor } = abrir();
    fireEvent.change(editor, { target: { value: "novo" } });
    fireEvent.click(screen.getByTestId("material-texto-salvar"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Este material mudou"),
    );
    expect(editor).toHaveValue("novo");
    expect(screen.getByTestId("material-texto-salvar")).toBeEnabled();
  });

  it("salva com o arquivo carregado, pede de novo aos 35 s e termina quando os trechos são do texto novo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const salvoEm = "2026-10-05T12:00:00.000Z";
    salvarTextoDoMaterial.mockResolvedValue({ id: "s1", versao: 2, blob_path: "org/v2.md", salvo_em: salvoEm });
    const aguardando = { last_index_status: "success", last_indexed_at: "2026-10-05T11:00:00.000Z", last_index_error: null };
    const pronto = { last_index_status: "success", last_indexed_at: "2026-10-05T12:00:40.000Z", last_index_error: null };
    lerMaterial.mockResolvedValue(aguardando);

    const { editor, onSalvo } = abrir();
    fireEvent.change(editor, { target: { value: "EDITADO_TESTE_BASE_CONHECIMENTO" } });
    fireEvent.click(screen.getByTestId("material-texto-salvar"));

    await waitFor(() =>
      expect(salvarTextoDoMaterial).toHaveBeenCalledWith("s1", "EDITADO_TESTE_BASE_CONHECIMENTO", "org/v1.md"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("material-texto-estado")).toHaveTextContent("Preparando"),
    );

    for (let i = 0; i < 12 && pedirReindexacao.mock.calls.length === 0; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
    }
    expect(pedirReindexacao).toHaveBeenCalledTimes(1);

    lerMaterial.mockResolvedValue(pronto);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId("material-texto-estado")).toHaveTextContent("Pronto"),
    );
    expect(onSalvo).toHaveBeenCalled();
    expect(pedirReindexacao).toHaveBeenCalledTimes(1);
  });

  it("preparação que falha mostra o motivo", async () => {
    salvarTextoDoMaterial.mockResolvedValue({ id: "s1", versao: 2, blob_path: "org/v2.md", salvo_em: "2026-10-05T12:00:00.000Z" });
    lerMaterial.mockResolvedValue({ last_index_status: "failed", last_indexed_at: null, last_index_error: "sem chave" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { editor } = abrir();
    fireEvent.change(editor, { target: { value: "novo" } });
    fireEvent.click(screen.getByTestId("material-texto-salvar"));
    await waitFor(() =>
      expect(screen.getByTestId("material-texto-estado")).toHaveTextContent("Preparando"),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sem chave"));
  });
});
