"use client";
import { useEffect, useState } from "react";

export interface SegmentoCadastrado {
  nome: string;
  usos: number;
}

/**
 * Segmentos cadastrados da empresa (fork #32), lidos uma vez e compartilhados por todas as telas.
 * Sem react-query de propósito (mesma razão de `useTipoDeCliente`): os diálogos de contato são
 * renderizados em telas e testes sem `QueryClientProvider`. Vazio se a empresa ainda não cadastrou
 * nenhum, ou se a leitura falhar (a tela segue como estava, sem inventar lista).
 */
interface Estado {
  data: { data: SegmentoCadastrado[] } | undefined;
  isLoading: boolean;
  isError: boolean;
}

let atual: Estado = { data: undefined, isLoading: true, isError: false };
let emVoo: Promise<void> | null = null;
let lidoEm = 0;
const ouvintes = new Set<() => void>();
const VALIDADE_MS = 60_000;

function definir(novo: Estado): void {
  atual = novo;
  for (const o of ouvintes) o();
}

async function carregar(): Promise<void> {
  try {
    const r = await fetch("/api/v1/segmentos", { credentials: "same-origin" });
    if (!r.ok) {
      definir({ data: { data: [] }, isLoading: false, isError: r.status !== 404 });
      return;
    }
    const json = (await r.json()) as { data?: SegmentoCadastrado[] };
    lidoEm = Date.now();
    definir({ data: { data: Array.isArray(json.data) ? json.data : [] }, isLoading: false, isError: false });
  } catch {
    definir({ data: { data: [] }, isLoading: false, isError: true });
  }
}

/** Depois de cadastrar, renomear ou tirar da lista: descarta o que está guardado e lê de novo. */
export function recarregarSegmentos(): void {
  lidoEm = 0;
  emVoo = carregar().finally(() => {
    emVoo = null;
  });
}

export function useSegmentos(): Estado {
  const [, forcar] = useState(0);
  useEffect(() => {
    const o = () => forcar((n) => n + 1);
    ouvintes.add(o);
    if (!emVoo && Date.now() - lidoEm > VALIDADE_MS) {
      emVoo = carregar().finally(() => {
        emVoo = null;
      });
    }
    return () => {
      ouvintes.delete(o);
    };
  }, []);
  return atual;
}
