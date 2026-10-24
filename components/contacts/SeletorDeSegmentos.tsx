"use client";
import Link from "next/link";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSegmentos } from "@/hooks/contacts/useSegmentos";
import { useT } from "@/hooks/i18n/useT";
import { chaveDoSegmento } from "@/lib/personalizacoes/segmentos";

/** O Select do Radix não aceita `value=""` em item: estes dois valores só existem dentro da lista. */
const NENHUM = "__nenhum__";
const VARIOS = "__varios__";

/**
 * Fork #32: escolha do segmento entre os CADASTRADOS da empresa (CRM › Segmentos), numa lista
 * suspensa de ESCOLHA ÚNICA (com muitos segmentos, uma fila de botões vira um paredão). `value` e
 * `onChange` seguem sendo o texto "A, B" que os formulários guardam; a escolha grava um segmento só.
 * Nada some sozinho: segmento que o contato já tem e saiu da lista continua nela, e quem já tem
 * VÁRIOS (por exemplo, gravados pela IA) os vê juntos e só os troca ao escolher outro.
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
  const foraDaLista = marcados.filter((m) => !lista.some((l) => chaveDoSegmento(l) === chaveDoSegmento(m)));
  const opcoes = [...lista, ...foraDaLista];

  const atual = marcados.length > 1 ? VARIOS : (marcados[0] ?? "");

  function escolher(valor: string) {
    if (valor === VARIOS) return; // reabrir e fechar sem trocar não altera nada
    onChange(valor === NENHUM ? "" : valor);
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
    <Select value={atual} onValueChange={escolher} disabled={disabled}>
      <SelectTrigger id={id} aria-label={t("Segmento")}>
        <SelectValue placeholder={t("Selecione o segmento")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NENHUM}>{t("Nenhum")}</SelectItem>
        {marcados.length > 1 && <SelectItem value={VARIOS}>{marcados.join(", ")}</SelectItem>}
        {opcoes.map((nome) => (
          <SelectItem key={nome} value={nome}>
            {nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
