import { useMutation, useQueryClient } from "@tanstack/react-query";
import { provisionPortalLogin } from "./api";

export function useProvisionPortalLogin(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, pin }: { phone: string; pin: string }) =>
      provisionPortalLogin(customerId, phone, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer", customerId] }),
  });
}
