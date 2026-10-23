/**
 * Fork #30 — "Importar histórico para o CRM".
 *
 * Lê do servidor do canal as conversas individuais que ele guardou do número (o
 * acervo ligado em "Guardar o histórico") e grava no CRM como contato, conversa e
 * mensagens. É SÓ HISTÓRICO: a gravação passa por `fn_importar_historico_lote`
 * (supabase/personalizacoes.sql), que não aciona IA, automação, rodízio, lead nem o
 * evento "mensagem recebida", e deixa as conversas novas fechadas.
 *
 * Duas passadas com o mesmo código: "analisar" só conta (prévia) e "importar" grava.
 * Roda em segundo plano no próprio servidor; o andamento fica em
 * `channel_sessions.metadata.importar_historico`. Pode ser repetida à vontade: o que
 * já existe (pela cauda do id da mensagem) é pulado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPhoneBR, phoneLookupVariants } from "@/lib/channels/phone-variants";
import { logger } from "@/lib/logger";
import { getWahaClient } from "@/lib/waha/client";
import type { WahaPayload } from "@/lib/waha/envelope";
import { dataDoTimestamp, mediaMimeOf, resolveMessageType } from "@/lib/waha/ingest";
import { bareWaMessageId } from "@/lib/waha/message-id";

export const CHAVE_DO_ESTADO = "importar_historico";
const TETO_DE_MENSAGENS_POR_CHAT = 50_000;
const PAGINA = 100;
/** Sem sinal de vida por tanto tempo, o trabalho anterior é dado como morto e pode recomeçar. */
const TRABALHO_MORTO_MS = 3 * 60 * 1000;

export type FaseDaImportacao = "analisando" | "pronto" | "importando" | "concluida" | "erro";

export interface EstadoDaImportacao {
  fase: FaseDaImportacao;
  atualizado_em: string;
  conversas_total: number;
  conversas_feitas: number;
  /** Mensagens que ainda não estão no CRM (a prévia e, ao importar, o total a gravar). */
  mensagens_novas: number;
  mensagens_importadas: number;
  ja_existiam: number;
  grupos_ignorados: number;
  sem_telefone: number;
  midias_indisponiveis: number;
  contatos_novos: number;
  conversas_novas: number;
  erro?: string;
}

const ESTADO_ZERO: Omit<EstadoDaImportacao, "fase" | "atualizado_em"> = {
  conversas_total: 0,
  conversas_feitas: 0,
  mensagens_novas: 0,
  mensagens_importadas: 0,
  ja_existiam: 0,
  grupos_ignorados: 0,
  sem_telefone: 0,
  midias_indisponiveis: 0,
  contatos_novos: 0,
  conversas_novas: 0,
};

export interface MensagemParaImportar {
  external_id: string;
  type: string;
  direction: "inbound" | "outbound";
  status: string;
  ack: number | null;
  body: string | null;
  media_mime: string | null;
  media_filename: string | null;
  sem_midia: boolean;
  sent_at: string;
}

const TIPOS_DE_MIDIA = new Set(["image", "video", "audio", "document", "sticker"]);

function corpoDaMensagem(p: WahaPayload): string | null {
  if (typeof p.body === "string" && p.body !== "") return p.body;
  const msg = p._data?.message;
  if (msg && typeof msg === "object") {
    const cm = (msg as { contactMessage?: { vcard?: string; displayName?: string } }).contactMessage;
    if (cm?.vcard) return cm.vcard;
    if (cm?.displayName) return cm.displayName;
  }
  return null;
}

/**
 * Uma mensagem do acervo → a linha do CRM. `null` quando não é mensagem de gente
 * (reação, protocolo, linha vazia) ou não tem id/data. O formato do `external_id`
 * é o mesmo do webhook (recebida: id completo; enviada: só a cauda), para a mesma
 * mensagem não entrar duas vezes se ela chegar também pelo caminho normal.
 */
