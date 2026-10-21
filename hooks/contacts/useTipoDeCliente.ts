"use client";
import { useEffect, useState } from "react";
import type { TipoDeCliente } from "@/lib/personalizacoes/tipo-de-cliente";

/**
 * Tipo de cliente da organização (fork #20), lido uma vez e compartilhado por todas as
 * telas de contato. Não usa react-query de propósito: a lista do inbox renderiza este hook
 * por conversa e várias telas/testes não têm `QueryClientProvider`.
 *
 * Enquanto carrega, ou se a leitura falhar, vale "empresas": o comportamento de sempre nunca
 * some por causa de um erro de rede.
 */
let atual: TipoDeCliente | null = null;
let emVoo: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const o of ouvintes) o();
}

async function carregar(): Promise<void> {
  try {
    const r = await fetch("/api/v1/settings/tipo-de-cliente", { credentials: "same-origin" });
    if (!r.ok) return;
    const json = (await r.json()) as { data?: { tipo?: unknown } };
    atual = json.data?.tipo === "pessoas" ? "pessoas" : "empresas";
    avisar();
  } catch {
    // sem rede ou sem sessão: segue "empresas"
  }
}

/** Depois de trocar o tipo nas Configurações: descarta o valor e lê de novo. */
export function recarregarTipoDeCliente(): void {
  atual = null;
  emVoo = carregar().finally(() => {
    emVoo = null;
  });
}

export function useTipoDeCliente(): { tipo: TipoDeCliente; pessoas: boolean } {
  const [, forcar] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcar((n) => n + 1);
    ouvintes.add(ouvinte);
    if (atual === null && emVoo === null && typeof fetch === "function") {
      emVoo = carregar().finally(() => {
        emVoo = null;
      });
    }
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);
  const tipo: TipoDeCliente = atual ?? "empresas";
  return { tipo, pessoas: tipo === "pessoas" };
}
