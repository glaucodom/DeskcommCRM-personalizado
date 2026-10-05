// Teste de ponta a ponta de "Ver arquivo enviado" / "Editar texto".
// Roda DENTRO do container do app:  docker compose exec -T app node - < teste-editar-texto.mjs
// Cria um material temporário, espera a indexação, lê, edita (mesma sequência da
// rota PATCH), reindexa, confere os trechos e arquiva o material no fim.
// Nunca imprime chaves. Nunca toca em material que não criou.
import { randomUUID } from "node:crypto";

const URL_ = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG = process.env.ORG_ID;
const MARCADOR = "EDITADO_TESTE_BASE_CONHECIMENTO";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`REST ${path} ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
async function subir(path, texto) {
  const r = await fetch(`${URL_}/storage/v1/object/ai-policy/${path}`, {
    method: "POST", headers: { ...H, "Content-Type": "text/markdown", "x-upsert": "false" }, body: texto,
  });
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function baixar(path) {
  const r = await fetch(`${URL_}/storage/v1/object/ai-policy/${path}`, { headers: H });
  if (!r.ok) throw new Error(`download ${r.status}`);
  return r.text();
}
const fonte = (id) => rest(`ai_knowledge_sources?id=eq.${id}&select=*`).then((x) => x[0]);
async function emitir(id) {
  await rest("rpc/emit_event", { method: "POST", body: JSON.stringify({
    p_event_type: "knowledge_source.updated", p_entity_kind: "ai_knowledge_source", p_entity_id: id,
    p_payload: { knowledge_source_id: id, agent_id: null, source_type: "documento", triggered_by: "teste_e2e" },
    p_organization_id: ORG,
  }) });
}
async function esperarPronta(id, depoisDe, rotulo) {
  const inicio = Date.now(); let repetiu = false;
  while (Date.now() - inicio < 5 * 60_000) {
    const f = await fonte(id);
    if (f.last_index_status === "failed" || f.last_index_status === "sem_credencial") throw new Error(`${rotulo}: ${f.last_index_status} ${f.last_index_error}`);
    if (f.last_index_status === "success" && f.last_indexed_at && new Date(f.last_indexed_at) >= depoisDe) {
      log(`${rotulo}: pronta em ${Math.round((Date.now() - inicio) / 1000)}s, ${f.chunks_count} trechos`); return f;
    }
    if (!repetiu && Date.now() - inicio > 35_000) { repetiu = true; log(`${rotulo}: pedindo de novo após 35s (debounce)`); await emitir(id); }
    await sleep(3000);
  }
  throw new Error(`${rotulo}: não ficou pronta em 5 min`);
}
// Os mesmos trechos que a tela "Ver o que ele aprendeu" mostra: os da versão ativa.
const trechos = async (id) => {
  const f = await fonte(id);
  return rest(`ai_chunks?organization_id=eq.${ORG}&knowledge_source_id=eq.${id}&kb_version_id=eq.${f.active_kb_version_id}&select=content`);
};

let id = null;
try {
  if (!URL_ || !KEY || !ORG) throw new Error("faltam variáveis de ambiente (URL, chave ou ORG_ID)");
  const v1 = `${ORG}/${randomUUID()}.md`;
  const texto1 = "# TESTE TEMPORÁRIO\n\nMaterial de teste automático. Versão original MARCADOR_V1.\n";
  await subir(v1, texto1);
  const [linha] = await rest("ai_knowledge_sources", { method: "POST", body: JSON.stringify({
    organization_id: ORG, agent_id: null, source_type: "documento",
    name: `TESTE TEMPORÁRIO ${new Date().toISOString().slice(0, 16)}`, status: "ready", is_active: true,
    ingested_at: new Date().toISOString(),
    source_metadata: { filename: "teste.md", blob_path: v1, ext: "md", origem: "texto_colado", size_bytes: texto1.length },
  }) });
  id = linha.id; log("material criado", id);
  const t0 = new Date(); await emitir(id);
  await esperarPronta(id, t0, "indexação inicial");

  // Ver arquivo enviado: o conteúdo lido é o do arquivo ativo.
  const lido = await baixar((await fonte(id)).source_metadata.blob_path);
  if (lido !== texto1) throw new Error("Ver arquivo: conteúdo diferente do enviado");
  log("Ver arquivo enviado: conteúdo confere");

  // Editar texto: mesma sequência da rota PATCH.
  const antes = await fonte(id);
  const v2 = `${ORG}/${randomUUID()}.md`;
  const texto2 = `# TESTE TEMPORÁRIO\n\nTexto editado. ${MARCADOR}.\n`;
  await subir(v2, texto2);
  if ((await baixar(v2)) !== texto2) throw new Error("nova versão não confere após gravar");
  const agora = new Date().toISOString();
  const m = antes.source_metadata;
  const meta = { ...m, blob_path: v2, size_bytes: texto2.length, mime_type: "text/markdown", versao: (m.versao || 1) + 1,
    editado_em: agora, editado_por: "teste_e2e",
    historico: [...(m.historico || []), { versao: m.versao || 1, blob_path: m.blob_path, ext: "md", filename: m.filename ?? null,
      size_bytes: m.size_bytes ?? null, substituida_em: agora, substituida_por: "teste_e2e" }] };
  const trocou = await rest(`ai_knowledge_sources?id=eq.${id}&organization_id=eq.${ORG}&source_metadata->>blob_path=eq.${encodeURIComponent(m.blob_path)}`,
    { method: "PATCH", body: JSON.stringify({ source_metadata: meta, last_index_error: null }) });
  if (trocou.length !== 1) throw new Error("troca do ponteiro não aconteceu");
  const t1 = new Date(); await emitir(id);
  const depois = await esperarPronta(id, t1, "reindexação");

  const ok = [];
  ok.push(["nova versão criada (2)", depois.source_metadata.versao === 2]);
  ok.push(["versão anterior no histórico", depois.source_metadata.historico?.[0]?.blob_path === v1]);
  ok.push(["arquivo anterior continua no bucket", (await baixar(v1)) === texto1]);
  ok.push(["ponteiro no arquivo novo", depois.source_metadata.blob_path === v2]);
  ok.push(["fonte ativa e pronta", depois.is_active === true && depois.status === "ready"]);
  const ts = await trechos(id);
  ok.push(["trechos contêm o texto editado", ts.some((t) => t.content.includes(MARCADOR))]);
  ok.push(["trechos não contêm mais o texto antigo", !ts.some((t) => t.content.includes("MARCADOR_V1"))]);
  for (const [n, v] of ok) log(v ? "OK  " : "FALHOU", n);
  process.exitCode = ok.every(([, v]) => v) ? 0 : 1;
} catch (e) {
  log("ERRO:", e.message); process.exitCode = 1;
} finally {
  if (id) { await rest(`ai_knowledge_sources?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "archived", is_active: false }) })
    .then(() => log("material de teste arquivado")).catch((e) => log("NÃO arquivou:", e.message)); }
}