export function mapearMensagemDoAcervo(bruto: unknown, agora = new Date().toISOString()): MensagemParaImportar | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as WahaPayload & { fromMe?: boolean | null; hasMedia?: boolean | null };
  if (typeof p.id !== "string" || p.id === "") return null;
  if (typeof p.timestamp !== "number" || !(p.timestamp > 0)) return null;
  const conteudo = p._data?.message;
  if (conteudo && typeof conteudo === "object" && ["reactionMessage", "protocolMessage", "senderKeyDistributionMessage"].some((k) => k in conteudo)) {
    return null;
  }
  const type = resolveMessageType(p);
  if (type === "reaction" || type === "system") return null;
  const body = corpoDaMensagem(p);
  const temMidia = Boolean(p.hasMedia) || TIPOS_DE_MIDIA.has(type);
  if (!body && !temMidia && type === "text") return null;

  const saiu = p.fromMe === true;
  const ack = typeof p.ack === "number" ? p.ack : null;
  const status = saiu ? ((ack ?? 0) >= 3 ? "read" : (ack ?? 0) === 2 ? "delivered" : "sent") : "delivered";
  const filename = p.media?.filename;
  return {
    external_id: saiu ? bareWaMessageId(p.id) : p.id,
    type,
    direction: saiu ? "outbound" : "inbound",
    status,
    ack,
    body,
    media_mime: mediaMimeOf(p),
    media_filename: typeof filename === "string" && filename.trim() ? filename.trim() : null,
    sem_midia: temMidia,
    sent_at: dataDoTimestamp(p.timestamp, agora),
  };
}

/** Telefone da conversa: do próprio id (`@c.us`) ou, em `@lid`, do `remoteJidAlt` das mensagens. */
export function telefoneDoChat(chatId: string, mensagens: unknown[]): string | null {
  if (chatId.endsWith("@c.us")) {
    const d = chatId.replace(/@.*$/, "").replace(/\D/g, "");
    return d.length >= 8 ? canonicalPhoneBR(`+${d}`) : null;
  }
  for (const m of mensagens) {
    const alt = (m as { _data?: { key?: { remoteJidAlt?: unknown } } } | null)?._data?.key?.remoteJidAlt;
    if (typeof alt === "string" && alt.endsWith("@s.whatsapp.net")) {
      const d = alt.replace(/@.*$/, "").replace(/\D/g, "");
      if (d.length >= 8) return canonicalPhoneBR(`+${d}`);
    }
  }
  return null;
}

type Canal = { id: string; organization_id: string; waha_session_name: string; metadata: unknown };

export async function lerEstadoDaImportacao(
  db: SupabaseClient,
  organizationId: string,
  canalId: string,
): Promise<EstadoDaImportacao | null> {
  const { data } = await db
    .from("channel_sessions")
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("id", canalId)
    .maybeSingle();
  const meta = data?.metadata as Record<string, unknown> | null;
  const e = meta?.[CHAVE_DO_ESTADO];
  return e && typeof e === "object" ? (e as EstadoDaImportacao) : null;
}

