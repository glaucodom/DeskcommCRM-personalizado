"use client";

import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLead } from "@/hooks/kanban/useCreateLead";
import type { RespostaCriacaoDeLead } from "@/hooks/kanban/useCreateLead";
import type { Stage } from "@/lib/kanban/types";
import {
  AVISO_NEGOCIO_ABERTO_EXISTENTE,
  negocioAbertoNoQuadro,
  type NegocioAbertoExistente,
} from "@/lib/leads/negocio-aberto-duplicado";
import type { Lead } from "@/lib/types/leads";
import { createLeadSchema, type CreateLeadInput } from "@/lib/schemas/leads";
import { camposExigidosNoDestino, validaCamposExigidos } from "@/lib/leads/campos-exigidos";
import { MOEDA_PADRAO, parseReaisToCents, simboloDaMoeda } from "@/lib/money";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import type { Contact } from "@/lib/types/contacts";
import { EcoDoValor } from "./EcoDoValor";
import { apiClient } from "@/lib/api/client";
import { cnpjVazioOuValido, mascaraCnpj, segmentosDeTexto, SEGMENTOS_SUGERIDOS } from "@/lib/personalizacoes/dados-da-empresa";
import { formatCnpj } from "@/lib/crm-b2b/normalize";
import { SeletorDeContato } from "./SeletorDeContato";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { useTipoDeCliente } from "@/hooks/contacts/useTipoDeCliente";
import { cpfVazioOuValido, mascaraCpf } from "@/lib/personalizacoes/tipo-de-cliente";

interface FormShape {
  title: string;
  description: string;
  stage_id: string;
  valueReais: string;
  tagsRaw: string;
  expected_close_date: string;
  empresa: string;
  cnpj: string;
  segmentosRaw: string;
  cpf: string;
  birthdate: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  stages: Stage[];
  /** Vincula o lead criado a este contato de origem (ex.: painel do Inbox). */
  contactId?: string | null;
  /** Depois do INSERT — o inbox relê o resumo para o lead novo aparecer no formulário. */
  onCreated?: () => void;
  /**
   * Negócios do funil, para a pergunta de duplicidade ANTES de criar (#1751).
   *
   * É o quadro que a página de funil já tem em mãos — sem rede, sem atraso no
   * clique. Quem abre pelo Inbox recebe só o `contactId` e não tem esta lista:
   * ali a conferência prévia não acontece, e quem avisa é a `meta.avisos` da
   * resposta (o fallback aqui embaixo). Mesmo funil é filtrado DUAS vezes —
   * aqui e em `negocioAbertoNoQuadro` — porque a duplicidade é mesmo contato +
   * mesmo funil + aberto, e depender de quem chama é como a regra se perde.
   */
  leads?: Lead[];
  /**
   * Fork: com esta prop o diálogo NÃO pede valor; pede Empresa, CNPJ e Segmento (a CRTI
   * vende para empresa) e grava esses dados no contato. O objeto traz o que o contato já
   * tem, para vir preenchido. Sem a prop, o diálogo é o oficial.
   */
  dadosDaEmpresa?: { empresa?: string | null; cnpj?: string | null; segmentos?: string[] | null };
  /**
   * Fork #20 (B2C): campos personalizados do tipo Contato (funil padrão) e o que o
   * contato de origem já tem. Só valem para organização que vende para pessoas.
   */
  camposDoContato?: CustomFieldDef[];
  dadosDaPessoa?: { birthdate?: string | null; cpfCadastrado?: boolean; custom_fields?: Record<string, unknown> | null };
  /**
   * `crm_pipelines.settings` do funil — dele saem os campos que a ETAPA exige
   * (issue #3038). Quem já tem o funil em mãos passa adiante: o quadro da
   * página do funil (`data.pipeline.settings`) e o `useDefaultPipeline` do
   * painel do Inbox. Sem ele o bloco de campos exigidos não aparece — o funil
   * que não exige nada continua com o formulário byte a byte como era.
   */
  settings?: Record<string, unknown> | null;
}

function defaultStageId(stages: Stage[]): string {
  const open = stages.find((s) => !s.is_won && !s.is_lost && !s.is_archived);
  return open?.id ?? stages[0]?.id ?? "";
}

