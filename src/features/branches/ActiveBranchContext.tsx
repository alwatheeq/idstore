import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { useBranches } from "./hooks";
import { getAdminProfile } from "./api";
import type { Branch } from "./types";

export const ALL_BRANCHES = "all";

type Ctx = {
  branches: Branch[];
  accessible: Branch[];
  activeBranchId: string; // a branch id or ALL_BRANCHES
  setActiveBranchId: (id: string) => void;
  isSuper: boolean;
  isAll: boolean;
  /** Concrete branch id when a single branch is active, else null ("All branches"). */
  branchId: string | null;
};

// Default = "all branches" / no scoping, so components & hooks work without the
// provider (e.g. in unit tests) instead of throwing. The real provider is mounted
// app-wide in main.tsx.
const DEFAULT_CTX: Ctx = {
  branches: [],
  accessible: [],
  activeBranchId: "",
  setActiveBranchId: () => {},
  isSuper: false,
  isAll: false,
  branchId: null,
};

export const ActiveBranchContext = createContext<Ctx>(DEFAULT_CTX);

export function useActiveBranch(): Ctx {
  return useContext(ActiveBranchContext);
}

export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const { data: branches } = useBranches();
  const { data: profile } = useQuery({
    queryKey: ["adminProfile", uid],
    enabled: !!uid,
    queryFn: () => getAdminProfile(uid!),
  });

  const isSuper = !!profile?.can_access_all_branches;
  const all = useMemo(() => branches ?? [], [branches]);
  const accessible = useMemo(
    () => (isSuper ? all : all.filter((b) => b.id === profile?.home_branch_id)),
    [all, isSuper, profile?.home_branch_id],
  );

  const [activeBranchId, setActiveRaw] = useState<string>(
    () => localStorage.getItem("activeBranch") ?? "",
  );

  // Once branches + profile load, ensure the active branch is one the admin may
  // actually access; otherwise fall back to the home branch (or first allowed).
  useEffect(() => {
    if (!profile || all.length === 0) return;
    const valid =
      activeBranchId === ALL_BRANCHES ? isSuper : accessible.some((b) => b.id === activeBranchId);
    if (!valid) {
      const home = accessible.find((b) => b.id === profile.home_branch_id)?.id;
      setActiveRaw(home ?? accessible[0]?.id ?? "");
    }
  }, [profile, all, accessible, activeBranchId, isSuper]);

  const setActiveBranchId = (id: string) => {
    localStorage.setItem("activeBranch", id);
    setActiveRaw(id);
  };

  const isAll = activeBranchId === ALL_BRANCHES;
  const value: Ctx = {
    branches: all,
    accessible,
    activeBranchId,
    setActiveBranchId,
    isSuper,
    isAll,
    branchId: isAll ? null : activeBranchId || null,
  };

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>;
}
