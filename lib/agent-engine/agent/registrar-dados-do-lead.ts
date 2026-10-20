/**
 * Personalização do fork: `registrar_dados_do_lead` — o agente grava no CRM o que a pessoa
 * acabou de dizer (nome, empresa, CNPJ, e-mail, segmento, como conheceu, quem indicou).
 *
 * Por que existe: a única ferramenta de escrita de cadastro que o agente tinha
 * (`crm_propose_contact_field`) só PROPÕE para uma pessoa confirmar, e empresa/CNPJ nem
 * proposta aceitam. O dono quer que tudo fique estruturado no banco para a integração com
 * o CRM da CRTI — então a ferramenta grava direto nas tabelas que o produto já tem:
 *
 *   • `contacts`        → name, display_name (quando o atual não é nome de gente), e-mail,
 *                         `custom_fields` (segmento, como_conheceu, indicado_por);
 *   • `people`          → a pessoa (full_name), ligada ao contato por `contacts.person_id`;
 *   • `companies`       → a empresa (trade_name; cnpj/normalized_cnpj quando válido);
 *   • `company_people`  → o vínculo pessoa ↔ empresa.
 *
 * Disciplina: tenant e lead vêm da ROW do job (closure), nunca do que o modelo mandou.
 * Whitelist `.strict()`. Nada do que a pessoa disse entra em log. Cada passo é idempotente:
 * a ferramenta pode ser chamada de novo com mais um dado (primeiro o nome, depois a
 * empresa, depois o CNPJ) e o cadastro só cresce, sem duplicar empresa nem pessoa.
 * CNPJ: só confere 14 dígitos (a mesma régua de `normalizeCnpj`); a consulta à BrasilAPI
 * fica `pending` para o enriquecimento que o produto já tem.
 */
import { padronizarOrigem } from '@/lib/personalizacoes/origem-do-lead';
import { z } from 'zod';

import { normalizeCnpj, formatCnpj, normalizePersonName } from '@/lib/crm-b2b/normalize';
import { ehIdentificadorTecnico } from '@/lib/contacts/rotulo-do-contato';
import type { Queryable } from '../queue/queue';

export const registrarDadosShape = z
  .object({
    nome: z.string().optional().describe('primeiro nome ou nome da pessoa, como ela disse'),
    empresa: z.string().optional().describe('nome da empresa dela, como ela disse'),
    cnpj: z.string().optional().describe('CNPJ da empresa, como ela digitou'),
    email: z.string().optional().describe('e-mail da pessoa'),
    segmento: z.string().optional().describe('segmento(s) da empresa, ex.: "construção pesada, usina de asfalto"'),
    como_conheceu: z.string().optional().describe('como conheceu a CRTI, ex.: "indicação", "Google"'),
    indicado_por: z.string().optional().describe('quem indicou (pessoa ou empresa)'),
  })
  .strict();

const LIMITES = { nome: 80, empresa: 120, email: 120, segmento: 120, como_conheceu: 120, indicado_por: 120 } as const;

export type DadosDoLead = z.infer<typeof registrarDadosShape>;

export interface RegistroResultado {
  ok: boolean;
  registrado: string[];
  avisos: string[];
  erro?: string;
}

function limpa(v: string | undefined, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max);
  return t.length >= 2 ? t : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function primeiroToken(s: string): string {
  return (normalizePersonName(s) ?? '').split(' ')[0] ?? '';
}