async function gravarEstado(db: SupabaseClient, canal: Canal, estado: EstadoDaImportacao): Promise<void> {
  // Lê-modifica-escreve só desta chave: as outras (`guardar_historico`, `ai_gate*`) voltam como estavam.
  const { data } = await db.from("channel_sessions").select("metadata").eq("id", canal.id).maybeSingle();
  const meta = (data?.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
  await db
    .from("channel_sessions")
    .update({ metadata: { ...meta, [CHAVE_DO_ESTADO]: { ...estado, atualizado_em: new Date().toISOString() } } })
    .eq("id", canal.id)
    .eq("organization_id", canal.organization_id);
}

/** Conversas que o CRM já tem para estes telefones neste número → caudas dos ids já gravados. */
async function caudasJaGravadas(db: SupabaseClient, canal: Canal, telefone: string): Promise<Set<string>> {
  const variantes = phoneLookupVariants(telefone);
  const caudas = new Set<string>();
  if (variantes.length === 0) return caudas;
  const { data: contatos } = await db
    .from("contacts")
    .select("id")
    .eq("organization_id", canal.organization_id)
    .is("is_merged_into", null)
    .in("phone_number", variantes);
  const ids = (contatos ?? []).map((c) => c.id as string);
  if (ids.length === 0) return caudas;
  const { data: conversas } = await db
    .from("conversations")
    .select("id")
    .eq("organization_id", canal.organization_id)
    .eq("channel_session_id", canal.id)
    .eq("is_group", false)
    .in("contact_id", ids);
  const convIds = (conversas ?? []).map((c) => c.id as string);
  for (let i = 0; i < convIds.length; i += 50) {
    for (let de = 0; ; de += 1000) {
      const { data } = await db
        .from("messages")
        .select("external_id")
        .eq("organization_id", canal.organization_id)
        .in("conversation_id", convIds.slice(i, i + 50))
        .not("external_id", "is", null)
        .range(de, de + 999);
      for (const m of data ?? []) caudas.add(bareWaMessageId(m.external_id as string));
      if (!data || data.length < 1000) break;
    }
  }
  return caudas;
}

const emAndamento = new Set<string>();

export type Pedido = "analisar" | "importar";

/** Dispara em segundo plano. Devolve `false` se já há um trabalho vivo neste número. */
export async function iniciarImportacao(
  db: SupabaseClient,
  canal: Canal,
  pedido: Pedido,
): Promise<{ iniciou: boolean; motivo?: "ja_rodando" | "canal_indisponivel" }> {
  const atual = await lerEstadoDaImportacao(db, canal.organization_id, canal.id);
  const vivo =
    atual &&
    (atual.fase === "analisando" || atual.fase === "importando") &&
    Date.now() - new Date(atual.atualizado_em).getTime() < TRABALHO_MORTO_MS;
  if (vivo || emAndamento.has(canal.id)) return { iniciou: false, motivo: "ja_rodando" };
  if (!getWahaClient()) return { iniciou: false, motivo: "canal_indisponivel" };

  emAndamento.add(canal.id);
  const inicial: EstadoDaImportacao = {
    fase: pedido === "analisar" ? "analisando" : "importando",
    atualizado_em: new Date().toISOString(),
    ...ESTADO_ZERO,
  };
  await gravarEstado(db, canal, inicial);
  void executar(db, canal, pedido, inicial)
    .catch(async (err) => {
      logger.error("[importar-historico] falhou", { canalId: canal.id, detail: err instanceof Error ? err.message : "erro" });
      await gravarEstado(db, canal, { ...inicial, fase: "erro", erro: err instanceof Error ? err.message.slice(0, 300) : "erro" });
    })
    .finally(() => emAndamento.delete(canal.id));
  return { iniciou: true };
}

async function executar(db: SupabaseClient, canal: Canal, pedido: Pedido, inicial: EstadoDaImportacao): Promise<void> {
  const client = getWahaClient();
  if (!client) throw new Error("canal_indisponivel");
  const est: EstadoDaImportacao = { ...inicial };

  // Todas as conversas do acervo. Grupos e listas de transmissão ficam de fora.
  const chats: Array<{ id: string; name: string | null }> = [];
  for (let off = 0; ; off += 200) {
    const pagina = await client.chatsDoHistorico(canal.waha_session_name, 200, off);
    for (const c of pagina) {
      if (c.id.endsWith("@c.us") || c.id.endsWith("@lid")) chats.push(c);
      else est.grupos_ignorados += 1;
    }
    if (pagina.length < 200) break;
  }
  est.conversas_total = chats.length;
  await gravarEstado(db, canal, est);

  for (const chat of chats) {
    const brutas: unknown[] = [];
    for (let off = 0; off < TETO_DE_MENSAGENS_POR_CHAT; off += PAGINA) {
      const pagina = await client.mensagensDoChat(canal.waha_session_name, chat.id, PAGINA, off);
      brutas.push(...pagina);
      if (pagina.length < PAGINA) break;
    }
    const telefone = telefoneDoChat(chat.id, brutas);
    const mapeadas = brutas.map((b) => mapearMensagemDoAcervo(b)).filter((m): m is MensagemParaImportar => m !== null);
    if (!telefone) {
      est.sem_telefone += 1;
    } else if (mapeadas.length > 0) {
      const gravadas = await caudasJaGravadas(db, canal, telefone);
      const vistas = new Set<string>();
      const novas = mapeadas.filter((m) => {
        const cauda = bareWaMessageId(m.external_id);
        if (gravadas.has(cauda) || vistas.has(cauda)) return false;
        vistas.add(cauda);
        return true;
      });
      est.ja_existiam += mapeadas.length - novas.length;
      est.mensagens_novas += novas.length;
      est.midias_indisponiveis += novas.filter((m) => m.sem_midia).length;
      if (pedido === "importar" && novas.length > 0) {
        const { data, error } = await db.rpc("fn_importar_historico_lote" as never, {
          p_org: canal.organization_id,
          p_session: canal.id,
          p_chats: [
            {
              kind: chat.id.endsWith("@lid") ? "lid" : "phone",
              phone: telefone,
              lid: chat.id.endsWith("@lid") ? chat.id.replace(/@.*$/, "") : null,
              chat_id: chat.id,
              notify: chat.name,
              mensagens: novas,
            },
          ],
        } as never);
        if (error) throw new Error(`gravacao_falhou: ${error.message}`.slice(0, 300));
        const r = (data ?? {}) as { contatos_novos?: number; conversas_novas?: number; mensagens_novas?: number };
        est.mensagens_importadas += r.mensagens_novas ?? 0;
        est.contatos_novos += r.contatos_novos ?? 0;
        est.conversas_novas += r.conversas_novas ?? 0;
      }
    }
    est.conversas_feitas += 1;
    if (est.conversas_feitas % 5 === 0) await gravarEstado(db, canal, est);
  }
  await gravarEstado(db, canal, { ...est, fase: pedido === "analisar" ? "pronto" : "concluida" });
}