export function NewLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  contactId,
  leads,
  settings,
  onCreated,
  dadosDaEmpresa,
  camposDoContato = [],
  dadosDaPessoa,
}: Props) {
  const t = useT();
  const { pessoas } = useTipoDeCliente();
  const [camposDaPessoa, setCamposDaPessoa] = useState<Record<string, unknown>>({});
  const org = useActiveOrg();
  // Negócio NOVO nasce na moeda da organização (createLeadHandler).
  const moedaDoValor = org?.currency ?? MOEDA_PADRAO;
  const create = useCreateLead(pipelineId);
  const initialStage = useMemo(() => defaultStageId(stages), [stages]);
  // Quem abre o diálogo já sabendo o contato (Inbox) não escolhe de novo.
  const [contato, setContato] = useState<Contact | null>(null);
  /**
   * OS CAMPOS PERSONALIZADOS QUE A ETAPA EXIGE (issue #3038) — o valor que o
   * funil cobra para o negócio ENTRAR na etapa escolhida, digitado AQUI.
   *
   * Antes desta mudança o `createLeadHandler` recusava a criação direta na
   * etapa exigente (a régua da #1710) e o diálogo não tinha onde digitar o
   * campo: a pessoa lia "Preencha os campos obrigatórios antes de continuar:
   * Tipo de cliente" sem nenhum input de "Tipo de cliente" na tela, e o lead
   * não nascia. O valor começa vazio e é limpo junto com o diálogo — o mesmo
   * cuidado do contato, porque o funil mantém este componente montado.
   */
  const [camposDoNegocio, setCamposDoNegocio] = useState<Record<string, unknown>>({});
  // ─── O AVISO DE NEGÓCIO ABERTO DUPLICADO (issue #1751) ─────────────────────
  //
  // Guarda TAMBÉM os valores do formulário: quem chega aqui já preencheu tudo,
  // e confirmar tem de criar sem pedir para digitar de novo. `null` = não há
  // nada pendente. Declarado ANTES do bloco de reset abaixo, que o limpa —
  // use-before-declaration em render é ReferenceError, não linter.
  const [aviso, setAviso] = useState<{
    existente: NegocioAbertoExistente;
    valores: FormShape;
  } | null>(null);

  // O contato é o único campo deste diálogo que cria VÍNCULO, e o componente
  // NÃO desmonta ao fechar: o funil o mantém montado enquanto há dados
  // (`app/app/pipelines/[id]/_client.tsx`). Sem esquecê-lo, quem escolheu um
  // contato, desistiu e fechou reabre com ele ainda selecionado — e o próximo
  // negócio nasce ligado a quem o operador desistiu de usar, sem nada na tela
  // dizendo. A limpeza é feita no RENDER, comparando com o valor anterior, e
  // não em `onOpenChange`: o botão "Cancelar" chama o `onOpenChange` do PAI
  // direto, então um wrapper aqui não cobriria esse caminho. É o padrão que o
  // React documenta para ajustar estado quando uma prop muda — sem efeito, e
  // portanto sem o aviso de `react-hooks/set-state-in-effect`.
  const [estavaAberto, setEstavaAberto] = useState(open);
  if (open !== estavaAberto) {
    setEstavaAberto(open);
    // O aviso morre junto com o diálogo: reabrir para um contato novo não pode
    // reapresentar a pendência de quem desistiu no meio.
    if (!open) {
      setContato(null);
      setAviso(null);
      setCamposDoNegocio({});
    }
  }

  const form = useForm<FormShape>({
    defaultValues: {
      title: "",
      description: "",
      stage_id: initialStage,
      valueReais: "",
      tagsRaw: "",
      expected_close_date: "",
      empresa: "",
      cnpj: "",
      segmentosRaw: "",
      cpf: "",
      birthdate: "",
    },
  });

  // Fork: ao abrir, vem preenchido com o que o contato já tem.
  const empresaDoContato = dadosDaEmpresa?.empresa ?? "";
  const cnpjDoContato = dadosDaEmpresa?.cnpj ?? "";
  const segmentosDoContato = (dadosDaEmpresa?.segmentos ?? []).join(", ");
  useEffect(() => {
    if (!open || !dadosDaEmpresa) return;
    form.setValue("empresa", empresaDoContato);
    form.setValue("cnpj", cnpjDoContato ? formatCnpj(cnpjDoContato) : "");
    form.setValue("segmentosRaw", segmentosDoContato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresaDoContato, cnpjDoContato, segmentosDoContato]);

  // Fork #20 (B2C): o que o contato (de origem ou escolhido) já tem de CPF/nascimento/campos.
  const idDoContatoAtual = contactId ?? contato?.id ?? null;
  const pessoaAtual = contactId
    ? dadosDaPessoa
    : contato
      ? { birthdate: contato.birthdate, cpfCadastrado: Boolean(contato.cpf_hash), custom_fields: contato.custom_fields }
      : undefined;
  const nascimentoDoContato = pessoaAtual?.birthdate ?? "";
  const camposDoContatoJson = JSON.stringify(pessoaAtual?.custom_fields ?? {});
  useEffect(() => {
    if (!open || !pessoas) return;
    form.setValue("birthdate", nascimentoDoContato);
    form.setValue("cpf", "");
    setCamposDaPessoa(JSON.parse(camposDoContatoJson) as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pessoas, idDoContatoAtual, nascimentoDoContato, camposDoContatoJson]);

  // Reset stage_id default if stages change while dialog mounted.
  useEffect(() => {
    if (!form.getValues("stage_id") && initialStage) {
      form.setValue("stage_id", initialStage);
    }
  }, [initialStage, form]);

  const stageId = form.watch("stage_id");

  /**
   * OS CAMPOS QUE A ETAPA ESCOLHIDA EXIGE — a MESMA pergunta do servidor, feita
   * com a MESMA função (`camposExigidosNoDestino` é o recorte que
   * `validaCamposExigidos` percorre, não uma segunda régua escrita aqui).
   *
   * É recalculada quando a etapa muda no seletor: trocar para uma etapa que não
   * exige nada esvazia o bloco, e trocar para outra exigente o refaz com os
   * campos DELA. `desfecho: null` porque criar não fecha o negócio — os mesmos
   * argumentos do `createLeadHandler` para esta escrita.
   */
  const camposExigidos = useMemo(
    () => camposExigidosNoDestino(settings, { stageId, desfecho: null }),
    [settings, stageId],
  );

  /**
   * O QUE AINDA FALTA para esta criação — para o formulário não chamar a API
   * que já sabe que vai ser recusada (era a ida e volta que deixava o botão em
   * "Criando…") e para dizer o que falta AO LADO do campo, em vez de só num
   * toast sobre um campo que a tela não mostrava.
   */
  const faltandoNaEtapa = useMemo(
    () =>
      validaCamposExigidos({
        lead: { custom_fields: camposDoNegocio },
        settingsDoFunil: settings,
        destino: { stageId, desfecho: null },
        motivoDeGanho: null,
      }).faltando,
    [settings, stageId, camposDoNegocio],
  );

  /**
   * O submit normal. ANTES de qualquer chamada de rede vem a pergunta de
   * duplicidade (#1751) — se já houver um negócio aberto deste contato NESTE
   * funil, o diálogo para aqui com o link na mão e nada é criado. Quem decide
   * se o segundo nasce é a pessoa, não o banco: a 0256 proíbe o bloqueio.
   */
  async function onSubmit(values: FormShape) {
    const idDoContato = contactId ?? contato?.id ?? null;
    const existente = negocioAbertoNoQuadro(leads ?? [], {
      pipelineId,
      contactId: idDoContato,
    });
    if (existente) {
      setAviso({ existente, valores: values });
      return;
    }
    await gravar(values, false);
  }

  /** Quem confirmou o aviso: cria sem perguntar de novo (a pergunta já foi). */
  async function confirmarAviso() {
    if (!aviso) return;
    const { valores } = aviso;
    setAviso(null);
    await gravar(valores, true);
  }

  /**
   * A criação de fato. `avisoJaMostrado` é quem sabe se a pessoa JÁ viu a
   * duplicidade — é a única forma de não dizer a mesma coisa duas vezes.
   */
  async function gravar(values: FormShape, avisoJaMostrado: boolean) {
    // A régua da ETAPA (#1710) agora está visível no próprio formulário: se
    // ainda falta campo, a recusa sai daqui — sem ida e volta, e com a pessoa
    // no diálogo, o input na frente dela. O servidor segue perguntando a MESMA
    // coisa (defesa em profundidade, e é ele quem decide); o que muda é que o
    // caminho do operador não depende mais de um 422 para explicar o que a tela
    // não mostrava.
    if (faltandoNaEtapa.length > 0) return;

    const tags = values.tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (dadosDaEmpresa && !cnpjVazioOuValido(values.cnpj)) {
      form.setError("cnpj", { message: t("CNPJ deve ter 14 números") });
      return;
    }
    if (dadosDaEmpresa && !values.title.trim() && !values.empresa.trim()) {
      toast.error(t("Informe o título ou o nome da empresa"));
      return;
    }

    if (pessoas && idDoContatoAtual && !cpfVazioOuValido(values.cpf)) {
      form.setError("cpf", { message: t("CPF inválido") });
      return;
    }

    const reais = dadosDaEmpresa ? "" : values.valueReais.trim();
    let valueCents: number | null = null;
    if (reais.length > 0) {
      valueCents = parseReaisToCents(reais);
      if (valueCents === null) {
        form.setError("valueReais", { message: t("Valor inválido") });
        return;
      }
    }

    const payload: Record<string, unknown> = {
      pipeline_id: pipelineId,
      stage_id: values.stage_id,
      title: values.title.trim() || values.empresa.trim(),
      // A moeda NÃO vai daqui. O browser não sabe a moeda da organização, e
      // mandar "BRL" fazia toda instalação em peso ou dólar cadastrar lead em
      // real. Omitir é o conserto: quem decide é o servidor, que lê a
      // organização (`moedaDaOrganizacao`, em `createLeadHandler`).
      source: "manual",
      tags,
    };
    const idDoContato = contactId ?? contato?.id ?? null;
    if (idDoContato) payload.contact_id = idDoContato;
    if (values.description.trim()) payload.description = values.description.trim();
    if (valueCents !== null) payload.value_cents = valueCents;
    if (values.expected_close_date) payload.expected_close_date = values.expected_close_date;
    // Os campos que a etapa exige viajam NESTA criação (issue #3038): o
    // `createLeadSchema` os aceita e o `createLeadHandler` valida/grava o
    // mesmo objeto que a régua da etapa acabou de ler.
    if (Object.keys(camposDoNegocio).length > 0) payload.custom_fields = camposDoNegocio;

    // Fork: empresa, CNPJ e segmentos vão para o CONTATO (é onde o resto do sistema lê).
    if (dadosDaEmpresa && idDoContato) {
      try {
        await apiClient.patch(`/api/v1/contacts/${idDoContato}`, {
          empresa: values.empresa.trim(),
          cnpj: values.cnpj.trim(),
          segmentos: segmentosDeTexto(values.segmentosRaw),
        });
      } catch {
        toast.error(t("Não foi possível salvar os dados da empresa."));
        return;
      }
    }

    // Fork #20 (B2C): CPF, nascimento e campos do contato vão para o CONTATO.
    if (pessoas && idDoContato) {
      const patchDaPessoa: Record<string, unknown> = {};
      if (values.cpf.trim()) patchDaPessoa.cpf = values.cpf.trim();
      if (values.birthdate && values.birthdate !== nascimentoDoContato) patchDaPessoa.birthdate = values.birthdate;
      if (camposDoContato.length > 0 && JSON.stringify(camposDaPessoa) !== camposDoContatoJson) {
        patchDaPessoa.custom_fields = camposDaPessoa;
      }
      if (Object.keys(patchDaPessoa).length > 0) {
        try {
          await apiClient.patch(`/api/v1/contacts/${idDoContato}`, patchDaPessoa);
        } catch {
          toast.error(t("Não foi possível salvar os dados da pessoa."));
          return;
        }
      }
    }

    const parsed = createLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      const resposta = await create.mutateAsync(parsed.data as CreateLeadInput);
      // ─── O AVISO QUE CHEGA JUNTO COM A RESPOSTA (#1751) ────────────────────
      //
      // É o caminho em que NÃO dá para perguntar antes: o diálogo aberto pelo
      // Inbox recebe só o `contactId`, sem a lista de negócios do funil. A API
      // avisa sem recusar (a 0256 proíbe o bloqueio), e a tela traduz esse
      // `meta.avisos` no mesmo link do aviso prévio — nunca em silêncio.
      //
      // `avisoJaMostrado` evita a segunda chamada de quem já confirmou o aviso
      // no diálogo: a mesma duplicidade contada duas vezes ensina a ignorar.
      const meta = (resposta as RespostaCriacaoDeLead | null | undefined)?.meta;
      const avisos = meta?.avisos ?? [];
      if (!avisoJaMostrado && avisos.includes(AVISO_NEGOCIO_ABERTO_EXISTENTE)) {
        const existente = meta?.negocio_aberto_existente;
        toast.warning(t("Este contato já tem um negócio aberto neste funil."), {
          description: existente ? (
            <a
              href={`/app/pipelines/${pipelineId}?lead=${existente.id}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {existente.title}
            </a>
          ) : undefined,
        });
      }
      toast.success(t("Lead criado"));
      onCreated?.();
      form.reset({
        title: "",
        description: "",
        stage_id: initialStage,
        valueReais: "",
        tagsRaw: "",
        expected_close_date: "",
        empresa: "",
        cnpj: "",
        segmentosRaw: "",
        cpf: "",
        birthdate: "",
      });
      setCamposDaPessoa({});
      setContato(null);
      setAviso(null);
      setCamposDoNegocio({});
      onOpenChange(false);
    } catch {
      // toast already shown
    }
  }

  // Negócio sem pessoa não tem para quem o WhatsApp falar nem com quem a
  // automação casar. Dizer isso na hora vale mais que travar: quem abre o card
  // no meio da ligação e completa depois continua conseguindo, e a importação e
  // as automações seguem criando sem contato de propósito.
  const faltaContato = !contactId && !contato;

  function escolherContato(escolhido: Contact | null) {
    setContato(escolhido);
    if (dadosDaEmpresa && escolhido) {
      form.setValue("empresa", escolhido.empresa ?? "");
      form.setValue("cnpj", escolhido.cnpj ? formatCnpj(escolhido.cnpj) : "");
      form.setValue("segmentosRaw", (escolhido.segmentos ?? []).join(", "));
    }
    if (escolhido && !form.getValues("title").trim()) {
      form.setValue("title", rotuloDoContato(escolhido, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Novo Lead")}</DialogTitle>
          <DialogDescription>
            {t("Crie um lead manualmente neste pipeline.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!contactId && (
            <>
              <SeletorDeContato escolhido={contato} onEscolher={escolherContato} />
              {faltaContato && (
                <p className="text-xs text-muted-foreground">
                  {t("Sem contato, este lead não recebe WhatsApp nem entra nas automações.")}
                </p>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">{t("Título")}</Label>
            <Input
              id="title"
              placeholder={t("Ex: Pedido Maria — combo presente")}
              {...form.register("title", { required: !dadosDaEmpresa, minLength: 2 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("Descrição")}</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder={t("Contexto, observações, links…")}
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("Etapa")}</Label>
            <Select
              value={stageId}
              onValueChange={(v) => form.setValue("stage_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione a etapa")} />
              </SelectTrigger>
              <SelectContent>
                {stages
                  .filter((s) => !s.is_archived)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {dadosDaEmpresa ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="empresa">{t("Nome da empresa")}</Label>
                <Input id="empresa" {...form.register("empresa")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    {...form.register("cnpj", {
                      onChange: (e) => form.setValue("cnpj", mascaraCnpj(e.target.value)),
                    })}
                  />
                  {form.formState.errors.cnpj && (
                    <p className="text-xs text-error-fg">{form.formState.errors.cnpj.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="segmentosRaw">{t("Segmento")}</Label>
                  <Input
                    id="segmentosRaw"
                    list="nl-segmentos-sugeridos"
                    placeholder={t("Segmentos (separe por vírgula)")}
                    {...form.register("segmentosRaw")}
                  />
                  <datalist id="nl-segmentos-sugeridos">
                    {SEGMENTOS_SUGERIDOS.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_close_date">{t("Fechamento previsto")}</Label>
                <Input id="expected_close_date" type="date" {...form.register("expected_close_date")} />
              </div>
            </>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              {/* Negócio novo: o rótulo segue a moeda da organização, que é onde ele
                  vai nascer. `R$` em duro mentia para quem opera em euro. */}
              <Label htmlFor="valueReais">{t("Valor")} ({simboloDaMoeda(moedaDoValor)})</Label>
              <Input
                id="valueReais"
                inputMode="decimal"
                placeholder="0,00"
                {...form.register("valueReais")}
              />
              <EcoDoValor control={form.control} moeda={moedaDoValor} />
              {form.formState.errors.valueReais && (
                <p className="text-xs text-error-fg">
                  {form.formState.errors.valueReais.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_close_date">{t("Fechamento previsto")}</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...form.register("expected_close_date")}
              />
            </div>
          </div>
          )}

          {pessoas && (
            idDoContatoAtual ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-medium">{t("Dados da pessoa")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="nl-cpf">CPF</Label>
                    <Input
                      id="nl-cpf"
                      inputMode="numeric"
                      placeholder={pessoaAtual?.cpfCadastrado ? t("Já cadastrado. Digite só para trocar.") : "000.000.000-00"}
                      {...form.register("cpf", {
                        onChange: (e) => form.setValue("cpf", mascaraCpf(e.target.value)),
                      })}
                    />
                    {form.formState.errors.cpf && (
                      <p className="text-xs text-error-fg">{form.formState.errors.cpf.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nl-birthdate">{t("Data de nascimento")}</Label>
                    <Input id="nl-birthdate" type="date" {...form.register("birthdate")} />
                  </div>
                </div>
                {camposDoContato.length > 0 && (
                  <CustomFieldsEditor
                    fields={camposDoContato}
                    mode="contact"
                    value={camposDaPessoa}
                    onChange={setCamposDaPessoa}
                  />
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("Escolha ou crie o contato para informar CPF, data de nascimento e os campos personalizados.")}
              </p>
            )
          )}

          <div className="space-y-2">
            <Label htmlFor="tagsRaw">{t("Tags (separadas por vírgula)")}</Label>
            <Input
              id="tagsRaw"
              placeholder="vip, recompra"
              {...form.register("tagsRaw")}
            />
          </div>

          {/* OS CAMPOS QUE A ETAPA EXIGE (issue #3038) — pelo renderizador ÚNICO
              dos campos personalizados (`CustomFieldsEditor`, o mesmo do dossiê
              e do painel do inbox): o input certo por tipo, o campo condicional
              (#2728) e o padrão do campo (#2730) vêm de graça, e nada aqui é um
              formulário paralelo que divergiria no mês seguinte. O bloco só
              existe quando a etapa ESCOLHIDA exige algo: funil sem
              `obrigatorio_em` fica byte a byte como era. A frase do que falta é
              a MESMA do servidor (`recusaDeCamposObrigatorios`), agora ao lado
              do campo — o aviso antigo aparecia sem nada para preencher. */}
          {camposExigidos.length > 0 && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">
                {t("A etapa escolhida exige alguns dados. Preencha para continuar.")}
              </p>
              <CustomFieldsEditor
                fields={camposExigidos}
                value={camposDoNegocio}
                onChange={setCamposDoNegocio}
                mode="lead"
              />
              {faltandoNaEtapa.length > 0 && (
                <p role="alert" className="text-xs text-error-fg">
                  {t("Preencha os campos obrigatórios antes de continuar: {campos}.").replace(
                    "{campos}",
                    faltandoNaEtapa.map((campo) => campo.rotulo).join(", "),
                  )}
                </p>
              )}
            </div>
          )}

          {/* O AVISO SEM BLOQUEIO (#1751): aparece quando já existe negócio
              aberto deste contato NESTE funil. Ele não recusa nada — só para o
              clique e pergunta, com o link para quem já está no quadro. Recusar
              ("Não criar") fecha a pendência sem TOCAR na rede: nada é criado. */}
          {aviso && (
            <div
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950"
            >
              <p className="font-medium">
                {t("Este contato já tem um negócio aberto neste funil.")}
              </p>
              <p className="mt-1">{t("Abrir mesmo assim?")}</p>
              {/* O link é o próprio título do negócio — dado do banco, não
                  texto de interface: traduzir seria mentir sobre o que a pessoa
                  vai abrir. */}
              <a
                href={`/app/pipelines/${pipelineId}?lead=${aviso.existente.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block underline"
              >
                {aviso.existente.title}
              </a>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAviso(null)}>
                  {t("Não criar")}
                </Button>
                <Button type="button" onClick={() => void confirmarAviso()}>
                  {t("Criar mesmo assim")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={create.isPending || !stageId}>
              {create.isPending ? t("Criando…") : t("Criar lead")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