export async function aplicarRegistroDoLead(
  db: Queryable,
  ids: { tenantId: string; leadId: string },
  raw: unknown,
): Promise<RegistroResultado> {
  const parsed = registrarDadosShape.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      registrado: [],
      avisos: [],
      erro:
        'campo fora da lista. Campos aceitos: nome, empresa, cnpj, email, segmento, como_conheceu, indicado_por.',
    };
  }
  const d = parsed.data;
  const nome = limpa(d.nome, LIMITES.nome);
  const empresa = limpa(d.empresa, LIMITES.empresa);
  const segmento = limpa(d.segmento, LIMITES.segmento);
  const comoConhecidoBruto = limpa(d.como_conheceu, LIMITES.como_conheceu);
  // Fork: a origem vira um nome padrão (Google, Instagram, IA, IA (ChatGPT)…).
  const comoConheceu = comoConhecidoBruto ? padronizarOrigem(comoConhecidoBruto) : null;
  const indicadoPor = limpa(d.indicado_por, LIMITES.indicado_por);
  const emailBruto = limpa(d.email, LIMITES.email)?.toLowerCase() ?? null;
  const email = emailBruto && EMAIL.test(emailBruto) ? emailBruto : null;
  const cnpjNorm = d.cnpj ? normalizeCnpj(d.cnpj) : null;

  const registrado: string[] = [];
  const avisos: string[] = [];
  if (d.cnpj && !cnpjNorm) avisos.push('cnpj_invalido: confira com a pessoa; precisa ter 14 números.');
  if (emailBruto && !email) avisos.push('email_invalido: confira com a pessoa.');
  if (!nome && !empresa && !cnpjNorm && !email && !segmento && !comoConheceu && !indicadoPor) {
    return { ok: false, registrado, avisos, erro: avisos[0] ?? 'nada para registrar: informe pelo menos um campo.' };
  }

  const { tenantId, leadId } = ids;
  const { rows: cRows } = await db.query<{
    name: string | null;
    display_name: string | null;
    phone_number: string | null;
    email: string | null;
    person_id: string | null;
  }>(
    `select name, display_name, phone_number, email, person_id
       from contacts where organization_id = $1 and id = $2`,
    [tenantId, leadId],
  );
  const contato = cRows[0];
  if (!contato) return { ok: false, registrado, avisos, erro: 'contato não encontrado.' };

  // ── contato: nome, e-mail e campos livres ────────────────────────────────
  const atual = (contato.display_name ?? '').trim();
  const atualNaoEhNome =
    atual === '' ||
    atual === (contato.phone_number ?? '') ||
    ehIdentificadorTecnico(atual) ||
    /^\+?[\d\s()-]{8,}$/.test(atual);
  const trocaDisplay = nome !== null && (atualNaoEhNome || primeiroToken(atual) !== primeiroToken(nome));
  const campos: Record<string, string> = {};
  if (segmento) campos.segmento = segmento;
  if (comoConheceu) campos.como_conheceu = comoConheceu;
  if (indicadoPor) campos.indicado_por = indicadoPor;
  if (empresa) campos.empresa_informada = empresa;
  if (cnpjNorm) campos.cnpj_informado = formatCnpj(cnpjNorm);

  // Lista de segmentos: "construção pesada, usina de asfalto" → 2 itens. Soma aos já gravados.
  const listaDeSegmentos = segmento
    ? [...new Set(segmento.split(/\s*[,;/]\s*|\s+e\s+/i).map((s) => s.trim()).filter((s) => s.length >= 2))]
    : [];

  if (nome || email || empresa || cnpjNorm || listaDeSegmentos.length > 0 || Object.keys(campos).length > 0) {
    await db.query(
      `update contacts
          set name = case when $3::text is not null then $3 else name end,
              display_name = case when $4::boolean then $3 else display_name end,
              email = case when $5::text is not null and email is null then $5 else email end,
              custom_fields = coalesce(custom_fields, '{}'::jsonb) || $6::jsonb,
              empresa = coalesce($7::text, empresa),
              cnpj = coalesce($8::text, cnpj),
              segmentos = case
                when cardinality($9::text[]) = 0 then segmentos
                else (select coalesce(array_agg(distinct s), '{}') from unnest(segmentos || $9::text[]) s) end,
              updated_at = now()
        where organization_id = $1 and id = $2`,
      [tenantId, leadId, nome, trocaDisplay, email, JSON.stringify(campos), empresa, cnpjNorm, listaDeSegmentos],
    );
    if (nome) registrado.push('nome');
    if (email) registrado.push('email');
    for (const k of ['segmento', 'como_conheceu', 'indicado_por'] as const) if (campos[k]) registrado.push(k);
  }

  // ── empresa (e pessoa, para ligar as duas) ───────────────────────────────
  if (empresa || cnpjNorm) {
    let companyId: string | null = null;

    if (cnpjNorm) {
      const { rows } = await db.query<{ id: string }>(
        `select id from companies where organization_id = $1 and normalized_cnpj = $2`,
        [tenantId, cnpjNorm],
      );
      companyId = rows[0]?.id ?? null;
    }
    if (!companyId && contato.person_id) {
      // a empresa já ligada a esta pessoa (criada antes de o CNPJ chegar)
      const { rows } = await db.query<{ id: string; normalized_cnpj: string | null }>(
        `select c.id, c.normalized_cnpj
           from company_people cp join companies c on c.id = cp.company_id and c.organization_id = cp.organization_id
          where cp.organization_id = $1 and cp.person_id = $2
          order by cp.is_primary desc, cp.created_at desc limit 1`,
        [tenantId, contato.person_id],
      );
      if (rows[0] && (!rows[0].normalized_cnpj || rows[0].normalized_cnpj === cnpjNorm)) companyId = rows[0].id;
    }
    if (!companyId && empresa) {
      const { rows } = await db.query<{ id: string }>(
        `select id from companies
          where organization_id = $1 and normalized_cnpj is null and lower(trade_name) = lower($2)
          order by created_at limit 1`,
        [tenantId, empresa],
      );
      companyId = rows[0]?.id ?? null;
    }

    if (companyId) {
      await db.query(
        `update companies
            set trade_name = coalesce($3, trade_name),
                cnpj = case when $4::text is not null and normalized_cnpj is null then $5 else cnpj end,
                normalized_cnpj = case when $4::text is not null and normalized_cnpj is null then $4 else normalized_cnpj end,
                updated_at = now()
          where organization_id = $1 and id = $2`,
        [tenantId, companyId, empresa, cnpjNorm, cnpjNorm ? formatCnpj(cnpjNorm) : null],
      );
    } else {
      const ins = await db.query<{ id: string }>(
        `insert into companies (organization_id, trade_name, cnpj, normalized_cnpj, enrichment_status)
         values ($1, $2, $3, $4, 'pending')
         on conflict (organization_id, normalized_cnpj) where normalized_cnpj is not null
         do update set trade_name = coalesce(excluded.trade_name, companies.trade_name), updated_at = now()
         returning id`,
        [tenantId, empresa, cnpjNorm ? formatCnpj(cnpjNorm) : null, cnpjNorm],
      );
      companyId = ins.rows[0]?.id ?? null;
    }
    if (empresa) registrado.push('empresa');
    if (cnpjNorm) registrado.push('cnpj');

    // pessoa ligada ao contato → vínculo com a empresa
    if (companyId) {
      let personId = contato.person_id;
      const nomeDaPessoa =
        nome ?? (atualNaoEhNome ? (contato.phone_number ?? 'Contato sem nome') : atual);
      if (!personId) {
        const p = await db.query<{ id: string }>(
          `insert into people (organization_id, full_name, normalized_name, email)
           values ($1, $2, $3, $4) returning id`,
          [tenantId, nomeDaPessoa, normalizePersonName(nomeDaPessoa), email ?? contato.email],
        );
        personId = p.rows[0]?.id ?? null;
        if (personId) {
          await db.query(`update contacts set person_id = $3 where organization_id = $1 and id = $2`, [
            tenantId,
            leadId,
            personId,
          ]);
        }
      } else if (nome) {
        await db.query(
          `update people set full_name = $3, normalized_name = $4, updated_at = now()
            where organization_id = $1 and id = $2`,
          [tenantId, personId, nome, normalizePersonName(nome)],
        );
      }
      if (personId) {
        await db.query(
          `insert into company_people (organization_id, company_id, person_id, is_primary)
           values ($1, $2, $3, true) on conflict (company_id, person_id) do nothing`,
          [tenantId, companyId, personId],
        );
      }
    }
  } else if (nome && contato.person_id) {
    await db.query(
      `update people set full_name = $3, normalized_name = $4, updated_at = now()
        where organization_id = $1 and id = $2`,
      [tenantId, contato.person_id, nome, normalizePersonName(nome)],
    );
  }

  return { ok: true, registrado, avisos };
}
