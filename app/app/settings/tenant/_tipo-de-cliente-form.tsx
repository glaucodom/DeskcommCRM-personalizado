"use client";
/**
 * Seletor "Tipo de cliente" (personalização do fork #20). Ver lib/personalizacoes/tipo-de-cliente.ts.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";
import { recarregarTipoDeCliente } from "@/hooks/contacts/useTipoDeCliente";
import { updateModuloDaInstalacao } from "@/app/actions/settings/updateModuloDaInstalacao";
import type { TipoDeCliente } from "@/lib/personalizacoes/tipo-de-cliente";

/**
 * O módulo "Empresas, Pessoas e Segmentos" (`crm_b2b`) é da INSTALAÇÃO e vem desligado.
 * `podeLigar` = administrador da plataforma (é quem o action `updateModuloDaInstalacao` aceita).
 */
export interface EstadoDoModuloB2b {
  ligado: boolean;
  podeLigar: boolean;
}

export function TipoDeClienteForm({
  inicial,
  podeEditar,
  modulo,
}: {
  inicial: TipoDeCliente;
  podeEditar: boolean;
  modulo?: EstadoDoModuloB2b;
}) {
  const t = useT();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeCliente>(inicial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ligando, setLigando] = useState(false);
  const [erroDoModulo, setErroDoModulo] = useState("");

  async function ligarModulo() {
    setLigando(true);
    setErroDoModulo("");
    try {
      const r = await updateModuloDaInstalacao({ modulo: "crm_b2b", ligado: true });
      if (!r.ok) {
        setErroDoModulo(t("Não foi possível ligar agora. Confira a sua permissão de administrador da plataforma."));
        return;
      }
      router.refresh();
    } catch {
      setErroDoModulo(t("Não foi possível ligar agora. Confira a sua permissão de administrador da plataforma."));
    } finally {
      setLigando(false);
    }
  }

  async function trocar(proximo: TipoDeCliente) {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/v1/settings/tipo-de-cliente", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: proximo }),
      });
      if (!response.ok) {
        setFeedback(t("Não foi possível salvar. Tente novamente."));
        return;
      }
      setTipo(proximo);
      setFeedback(t("Salvo"));
      recarregarTipoDeCliente();
      router.refresh();
    } catch {
      setFeedback(t("Não foi possível salvar. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-lg border p-4" aria-labelledby="tipo-de-cliente-title">
      <h2 id="tipo-de-cliente-title" className="text-lg font-semibold">
        {t("Tipo de cliente")}
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t(
          "Empresas (B2B): o cadastro do contato tem Empresa, CNPJ, Segmentos e como conheceu. Pessoas (B2C): o cadastro tem só CPF e data de nascimento, e o menu de Empresas some. Nada é apagado ao trocar; os dados só ficam escondidos.",
        )}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <span>{t("Meus clientes são")}</span>
        <select
          value={tipo}
          disabled={busy || !podeEditar}
          onChange={(e) => void trocar(e.target.value as TipoDeCliente)}
          data-testid="tipo-de-cliente"
          className="rounded-md border bg-background px-2 py-1"
        >
          <option value="empresas">{t("Empresas (B2B)")}</option>
          <option value="pessoas">{t("Pessoas (B2C)")}</option>
        </select>
      </label>
      {!podeEditar && (
        <p className="text-sm text-muted-foreground">{t("Só o administrador pode trocar.")}</p>
      )}
      {feedback && <p className="text-sm text-muted-foreground" role="status">{feedback}</p>}
      {modulo && tipo === "empresas" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3" data-testid="modulo-b2b">
          {modulo.ligado ? (
            <p className="text-sm">{t("Empresas, Pessoas e Segmentos estão ligados nesta instalação.")}</p>
          ) : (
            <>
              <p className="text-sm">
                {t(
                  "Empresas, Pessoas e Segmentos estão desligados nesta instalação. Enquanto estiverem, essas telas não abrem.",
                )}
              </p>
              {modulo.podeLigar ? (
                <button
                  type="button"
                  disabled={ligando}
                  onClick={() => void ligarModulo()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {t("Ligar agora")}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("Peça a quem administra o servidor para ligar.")}
                </p>
              )}
            </>
          )}
          {erroDoModulo && (
            <p className="text-sm text-destructive" role="alert">
              {erroDoModulo}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
