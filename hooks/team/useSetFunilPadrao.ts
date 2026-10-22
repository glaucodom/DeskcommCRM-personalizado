"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";

/** Fork #23: o funil que "Funis" abre para uma pessoa (null = o padrão da empresa). */
export function useSetFunilPadrao() {
  const qc = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: async (args: { userId: string; pipelineId: string | null }) =>
      apiClient.patch(`/api/v1/team/${args.userId}/funil-padrao`, { pipeline_id: args.pipelineId }),
    onError: showApiError,
    onSuccess: () => {
      toast.success(t("Funil padrão atualizado."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
