import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useBranches, useCreateBranch, useUpdateBranch } from "./hooks";
import { BranchForm } from "./BranchForm";
import type { Branch } from "./types";

function BranchEditForm({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const update = useUpdateBranch(branch.id);
  return (
    <BranchForm
      defaultValues={branch}
      submitting={update.isPending}
      onCancel={onClose}
      onSubmit={(p) => update.mutate(p, { onSuccess: onClose })}
    />
  );
}

/** Settings section: super admins add/edit branches. */
export function BranchManager() {
  const { t } = useTranslation();
  const { data: branches } = useBranches();
  const create = useCreateBranch();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{t("settings.branches")}</h3>
          <p className="text-sm text-muted">{t("settings.branchesHint")}</p>
        </div>
        {!adding && (
          <Button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            {t("branch.add")}
          </Button>
        )}
      </div>

      {adding && (
        <BranchForm
          submitting={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setAdding(false) })}
        />
      )}

      <ul className="space-y-3">
        {(branches ?? []).map((b) =>
          editingId === b.id ? (
            <li key={b.id}>
              <BranchEditForm branch={b} onClose={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={b.id} className="card flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium text-ink">
                  {b.name}{" "}
                  {b.code && <span className="num text-muted">· {b.code}</span>}
                </div>
                <div className="text-sm text-muted">
                  {[b.phone, b.address].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {!b.is_active && (
                  <span className="badge bg-paper-2 text-muted">{t("branch.inactive")}</span>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(b.id);
                    setAdding(false);
                  }}
                >
                  {t("actions.edit")}
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
