"use client";

import { useT } from "@/hooks/i18n/useT";
import { MELHORIAS_DO_FORK } from "@/lib/personalizacoes/melhorias-do-fork";

/**
 * O que este fork tem a mais que o projeto original. Os endereços vêm do servidor
 * (variáveis do .env da instalação) para não ficarem fixos no código que embarca.
 */
export function MelhoriasDoFork({
  linkEvolucao,
  linkHistorico,
}: {
  linkEvolucao?: string;
  linkHistorico?: string;
}) {
  const t = useT();
  const classe = "text-primary underline underline-offset-2";
  return (
    <section className="mx-auto mt-8 max-w-3xl px-4 pb-10" aria-labelledby="melhorias-do-fork">
      <h2 id="melhorias-do-fork" className="text-base font-semibold">
        {t("Melhorias deste sistema (não vêm do projeto original)")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Tudo abaixo foi feito por nós em cima do projeto original. Ao atualizar para uma versão nova dele, cada item é conferido para ver se continua valendo.")}
      </p>
      {linkEvolucao || linkHistorico ? (
        <p className="mt-2 text-sm">
          {linkEvolucao ? (
            <a href={linkEvolucao} target="_blank" rel="noopener noreferrer" className={classe}>
              {t("Evolução do projeto original (changelog oficial) ↗")}
            </a>
          ) : null}
          {linkEvolucao && linkHistorico ? " · " : null}
          {linkHistorico ? (
            <a href={linkHistorico} target="_blank" rel="noopener noreferrer" className={classe}>
              {t("Histórico por versão do nosso sistema ↗")}
            </a>
          ) : null}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">
        {MELHORIAS_DO_FORK.map((m) => (
          <li key={m.n} className="flex gap-3 rounded-md border px-3 py-2">
            <span className="w-6 shrink-0 text-muted-foreground">#{m.n}</span>
            <span className="flex-1">{m.titulo}</span>
            {m.desde ? <span className="shrink-0 text-xs text-muted-foreground">{m.desde}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
