import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export function useRole(): { loading: boolean; role: "admin" | "customer" | undefined; customerId: string | null } {
  const { session, loading } = useAuth();
  const uid = session?.user?.id;
  const q = useQuery({
    queryKey: ["role", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id").eq("auth_user_id", uid!).maybeSingle();
      if (error) throw error;
      return data ? { role: "customer" as const, customerId: data.id as string } : { role: "admin" as const, customerId: null };
    },
  });
  return {
    loading: loading || (!!uid && q.isLoading),
    role: q.data?.role,
    customerId: q.data?.customerId ?? null,
  };
}
