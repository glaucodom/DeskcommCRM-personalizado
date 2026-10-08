import { describe, expect, it } from "vitest";

import { visibleInboxTabs } from "@/components/inbox/InboxFilters";

describe("personalização: Minhas é a primeira aba do inbox", () => {
  it("Minhas vem antes da Fila e Automático continua por último", () => {
    const abas = visibleInboxTabs("agent", "all");
    expect(abas[0]).toBe("mine");
    expect(abas[1]).toBe("unassigned");
    expect(abas[abas.length - 1]).toBe("ai");
  });

  it("vale também para quem não vê Todas", () => {
    expect(visibleInboxTabs("agent", "own")[0]).toBe("mine");
  });
});
