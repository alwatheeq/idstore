export type Branch = {
  id: string;
  code: string;
  displayName: string;
  city: string;
  activeJobs: number;
  utilization: number;
  hvCapable: boolean;
};

export type WorkOrder = {
  id: string;
  number: string;
  customer: string;
  vehicle: string;
  registration: string;
  advisor: string;
  status: "diagnosis" | "awaiting_approval" | "in_progress" | "qc" | "ready";
  promise: string;
  risk: "normal" | "restricted" | "quarantine";
  progress: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
  vehicles: number;
  lastVisit: string;
  value: string;
};

export type Vehicle = {
  id: string;
  vin: string;
  model: string;
  registration: string;
  customer: string;
  mileage: string;
  soh: number;
  nextService: string;
  branch: string;
};

export type InventoryItem = {
  id: string;
  partNumber: string;
  description: string;
  branch: string;
  onHand: number;
  reserved: number;
  reorderAt: number;
  value: string;
};

export type Invoice = {
  id: string;
  number: string;
  customer: string;
  branch: string;
  date: string;
  amount: string;
  status: "paid" | "partially_paid" | "posted" | "draft";
  eInvoice: "accepted" | "queued" | "rejected" | "not_submitted";
};
