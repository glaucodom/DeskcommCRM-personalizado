"use client";

import { useT } from "@/hooks/i18n/useT";
/**
 * EDITAR O TEXTO DE UM MATERIAL (.md / .txt) SEM APAGAR E ENVIAR DE NOVO.
 *
 * Salvar grava uma versão NOVA do arquivo; a anterior continua guardada e fica
 * no histórico do material. Cancelar, Esc e clique fora fecham sem gravar nada.
 *
 * Depois de salvar, a tela acompanha a preparação até os trechos refletirem o
 * texto novo. O indexador ignora um segundo pedido para o mesmo material dentro
 * de 30 s (debounce): se a preparação não começou em 35 s, a tela pede de novo,
 * uma vez. O material nunca é arquivado nesse caminho.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sourcesQueryKey } from "@/hooks/ai/useKnowledgeSources";
import {
  estadoDaPreparacao,
  lerMaterial,
  pedirReindexacao,
  salvarTextoDoMaterial,
  useTextoDoMaterial,
  type TextoSalvo,
} from "@/hooks/ai/useTextoDoMaterial";
import { ApiError } from "@/lib/api/types";

const INTERVALO_DE_CONFERENCIA_MS = 3_000;
const NOVO_PEDIDO_APOS_MS = 35_000;
const DESISTE_DE_ACOMPANHAR_APOS_MS = 5 * 60_000;

type Fase = "editando" | "salvando" | "preparando" | "pronto" | "demorando" | "falhou";

interface Props {
  sourceId: string;
  nome: string;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

export function EditarTextoDialog({ sourceId, nome, aberto, onFechar, onSalvo }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useTextoDoMaterial(sourceId, aberto);
  const [texto, setTexto] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("editando");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<TextoSalvo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Em ref: o acompanhamento não pode recomeçar (e zerar o relógio dos 35 s)
  // porque o cartão passou uma função nova num render.
  const onSalvoRef = useRef(onSalvo);
  const tRef = useRef(t);
  useEffect(() => {
    onSalvoRef.current = onSalvo;
    tRef.current = t;
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Acompanha a preparação do texto salvo.
  useEffect(() => {
    if (!salvo || fase !== "preparando") return;
    const inicio = Date.now();
    let pediuDeNovo = false;
    let ativo = true;

    async function conferir() {
      if (!ativo || !salvo) return;
      try {
        const material = await lerMaterial(sourceId);
        const estado = estadoDaPreparacao(material, salvo.salvo_em);
        if (estado === "pronto") {
          setFase("pronto");
          qc.invalidateQueries({ queryKey: sourcesQueryKey() });
          onSalvoRef.current();
          return;
        }
        if (estado === "falhou") {
          setErro(material.last_index_error ?? tRef.current("A preparação do material falhou."));
          setFase("falhou");
          qc.invalidateQueries({ queryKey: sourcesQueryKey() });
          return;
        }
      } catch {
        // Uma leitura que falhou não decide nada: tenta na próxima volta.
      }
      const passou = Date.now() - inicio;
      if (!pediuDeNovo && passou >= NOVO_PEDIDO_APOS_MS) {
        pediuDeNovo = true;
        await pedirReindexacao(sourceId).catch(() => undefined);
      }
      if (passou >= DESISTE_DE_ACOMPANHAR_APOS_MS) {
        setFase("demorando");
        qc.invalidateQueries({ queryKey: sourcesQueryKey() });
        onSalvoRef.current();
        return;
      }
      timer.current = setTimeout(conferir, INTERVALO_DE_CONFERENCIA_MS);
    }

    timer.current = setTimeout(conferir, INTERVALO_DE_CONFERENCIA_MS);
    return () => {
      ativo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [salvo, fase, sourceId, qc]);

  // Enquanto a pessoa não digita, o editor mostra o arquivo carregado.
  const valor = texto ?? data?.texto ?? null;
  const mudou = data !== undefined && valor !== null && valor !== data.texto;
  const podeSalvar = fase === "editando" && mudou && (valor ?? "").trim().length > 0;

  async function salvar() {
    if (!data || valor === null || !podeSalvar) return;
    setErro(null);
    setFase("salvando");
    try {
      const resultado = await salvarTextoDoMaterial(sourceId, valor, data.blob_path);
      setSalvo(resultado);
      setFase("preparando");
      toast.success(t("Versão salva. Preparando o material com o texto novo…"));
    } catch (err) {
      setErro(
        err instanceof ApiError && err.message
          ? err.message
          : t("Não consegui salvar. O material continua como estava."),
      );
      setFase("editando");
    }
  }

  const ocupado = fase === "salvando";

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !ocupado && onFechar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t("Editar texto de")} “{nome}”
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.filename ? `${data.filename} · ` : ""}${t("versão")} ${data.versao}. ${t(
                  "Salvar cria uma versão nova; a anterior fica guardada.",
                )}`
              : t("Salvar cria uma versão nova; a anterior fica guardada.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {isLoading ? <p className="text-sm text-text-muted">{t("Carregando…")}</p> : null}
          {isError ? (
            <p className="text-sm text-error-fg" role="alert">
              {t("Não consegui ler o arquivo agora. Feche e tente de novo em instantes.")}
            </p>
          ) : null}
          {data && valor !== null ? (
            <Textarea
              value={valor}
              onChange={(e) => setTexto(e.target.value)}
              disabled={fase !== "editando"}
              className="h-[55vh] resize-y font-mono text-sm"
              aria-label={t("Texto do material")}
              data-testid="material-texto-editor"
            />
          ) : null}
        </div>

        <div className="text-sm" aria-live="polite" data-testid="material-texto-estado">
          {fase === "salvando" ? <p className="text-text-muted">{t("Salvando…")}</p> : null}
          {fase === "preparando" ? (
            <p className="text-text-muted">
              {t("Salvo. Preparando o material para o agente usar o texto novo…")}
            </p>
          ) : null}
          {fase === "pronto" ? (
            <p className="text-success-fg">
              {t("Pronto: o agente já usa o texto novo.")} ({t("versão")} {salvo?.versao})
            </p>
          ) : null}
          {fase === "demorando" ? (
            <p className="text-warning-fg">
              {t("Salvo. A preparação está demorando; ela continua sozinha e o cartão mostra quando terminar.")}
            </p>
          ) : null}
          {erro ? (
            <p className="text-error-fg" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {fase === "editando" || fase === "salvando" ? (
            <>
              <Button
                variant="ghost"
                onClick={onFechar}
                disabled={ocupado}
                data-testid="material-texto-cancelar"
              >
                {t("Cancelar")}
              </Button>
              <Button onClick={salvar} disabled={!podeSalvar} data-testid="material-texto-salvar">
                {ocupado ? t("Salvando…") : t("Salvar")}
              </Button>
            </>
          ) : (
            <Button onClick={onFechar} data-testid="material-texto-fechar">
              {t("Fechar")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
