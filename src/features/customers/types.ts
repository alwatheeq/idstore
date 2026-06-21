export interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  branch_id: string;
  customer_id: string;
  vin: string | null;
  plate_number: string | null;
  model: string | null;
  model_year: number | null;
  color: string | null;
  current_odometer: number | null;
  hv_battery_state: string | null;
  software_version: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
