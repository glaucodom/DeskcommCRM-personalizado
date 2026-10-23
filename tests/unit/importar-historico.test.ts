/**
 * Fork #30 — mapeamento do acervo do canal para linhas do CRM (puro, sem rede).
 */
import { describe, expect, it } from "vitest";

import { mapearMensagemDoAcervo, telefoneDoChat } from "@/lib/waha/importar-historico";

const base = { timestamp: 1792755253, ack: 3 };

describe("mapearMensagemDoAcervo", () => {
  it("recebida: guarda o id completo (igual ao webhook) e fica 'delivered'", () => {
    const m = mapearMensagemDoAcervo({ ...base, id: "false_554198765432@c.us_ABC123", fromMe: false, body: "oi", hasMedia: false });
    expect(m).toMatchObject({ external_id: "false_554198765432@c.us_ABC123", direction: "inbound", status: "delivered", type: "text", body: "oi", sem_midia: false });
  });

  it("enviada: guarda só a cauda e traduz o ack em status", () => {
    const lida = mapearMensagemDoAcervo({ ...base, id: "true_554198765432@c.us_3EB0AA", fromMe: true, body: "ola", ack: 3 });
    expect(lida).toMatchObject({ external_id: "3EB0AA", direction: "outbound", status: "read" });
    expect(mapearMensagemDoAcervo({ ...base, id: "true_x@c.us_B", fromMe: true, body: "a", ack: 2 })?.status).toBe("delivered");
    expect(mapearMensagemDoAcervo({ ...base, id: "true_x@c.us_C", fromMe: true, body: "a", ack: 1 })?.status).toBe("sent");
  });

  it("mídia entra sem arquivo, marcada como indisponível", () => {
    const m = mapearMensagemDoAcervo({
      ...base, id: "false_x@c.us_IMG", fromMe: false, body: null, hasMedia: true,
      media: { url: "http://expirou", mimetype: "image/jpeg", filename: null },
      _data: { message: { imageMessage: {} } },
    });
    expect(m).toMatchObject({ type: "image", sem_midia: true, media_mime: "image/jpeg" });
  });

  it("ignora reação, linha vazia e mensagem sem id ou data", () => {
    expect(mapearMensagemDoAcervo({ ...base, id: "false_x@c.us_R", body: "👍", _data: { message: { reactionMessage: {} } } })).toBeNull();
    expect(mapearMensagemDoAcervo({ ...base, id: "false_x@c.us_V", body: "", hasMedia: false })).toBeNull();
    expect(mapearMensagemDoAcervo({ body: "oi", timestamp: 1792755253 })).toBeNull();
    expect(mapearMensagemDoAcervo({ id: "false_x@c.us_T", body: "oi" })).toBeNull();
    expect(mapearMensagemDoAcervo(null)).toBeNull();
  });
});

describe("telefoneDoChat", () => {
  it("@c.us vira telefone com o nono dígito", () => {
    expect(telefoneDoChat("554198765432@c.us", [])).toBe("+5541998765432");
  });
  it("@lid usa o remoteJidAlt das mensagens; sem ele, null", () => {
    const msg = { _data: { key: { remoteJidAlt: "554999998888@s.whatsapp.net" } } };
    expect(telefoneDoChat("72705340649619@lid", [{}, msg])).toBe("+5549999998888");
    expect(telefoneDoChat("72705340649619@lid", [{}])).toBeNull();
  });
});
