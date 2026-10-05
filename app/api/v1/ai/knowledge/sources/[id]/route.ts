import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET    /api/v1/ai/knowledge/sources/[id]              — o material (e os itens de FAQ)
 * GET    /api/v1/ai/knowledge/sources/[id]?conteudo=1   — o texto do arquivo ativo (.md/.txt)
 * PATCH  /api/v1/ai/knowledge/sources/[id]  — update knowledge source; com `texto`, grava
 *                                              uma versão nova do arquivo (.md/.txt)
 * DELETE /api/v1/ai/knowledge/sources/[id]  — soft-delete (status='archived')
 *
 * Auth: cookie session. Role >= manager required.
 * organization_id is ALWAYS resolved from the authenticated session — never from body/path.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aceitaTextoColado, canonizarTipoDeFonte } from "@/lib/ai/rag/tipos-de-fonte";
import {
  BUCKET_DE_CONHECIMENTO,
  ErroDeExtracao,
  extrairTextoDoArquivo,
} from "@/lib/ai/rag/ingest/documento";
import {
  TAMANHO_MAXIMO_DO_TEXTO,
  arquivoEditavel,
  metadataDaNovaVersao,
  versaoAtual,
} from "@/lib/ai/rag/texto-editavel";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Zod schema for PATCH
// ---------------------------------------------------------------------------

const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  locale: z.string().optional().default("pt-BR"),
});

const patchSourceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  items: z.array(faqItemSchema).optional(),
  source_metadata: z.record(z.string(), z.unknown()).optional(),
  /** Texto novo do arquivo (.md/.txt). Vira uma versão nova; a anterior fica no histórico. */
  texto: z.string().optional(),
  /**
   * O arquivo que o editor carregou. Se outro salvamento trocou o arquivo nesse
   * meio-tempo, a gravação é recusada em vez de apagar a edição do outro.
   */
  blob_path_atual: z.string().optional(),
});

const MIME_DO_TEXTO = { md: "text/markdown", txt: "text/plain" } as const;

// ---------------------------------------------------------------------------
// Shared: resolve auth + role gate
// ---------------------------------------------------------------------------

async function resolveContext(requestId: string) {
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return { error: authz.response };
  return { authUser: authz.user, activeOrg: authz.org };
}

// ---------------------------------------------------------------------------
// GET — o material e o conteúdo que dá para editar
// ---------------------------------------------------------------------------
//
// Existe para o diálogo de edição não ter de adivinhar o que já está lá. Sem
// ele, "Editar conteúdo" abriria um campo vazio e salvar apagaria a FAQ inteira
// — o pior desfecho possível para um botão chamado "editar".

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id: sourceId } = await params;

  const ctx = await resolveContext(requestId);
  if (ctx.error) return ctx.error;
  const { activeOrg } = ctx as Exclude<typeof ctx, { error: Response }>;

  const supabase = await createClient();
  const { data: fonte, error } = await supabase
    .from("ai_knowledge_sources")
    .select(
      "id, agent_id, organization_id, source_type, name, status, last_index_status, " +
        "last_index_error, last_indexed_at, chunks_count, is_active, source_metadata, " +
        "active_kb_version_id, created_at, updated_at",
    )
    .eq("id", sourceId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (error) {
    console.error("[ai-knowledge-sources] GET falhou:", error.message);
    return fail("internal_error", "Erro ao ler o material.", 500, { requestId });
  }
  if (!fonte) {
    return fail("not_found", "Material não encontrado.", 404, { requestId });
  }

  if (req.nextUrl.searchParams.get("conteudo") === "1") {
    return lerConteudo(fonte as unknown as LinhaDoMaterial, activeOrg.orgId, requestId);
  }

  const { data: itens } = await supabase
    .from("ai_faq_items")
    .select("question, answer, tags, locale, position")
    .eq("organization_id", activeOrg.orgId)
    .eq("knowledge_source_id", sourceId)
    .order("position", { ascending: true });

  return ok({ ...(fonte as unknown as Record<string, unknown>), items: itens ?? [] }, { requestId });
}

// ---------------------------------------------------------------------------
// O texto do arquivo ativo (Ver arquivo enviado / Editar texto)
// ---------------------------------------------------------------------------

