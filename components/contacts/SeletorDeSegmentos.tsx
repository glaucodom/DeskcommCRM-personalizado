"use client";
import Link from "next/link";

import { useSegmentos } from "@/hooks/contacts/useSegmentos";
import { useT } from "@/hooks/i18n/useT";
import { chaveDoSegmento } from "@/lib/personalizacoes/segmentos";
import { cn } from "@/lib/utils";

/**
 * Fork #32: escolha de segmentos entre os CADASTRADOS da empresa (CRM › Segmentos). `value` e
 * `onChange` usam o texto "A, B" que os formulários já guardam. Segmento que o contato já tem e
 * não está mais na lista continua aparecendo (marcado) até alguém desmarcá-lo: nada some sozinho.
 */
export function SeletorDeSegmentos({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const t = useT();
  const { data, isLoading } = useSegmentos();
  const lista = (data?.data ?? []).map((s) => s.nome);
  const marcados = value.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const chavesMarcadas = new Set(marcados.map(chaveDoSegmento));
  const foraDaLista = marcados.filter((m) => !lista.some((l) => chaveDoSegmento(l) === chaveDoSegmento(m)));
  const opcoes = [...lista, ...foraDaLista];

  function alternar(nome: string) {
    const chave = chaveDoSegmento(nome);
    const novos = chavesMarcadas.has(chave)
      ? marcados.filter((m) => chaveDoSegmento(m) !== chave)
      : [...marcados, nome];
    onChange(novos.join(", "));
  }

  if (isLoading) return <p className="text-xs text-muted-foreground" id={id} role="group" aria-label={t("Segmentos")}>{t("Carregando segmentos…")}</p>;
  if (opcoes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" id={id} role="group" aria-label={t("Segmentos")}>
        {t("Nenhum segmento cadastrado.")}{" "}
        <Link href="/app/segmentos" className="underline">{t("Cadastrar em CRM › Segmentos")}</Link>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" id={id} role="group" aria-label={t("Segmentos")}>
      {opcoes.map((nome) => {
        const ativo = chavesMarcadas.has(chaveDoSegmento(nome));
        return (
          <button
            key={nome}
            type="button"
            disabled={disabled}
            aria-pressed={ativo}
            onClick={() => alternar(nome)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs transition-colors",
              ativo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              disabled && "opacity-60",
            )}
          >
            {nome}
          </button>
        );
      })}
    </div>
  );
}
