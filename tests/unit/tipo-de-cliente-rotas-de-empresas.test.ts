/**
 * Fork #20 — organização B2C não tem Empresas/Pessoas, mesmo com o módulo crm_b2b ligado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ moduloLigado: true, pessoas: false }));
vi.mock("@/lib/instalacao/modulos", () => ({ moduloLigado: async () => estado.moduloLigado }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/personalizacoes/tipo-de-cliente-servidor", () => ({ orgAtivaAtendePessoas: async () => estado.pessoas }));

import { seModuloB2bDesligado } from "@/lib/crm-b2b/route-helpers";

describe("seModuloB2bDesligado com tipo de cliente", () => {
  beforeEach(() => {
    estado.moduloLigado = true;
    estado.pessoas = false;
  });

  it("empresas (padrão) com módulo ligado: libera", async () => {
    expect(await seModuloB2bDesligado("r1")).toBeNull();
  });

  it("pessoas com módulo ligado: 404", async () => {
    estado.pessoas = true;
    const r = await seModuloB2bDesligado("r1");
    expect(r?.status).toBe(404);
  });

  it("módulo desligado continua 404", async () => {
    estado.moduloLigado = false;
    expect((await seModuloB2bDesligado("r1"))?.status).toBe(404);
  });
});
