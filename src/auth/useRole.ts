import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export type Role = "admin" | "customer" | "none";

export function useRole(): { loading: boolean; role: Role | undefined; customerId: string | null } {
  const { session, loading } = useAuth();
  const uid = session?.user?.id;
  const q = useQuery({
    queryKey: ["role", uid],
    enabled: !!uid,
    queryFn: async (): Promise<{ role: Role; customerId: string | null }> => {
      // 1. Check if the user is a linked customer first.
      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", uid!)
        .maybeSingle();
      if (customerError) throw customerError;
      if (customerRow) {
        return { role: "customer", customerId: customerRow.id as string };
      }

      // 2. Not a customer — check if they are an admin via the SECURITY DEFINER RPC.
      //    Fail-closed: any error → "none", never fall through to admin by default.
      const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
      if (rpcError || !isAdmin) {
        return { role: "none", customerId: null };
      }

      return { role: "admin", customerId: null };
    },
  });
  return {
    loading: loading || (!!uid && q.isLoading),
    role: q.data?.role,
    customerId: q.data?.customerId ?? null,
  };
}
