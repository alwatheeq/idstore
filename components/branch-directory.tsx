import { ResponsiveTable } from "@/components/responsive-table";
import { StatusPill } from "@/components/status-pill";

type DirectoryBranch = {
  id: string;
  code: string;
  displayName: string;
  legalName: string;
  address: string;
  warehouse: string;
  phone: string | null;
  whatsapp: string | null;
  status: string;
};

/** Each branch keeps its labels and values together at every screen width. */
export function BranchDirectory({ branches }: { branches: DirectoryBranch[] }) {
  return <div className="data-scroll branch-directory-table"><ResponsiveTable>
    <thead><tr><th>Branch</th><th>Address</th><th>Warehouse</th><th>Phone</th><th>WhatsApp</th><th>Status</th></tr></thead>
    <tbody>{branches.map(branch => <tr key={branch.id}>
      <td><strong>{branch.displayName}</strong><div className="cell-sub"><bdi>{branch.code}</bdi> · {branch.legalName}</div></td>
      <td>{branch.address || "Required"}</td><td>{branch.warehouse || "Not configured"}</td>
      <td>{branch.phone ? <bdi dir="ltr">{branch.phone}</bdi> : "Required"}</td>
      <td>{branch.whatsapp ? <bdi dir="ltr">{branch.whatsapp}</bdi> : "Required"}</td>
      <td><StatusPill label={branch.status} tone={branch.status === "active" ? "green" : "gray"} /></td>
    </tr>)}</tbody>
  </ResponsiveTable></div>;
}
