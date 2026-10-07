/**
 * Duas atualizações ao mesmo tempo derrubam o CRM. Medido na VPS em
 * 2026-10-06: com uma atualização no meio (aviso de manutenção de pé), uma
 * segunda leu o aviso como "preso", o derrubou e mandou repetir com --force — e
 * a terceira correu junto com a primeira.
 *
 * O que este teste trava:
 *  1. com a trava (.update.lock) segura por outro, o update.sh recusa, explica
 *     em português e sai sem tocar em nada — nem no arquivo de diagnóstico da
 *     atualização que está rodando;
 *  2. o agent.sh, que já segura a mesma trava, avisa o update.sh para não
 *     travar contra ele mesmo;
 *  3. a troca da senha das rotinas, que usa a mesma trava, continua
 *     acontecendo numa atualização pelo terminal.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const KIT = join(__dirname, "../../hostgator-setup-kit");
const temFlock = spawnSync("sh", ["-c", "command -v flock"]).status === 0;

describe("uma atualização por vez", () => {
  const pastas: string[] = [];
  afterEach(() => {
    for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
  });

  it.skipIf(!temFlock)("recusa quando outra atualização segura a trava", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uma-por-vez-"));
    pastas.push(dir);
    writeFileSync(join(dir, "docker-compose.prod.yml"), "");
    writeFileSync(join(dir, ".env"), "APP_DOMAIN=exemplo.test\n");
    const trava = join(dir, ".update.lock");
    writeFileSync(trava, "");

    // A "outra atualização": segura a trava até o teste terminar.
    const outra = spawn("flock", [trava, "sh", "-c", "echo pronto; sleep 30"]);
    try {
      await new Promise<void>((ok) => outra.stdout.once("data", () => ok()));

      const r = spawnSync("bash", [join(KIT, "update.sh"), "--to", "v9.9.9"], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, DESKCOMM_TRAVA_DA_ATUALIZACAO: "" },
        timeout: 20_000,
      });

      expect(r.status).toBe(1);
      expect(r.stdout + r.stderr).toContain("Já tem uma atualização rodando");
      expect(r.stdout + r.stderr).toContain("Não use --force");
      expect(existsSync(join(dir, ".deskcomm-update-diagnostico.log"))).toBe(false);
    } finally {
      outra.kill();
    }
  });

  it("o agente avisa o update.sh que já segura a trava", () => {
    const agente = readFileSync(join(KIT, "agent.sh"), "utf8");
    const chamada = agente.slice(agente.indexOf("DESKCOMM_AGENT_REPORT=1"));
    expect(chamada.slice(0, chamada.indexOf("update.sh"))).toContain(
      "DESKCOMM_TRAVA_DA_ATUALIZACAO=1",
    );
    expect(agente).toContain('exec 9>"$LOCK"');
    expect(agente).toContain('LOCK="${PROJECT_DIR}/.update.lock"');
  });

  it("o update.sh usa a mesma trava do agente", () => {
    const update = readFileSync(join(KIT, "update.sh"), "utf8");
    expect(update).toContain('exec 9>"$PROJECT_DIR/.update.lock"');
  });

  it("a troca da senha das rotinas não se tranca para fora quando o update.sh já segura a trava", () => {
    // Sem isto, a troca tentaria o cadeado que a própria execução segura, daria
    // "ocupado" e nunca aconteceria por uma atualização do terminal.
    const update = readFileSync(join(KIT, "update.sh"), "utf8");
    expect(update).toContain("export DESKCOMM_TRAVA_DESTA_ATUALIZACAO=1");
    const comum = readFileSync(join(KIT, "_common.sh"), "utf8");
    const troca = comum.slice(comum.indexOf("trocar_segredo_do_cron_vazado() {"));
    const ateOCadeado = troca.slice(0, troca.indexOf('exec 8>"${dir}/.update.lock"'));
    expect(ateOCadeado).toContain("DESKCOMM_TRAVA_DESTA_ATUALIZACAO");
  });
});
