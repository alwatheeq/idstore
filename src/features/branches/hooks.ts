import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import * as api from "./api";
import type { BranchPayload } from "./schema";

export function useBranches() {
  return useQuery({ queryKey: ["branches"], queryFn: api.listBranches });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: BranchPayload) => api.createBranch(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useUpdateBranch(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: BranchPayload) => api.updateBranch(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
