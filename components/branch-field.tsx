type BranchOption = {
  id: string;
  code: string;
  city: string;
};

type BranchFieldProps = {
  id: string;
  label: string;
  branches: readonly BranchOption[] | null | undefined;
  selectedBranchId: string | null;
  value?: string | null;
  name?: string;
  required?: boolean;
  placeholder?: string;
};

/**
 * A branch form control that follows the operating-branch scope.
 * When a branch is selected in the shell, the visible control is locked and
 * a hidden value keeps the disabled select included in the form submission.
 */
export function BranchField({
  id,
  label,
  branches,
  selectedBranchId,
  value,
  name = "branchId",
  required = true,
  placeholder = "Select branch",
}: BranchFieldProps) {
  const locked = Boolean(selectedBranchId);
  // A selected operating branch always wins visually; otherwise preserve the
  // record's existing branch when the user is working across the network.
  const fieldValue = locked ? selectedBranchId ?? "" : value ?? "";

  return (
    <div className={`form-field branch-field${locked ? " branch-field-locked" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={fieldValue} disabled={locked} required={required && !locked}>
        {!locked ? <option value="">{placeholder}</option> : null}
        {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}
      </select>
      {locked ? <input type="hidden" name={name} value={selectedBranchId ?? ""} /> : null}
    </div>
  );
}
