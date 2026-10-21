/**
 * TIPO DE CLIENTE da organização (personalização do fork #20).
 *
 * A mesma instalação atende empresas que vendem para empresas (B2B, o padrão) e empresas
 * que vendem para pessoas (B2C, ex.: uma clínica). `organizations.settings.tipo_de_cliente`
 * guarda `"empresas"` ou `"pessoas"`; ausente ou inválido = `"empresas"`, então quem nunca
 * configurou (a CRTI) segue exatamente como antes.
 *
 * Em `"pessoas"` o cadastro do contato esconde Empresa, CNPJ, Segmentos e "como conheceu" e
 * passa a ter só CPF e data de nascimento; o menu de Empresas some. Nada é apagado: trocar
 * de volta traz tudo de volta. Todo o resto do código usa SÓ este helper.
 */
import { isValidCpf } from "@/lib/legal/perfil-do-pais";

export const CHAVE_TIPO_DE_CLIENTE = "tipo_de_cliente";

export type TipoDeCliente = "empresas" | "pessoas";

export const TIPOS_DE_CLIENTE: readonly TipoDeCliente[] = ["empresas", "pessoas"];

export function ehTipoDeCliente(v: unknown): v is TipoDeCliente {
  return v === "empresas" || v === "pessoas";
}

/** Lê `settings` e devolve o tipo; ausente ou inválido cai em `"empresas"`. */
export function tipoDeCliente(settings: Record<string, unknown> | null | undefined): TipoDeCliente {
  const v = settings?.[CHAVE_TIPO_DE_CLIENTE];
  return ehTipoDeCliente(v) ? v : "empresas";
}

export function ehPessoas(settings: Record<string, unknown> | null | undefined): boolean {
  return tipoDeCliente(settings) === "pessoas";
}

/** "12345678909" -> "123.456.789-09", enquanto digita. */
export function mascaraCpf(entrada: string): string {
  const d = entrada.replace(/\D/g, "").slice(0, 11);
  let s = d.slice(0, 3);
  if (d.length > 3) s += `.${d.slice(3, 6)}`;
  if (d.length > 6) s += `.${d.slice(6, 9)}`;
  if (d.length > 9) s += `-${d.slice(9)}`;
  return s;
}

/** Vazio é permitido (campo opcional); preenchido precisa ter 11 dígitos e dígitos verificadores certos. */
export function cpfVazioOuValido(valor: string): boolean {
  return valor.trim() === "" || isValidCpf(valor);
}

/** Campos do contato que só existem no modo empresas. */
export const CAMPOS_SO_DE_EMPRESAS = ["empresa", "cnpj", "segmentos"] as const;

/** Tira do corpo os campos de empresa quando a organização atende pessoas. */
export function semCamposDeEmpresa<T extends Record<string, unknown>>(corpo: T): T {
  const copia: Record<string, unknown> = { ...corpo };
  for (const k of CAMPOS_SO_DE_EMPRESAS) delete copia[k];
  return copia as T;
}

/** Lê o tipo direto do banco (para o motor do agente e rotas de servidor). */
export async function lerTipoDeClienteSql(
  db: { query: <R>(sql: string, params: unknown[]) => Promise<{ rows: R[] }> },
  organizationId: string,
): Promise<TipoDeCliente> {
  const { rows } = await db.query<{ tipo: unknown }>(
    `select settings->'tipo_de_cliente' as tipo from organizations where id = $1`,
    [organizationId],
  );
  return ehTipoDeCliente(rows[0]?.tipo) ? rows[0]!.tipo as TipoDeCliente : "empresas";
}
