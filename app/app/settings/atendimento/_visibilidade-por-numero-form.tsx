"use client";
/**
 * Botão da "visibilidade por número" (personalização do fork). Ver
 * lib/personalizacoes/visibilidade-por-numero.ts e supabase/personalizacoes.sql.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";

export function VisibilidadePorNumeroForm({ inicial }: { inicial: boolean }) {
  const t = useT();
  const router = useRouter();
  const [ligada, setLigada] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function trocar(proximo: boolean) {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/v1/settings/visibilidade-por-numero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligada: proximo }),
      });
      if (!response.ok) {
        setFeedback(t("Não foi possível salvar. Tente novamente."));
        return;
      }
      setLigada(proximo);
      setFeedback(t("Salvo"));
      router.refresh();
    } catch {
      setFeedback(t("Não foi possível salvar. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-lg border p-4" aria-labelledby="visibilidade-por-numero-title">
      <h2 id="visibilidade-por-numero-title" className="text-lg font-semibold">
        {t("Cada vendedor vê só o próprio número")}
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t(
          "Ligado, cada atendente vê todas as conversas dos números em que está marcado acima, com ou sem dono, e não vê as dos outros números. A lista de números do inbox também mostra só os dele. Gerentes e administradores continuam vendo tudo. Use junto com \"Todos veem tudo\".",
        )}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ligada}
          disabled={busy}
          onChange={(e) => void trocar(e.target.checked)}
          data-testid="visibilidade-por-numero"
        />
        {t("Cada vendedor vê só os números em que é responsável")}
      </label>
      {feedback && <p className="text-sm text-muted-foreground" role="status">{feedback}</p>}
    </section>
  );
}
