import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  filtrarCanaisVisiveis,
  visibilidadePorNumeroLigada,
} from "@/lib/personalizacoes/visibilidade-por-numero";

function supabaseQueResponde(visiveis: Record<string, boolean>, erro = false) {
  const rpc = vi.fn(async (_fn: string, args: { p_canal: string }) =>
    erro ? { data: null, error: { message: "x" } } : { data: visiveis[args.p_canal] ?? true, error: null },
  );
  return { rpc } as unknown as Parameters<typeof filtrarCanaisVisiveis>[0] & { rpc: typeof rpc };
}

const CANAIS = [{ id: "numero-paloma" }, { id: "numero-outro" }];

describe("personalização: visibilidade por número", () => {
  it("só liga com true de verdade", () => {
    expect(visibilidadePorNumeroLigada({ visibilidade_por_numero: true })).toBe(true);
    expect(visibilidadePorNumeroLigada({ visibilidade_por_numero: "true" })).toBe(false);
    expect(visibilidadePorNumeroLigada({})).toBe(false);
    expect(visibilidadePorNumeroLigada(null)).toBe(false);
  });

  it("atendente vê só os números que o banco libera", async () => {
    const sb = supabaseQueResponde({ "numero-paloma": true, "numero-outro": false });
    const r = await filtrarCanaisVisiveis(sb, "org", "agent", CANAIS);
    expect(r.map((c) => c.id)).toEqual(["numero-paloma"]);
  });

  it("gerente e administrador não são filtrados nem consultam o banco", async () => {
    for (const papel of ["manager", "admin", "viewer"]) {
      const sb = supabaseQueResponde({ "numero-outro": false });
      expect(await filtrarCanaisVisiveis(sb, "org", papel, CANAIS)).toEqual(CANAIS);
      expect(sb.rpc).not.toHaveBeenCalled();
    }
  });

  it("se o banco falhar, a lista volta inteira (quem protege as conversas é a RLS)", async () => {
    const sb = supabaseQueResponde({}, true);
    expect(await filtrarCanaisVisiveis(sb, "org", "agent", CANAIS)).toEqual(CANAIS);
  });

  it("o SQL é uma política RESTRITIVA de leitura e o update.sh o aplica depois do baseline", () => {
    const sql = readFileSync("supabase/personalizacoes.sql", "utf8");
    expect(sql).toMatch(/create policy "conversations_select_pelo_numero" on public\.conversations\s+as restrictive\s+for select/);
    expect(sql).toContain("settings->>'visibilidade_por_numero'");
    const update = readFileSync("hostgator-setup-kit/update.sh", "utf8");
    const baseline = update.indexOf('reaplicar_baseline "$PROJECT_DIR/supabase/baseline.sql"');
    const personalizacoes = update.indexOf("supabase/personalizacoes.sql:/p.sql:ro");
    expect(baseline).toBeGreaterThan(0);
    expect(personalizacoes).toBeGreaterThan(baseline);
  });
});
