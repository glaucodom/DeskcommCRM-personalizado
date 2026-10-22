"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { invalidarCoresDasEtiquetas } from "@/components/tags/CoresDasEtiquetas";
import { cn } from "@/lib/utils";
import { PALETA_DE_ETIQUETAS, NOME_DO_TOM } from "@/lib/tags/cor-da-etiqueta";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

/** Fork #24: cadastra uma etiqueta no vocabulário da empresa antes de qualquer uso. */
export function NovaEtiqueta({ idioma }: { idioma: Idioma }) {
  const t = (texto: string) => traduzir(texto, idioma);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // A paleta só abre sob pedido: fechada, a tela fica enxuta e os controles de cor
  // da lista (um por etiqueta) não se repetem na mesma página.
  const [escolhendoCor, setEscolhendoCor] = useState(false);

  async function criar() {
    const tag = nome.trim();
    if (!tag) return;
    setOcupado(true);
    try {
      const resposta = await fetch("/api/v1/tags/vocabulario/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, cor }),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | { data?: { criou?: boolean }; error?: { code?: string } }
        | null;
      if (!resposta.ok) {
        toast.error(
          corpo?.error?.code === "forbidden"
            ? t("Só um gerente ou administrador da organização pode mudar as etiquetas.")
            : t("Não foi possível criar a etiqueta agora. Tente de novo."),
        );
        return;
      }
      if (corpo?.data?.criou === false) {
        toast.warning(t("Essa etiqueta já existe no vocabulário."));
        return;
      }
      toast.success(t("Etiqueta criada."));
      setNome("");
      setCor(null);
      setEscolhendoCor(false);
      invalidarCoresDasEtiquetas(queryClient);
      for (const chave of ["conversation-tag-vocabulary", "contact-tag-vocabulary"]) {
        void queryClient.invalidateQueries({ queryKey: [chave] });
      }
      router.refresh();
    } catch {
      toast.error(t("Não foi possível falar com o servidor. Recarregue a página e confira antes de tentar de novo."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-medium">{t("Nova etiqueta")}</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nova-etiqueta-nome">{t("Nome da etiqueta")}</Label>
        <Input
          id="nova-etiqueta-nome"
          value={nome}
          maxLength={60}
          onChange={(evento) => setNome(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              void criar();
            }
          }}
          placeholder={t("Ex.: cliente vip")}
        />
      </div>
      {escolhendoCor ? (
      <div className="flex flex-wrap items-center gap-2">
        {PALETA_DE_ETIQUETAS.map((tom) => (
          <button
            key={tom}
            type="button"
            onClick={() => setCor(tom)}
            aria-pressed={cor === tom}
            aria-label={t(NOME_DO_TOM[tom] ?? tom)}
            title={tom}
            className={cn(
              "size-7 rounded-full border-2 transition-transform",
              cor === tom
                ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "border-transparent hover:scale-110",
            )}
            style={{ backgroundColor: tom }}
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant={cor === null ? "default" : "outline"}
          aria-pressed={cor === null}
          onClick={() => setCor(null)}
        >
          {t("Sem cor")}
        </Button>
      </div>
      ) : (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEscolhendoCor(true)}>
            {t("Escolher cor")}
          </Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => void criar()} disabled={ocupado || nome.trim().length === 0}>
          {ocupado ? t("Criando...") : t("Criar etiqueta")}
        </Button>
        {nome.trim() && <ChipDeEtiqueta tag={nome.trim()} cor={cor} />}
      </div>
    </Card>
  );
}
