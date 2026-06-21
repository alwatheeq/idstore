import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import * as api from "./api";

export function useModelImages() {
  return useQuery({
    queryKey: ["modelImages"],
    queryFn: api.listModelImages,
    staleTime: 5 * 60_000,
  });
}

export function useUploadModelImage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ modelKey, file }: { modelKey: string; file: File }) =>
      api.uploadModelImage(modelKey, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelImages"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useDeleteModelImage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (modelKey: string) => api.deleteModelImage(modelKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelImages"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