interface LinhaDoMaterial {
  id: string;
  name: string;
  source_type: string;
  source_metadata: Record<string, unknown> | null;
}

/**
 * Devolve o arquivo como foi guardado, não o texto extraído: é o que a pessoa
 * enviou ou colou, e é o que ela vai editar. A tela mostra isso como texto puro.
 */
async function lerConteudo(
  fonte: LinhaDoMaterial,
  orgId: string,
  requestId: string,
): Promise<Response> {
  const arquivo = arquivoEditavel(fonte, orgId);
  if (!arquivo) {
    return fail(
      "unprocessable_entity",
      "Só dá para ver e editar o texto de materiais em Markdown (.md) ou texto (.txt).",
      422,
      { requestId },
    );
  }

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage
    .from(BUCKET_DE_CONHECIMENTO)
    .download(arquivo.blobPath);
  if (error || !blob) {
    console.error("[ai-knowledge-sources] leitura do arquivo falhou:", error?.message);
    return fail("not_found", "O arquivo deste material não está mais guardado.", 404, {
      requestId,
    });
  }

  const texto = Buffer.from(await blob.arrayBuffer()).toString("utf8");
  return ok(
    {
      conteudo: {
        texto,
        nome: fonte.name,
        filename: arquivo.filename,
        ext: arquivo.ext,
        blob_path: arquivo.blobPath,
        versao: versaoAtual(fonte.source_metadata),
      },
    },
    { requestId },
  );
}

/**
 * Grava o texto editado como uma versão nova.
 *
 * Ordem, e por quê: o arquivo novo sobe e é lido de volta ANTES de o material
 * apontar para ele. Qualquer falha até ali apaga só o arquivo novo, e o material
 * continua no arquivo antigo, que nunca é tocado. A troca do ponteiro é uma
 * única escrita condicionada ao arquivo que o editor carregou; se outra pessoa
 * salvou antes, nada muda e a resposta é 409.
 */
