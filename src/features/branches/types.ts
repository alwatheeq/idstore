export interface Branch {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminProfile {
  home_branch_id: string | null;
  can_access_all_branches: boolean;
}
