/**
 * Personalização do fork: a IDA da agenda (agenda-google-push) roda a cada minuto.
 * O oficial roda a cada 5; quem agendou pelo WhatsApp esperava até 5 minutos
 * pelo convite e pelo link do Meet. A ida é barata (só manda o que mudou).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ENTRYPOINT = readFileSync(path.join(process.cwd(), "docker/scheduler/entrypoint.sh"), "utf8");

describe("a ida da agenda do Google (personalização do fork)", () => {
  it("roda a cada minuto, com prazo de 60s", () => {
    const linha = ENTRYPOINT.split("\n").find(
      (l) => l.includes("api/v1/cron/agenda-google-push") && l.includes("|"),
    );
    expect(linha).toBeDefined();
    expect(linha!.trim()).toBe("* * * * *|60|api/v1/cron/agenda-google-push");
  });
});