async function salvarTexto(
  fonte: LinhaDoMaterial & { agent_id: string | null },
  texto: string,
  blobPathAtual: string | undefined,
  orgId: string,
  userId: string,
  requestId: string,
): Promise<Response> {
  const arquivo = arquivoEditavel(fonte, orgId);
  if (!arquivo) {
    return fail(
      "unprocessable_entity",
      "Só dá para editar o texto de materiais em Markdown (.md) ou texto (.txt).",
      422,
      { requestId },
    );
  }
  if (!blobPathAtual) {
    return fail("validation_failed", "Falta o arquivo que o editor carregou.", 422, { requestId });
  }
  if (blobPathAtual !== arquivo.blobPath) {
    return fail(
      "conflict",
      "Este material mudou desde que você abriu o editor. Feche e abra de novo para ver a versão atual.",
      409,
      { requestId },
    );
  }
  if (texto.trim().length === 0) {
    return fail("validation_failed", "O texto não pode ficar vazio.", 422, { requestId });
  }
  const conteudo = Buffer.from(texto, "utf8");
  if (conteudo.byteLength > TAMANHO_MAXIMO_DO_TEXTO) {
    return fail("payload_too_large", "O texto passa de 20 MB.", 413, { requestId });
  }

  const admin = createAdminClient();
  const novoPath = `${orgId}/${randomUUID()}.${arquivo.ext}`;
  const mimeType = MIME_DO_TEXTO[arquivo.ext];

  const { error: uploadErr } = await admin.storage
    .from(BUCKET_DE_CONHECIMENTO)
    .upload(novoPath, conteudo, { contentType: mimeType, upsert: false });
  if (uploadErr) {
    console.error("[ai-knowledge-sources] gravação da nova versão falhou:", uploadErr.message);
    return fail("internal_error", "Não consegui guardar a nova versão. Nada foi alterado.", 500, {
      requestId,
    });
  }

  const desfazer = () => admin.storage.from(BUCKET_DE_CONHECIMENTO).remove([novoPath]);

  // Ler de volta prova que o arquivo existe E que o indexador vai conseguir lê-lo.
  try {
    await extrairTextoDoArquivo(novoPath, arquivo.ext);
  } catch (err) {
    await desfazer();
    if (err instanceof ErroDeExtracao) {
      if (err.detalhe) console.warn("[ai-knowledge-sources] nova versão ilegível:", err.detalhe);
      return fail("unprocessable_entity", err.message, 422, { requestId });
    }
    console.error("[ai-knowledge-sources] conferência da nova versão falhou:", err);
    return fail("internal_error", "Não consegui conferir a nova versão. Nada foi alterado.", 500, {
      requestId,
    });
  }

  const agora = new Date().toISOString();
  const novaMeta = metadataDaNovaVersao(
    fonte.source_metadata,
    { blobPath: novoPath, sizeBytes: conteudo.byteLength, mimeType },
    userId,
    agora,
  );

  const { data: trocadas, error: updateErr } = await admin
    .from("ai_knowledge_sources")
    .update({ source_metadata: novaMeta, last_index_error: null })
    .eq("id", fonte.id)
    .eq("organization_id", orgId)
    .filter("source_metadata->>blob_path", "eq", arquivo.blobPath)
    .select("id");

  if (updateErr || !trocadas || trocadas.length === 0) {
    await desfazer();
    if (updateErr) {
      console.error("[ai-knowledge-sources] troca do arquivo falhou:", updateErr.message);
      return fail("internal_error", "Não consegui salvar. O material continua como estava.", 500, {
        requestId,
      });
    }
    return fail(
      "conflict",
      "Este material mudou desde que você abriu o editor. Feche e abra de novo para ver a versão atual.",
      409,
      { requestId },
    );
  }

  const { error: emitErr } = await admin.rpc("emit_event" as never, {
    p_event_type: "knowledge_source.updated",
    p_entity_kind: "ai_knowledge_source",
    p_entity_id: fonte.id,
    p_payload: {
      knowledge_source_id: fonte.id,
      agent_id: fonte.agent_id,
      source_type: fonte.source_type,
      triggered_by: "texto_editado",
    },
    p_organization_id: orgId,
  } as never);
  if (emitErr) {
    console.warn("[ai-knowledge-sources] emit_event falhou (não bloqueia):", emitErr.message);
  }

  return ok(
    { id: fonte.id, versao: novaMeta.versao as number, blob_path: novoPath, salvo_em: agora },
    { requestId },
  );
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id: sourceId } = await params;

  const ctx = await resolveContext(requestId);
  if (ctx.error) return ctx.error;
  const { activeOrg, authUser } = ctx as Exclude<typeof ctx, { error: Response }>;

  // Parse + validate body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }

  const parsed = patchSourceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;

  const editaTexto = input.texto !== undefined;
  if (
    editaTexto &&
    (input.name !== undefined || input.items !== undefined || input.source_metadata !== undefined)
  ) {
    return fail("validation_failed", "Edite o texto sozinho, sem outros campos.", 422, {
      requestId,
    });
  }

  // Verify the source exists and belongs to the org (user-scoped client for RLS check).
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("ai_knowledge_sources")
    .select("id, name, source_type, agent_id, source_metadata")
    .eq("id", sourceId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[ai-knowledge-sources] PATCH fetch failed:", fetchErr.message);
    return fail("internal_error", "Erro ao verificar fonte.", 500, { requestId });
  }
  if (!existing) {
    return fail("not_found", "Fonte de conhecimento não encontrada.", 404, { requestId });
  }

  const ksRow = existing as unknown as LinhaDoMaterial & { agent_id: string | null };
  const tipo = canonizarTipoDeFonte(ksRow.source_type);

  if (editaTexto) {
    return salvarTexto(
      ksRow,
      input.texto as string,
      input.blob_path_atual,
      activeOrg.orgId,
      authUser.id,
      requestId,
    );
  }

  // Build update payload (only provided fields).
  const updatePayload: Record<string, unknown> = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.source_metadata !== undefined) updatePayload.source_metadata = input.source_metadata;

  const admin = createAdminClient();

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateErr } = await admin
      .from("ai_knowledge_sources")
      .update(updatePayload)
      .eq("id", sourceId)
      .eq("organization_id", activeOrg.orgId);

    if (updateErr) {
      console.error("[ai-knowledge-sources] PATCH update failed:", updateErr.message);
      return fail("internal_error", "Erro ao atualizar fonte.", 500, { requestId });
    }
  }

  // Replace FAQ items if provided.
  let itemsCount: number | undefined;
  // Itens mandados para um tipo que não os ingere eram DESCARTADOS em silêncio:
  // a pessoa editava o conteúdo, recebia 200, e nada mudava.
  if (input.items !== undefined && tipo !== null && !aceitaTextoColado(tipo)) {
    return fail(
      "unprocessable_entity",
      "Este material não é preenchido por texto colado — envie o arquivo ou aguarde a rotina que o alimenta.",
      422,
      { requestId },
    );
  }

  if (input.items !== undefined && tipo === "faq") {
    // Delete existing items.
    const { error: delErr } = await admin
      .from("ai_faq_items")
      .delete()
      .eq("knowledge_source_id", sourceId)
      .eq("organization_id", activeOrg.orgId);

    if (delErr) {
      console.error("[ai-knowledge-sources] PATCH delete items failed:", delErr.message);
      return fail("internal_error", "Erro ao remover itens antigos.", 500, { requestId });
    }

    if (input.items.length > 0) {
      const rows = input.items.map((item, idx) => ({
        organization_id: activeOrg.orgId,
        knowledge_source_id: sourceId,
        question: item.question,
        answer: item.answer,
        tags: item.tags,
        locale: item.locale,
        position: idx,
      }));

      const { error: insertErr } = await admin.from("ai_faq_items").insert(rows);

      if (insertErr) {
        console.error("[ai-knowledge-sources] PATCH insert items failed:", insertErr.message);
        return fail("internal_error", "Erro ao inserir novos itens FAQ.", 500, { requestId });
      }
      itemsCount = rows.length;
    } else {
      itemsCount = 0;
    }
  }

  // Emit knowledge_source.updated (fire-and-forget).
  const { error: emitErr } = await admin.rpc("emit_event" as never, {
    p_event_type: "knowledge_source.updated",
    p_entity_kind: "ai_knowledge_source",
    p_entity_id: sourceId,
    p_payload: {
      knowledge_source_id: sourceId,
      agent_id: ksRow.agent_id,
      source_type: ksRow.source_type,
    },
    p_organization_id: activeOrg.orgId,
  } as never);

  if (emitErr) {
    console.warn("[ai-knowledge-sources] emit_event failed (non-blocking):", emitErr.message);
  }

  return ok(
    { id: sourceId, ...(itemsCount !== undefined ? { items_count: itemsCount } : {}) },
    { requestId },
  );
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete (status='archived')
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id: sourceId } = await params;

  const ctx = await resolveContext(requestId);
  if (ctx.error) return ctx.error;
  const { activeOrg } = ctx as Exclude<typeof ctx, { error: Response }>;

  // Verify ownership with user-scoped client.
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("ai_knowledge_sources")
    .select("id")
    .eq("id", sourceId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[ai-knowledge-sources] DELETE fetch failed:", fetchErr.message);
    return fail("internal_error", "Erro ao verificar fonte.", 500, { requestId });
  }
  if (!existing) {
    return fail("not_found", "Fonte de conhecimento não encontrada.", 404, { requestId });
  }

  const admin = createAdminClient();
  // `is_active` JUNTO, e não só `status`.
  //
  // Nenhuma linha do repo jamais escreveu `is_active = false`. Enquanto existia
  // o índice único `(agent_id, source_type) WHERE is_active`, isso deixava o
  // "slot" ocupado por um material arquivado PARA SEMPRE: recriar devolvia 409 e
  // não havia caminho nenhum de volta. O índice saiu na 0181 e a incoerência
  // dos dois campos sairia junto — a constraint
  // `ai_knowledge_sources_arquivada_nao_e_ativa` agora recusa arquivar pela metade.
  const { error: archiveErr } = await admin
    .from("ai_knowledge_sources")
    .update({ status: "archived", is_active: false })
    .eq("id", sourceId)
    .eq("organization_id", activeOrg.orgId);

  if (archiveErr) {
    console.error("[ai-knowledge-sources] arquivar falhou:", archiveErr.message);
    return fail("internal_error", "Erro ao arquivar o material.", 500, { requestId });
  }

  return ok({ id: sourceId, status: "archived" }, { requestId });
}
