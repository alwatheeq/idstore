import type { Branch, Customer, InventoryItem, Invoice, Vehicle, WorkOrder } from "@/lib/types";

export const branches: Branch[] = [
  { id: "amman", code: "AMM-01", displayName: "Amman Service Hub", city: "Amman", activeJobs: 18, utilization: 78, hvCapable: true },
  { id: "irbid", code: "IRB-01", displayName: "Irbid Service Point", city: "Irbid", activeJobs: 9, utilization: 61, hvCapable: false },
  { id: "aqaba", code: "AQB-01", displayName: "Aqaba EV Center", city: "Aqaba", activeJobs: 7, utilization: 54, hvCapable: true },
];

export const workOrders: WorkOrder[] = [
  { id: "1", number: "RO-24091", customer: "Lina Haddad", vehicle: "ID.4 Pro", registration: "41-88219", advisor: "Rami", status: "diagnosis", promise: "10:30", risk: "normal", progress: 18 },
  { id: "2", number: "RO-24088", customer: "Yousef Nasser", vehicle: "ID.3 Pure", registration: "38-11402", advisor: "Dana", status: "awaiting_approval", promise: "11:15", risk: "normal", progress: 32 },
  { id: "3", number: "RO-24084", customer: "Maha Logistics", vehicle: "ID. Buzz Cargo", registration: "62-73011", advisor: "Rami", status: "in_progress", promise: "13:00", risk: "restricted", progress: 64 },
  { id: "4", number: "RO-24077", customer: "Omar Qasem", vehicle: "ID.5 GTX", registration: "50-90217", advisor: "Dana", status: "qc", promise: "14:30", risk: "normal", progress: 88 },
  { id: "5", number: "RO-24069", customer: "Sama Mobility", vehicle: "ID.7 Pro S", registration: "70-11029", advisor: "Fadi", status: "ready", promise: "15:00", risk: "normal", progress: 100 },
  { id: "6", number: "RO-24093", customer: "Tareq Saadi", vehicle: "ID.4 GTX", registration: "44-31992", advisor: "Fadi", status: "in_progress", promise: "16:30", risk: "quarantine", progress: 42 },
];

export const customers: Customer[] = [
  { id: "c1", name: "Lina Haddad", phone: "+962 7 9012 4471", city: "Amman", vehicles: 1, lastVisit: "Today", value: "JOD 1,284" },
  { id: "c2", name: "Maha Logistics", phone: "+962 6 554 8180", city: "Amman", vehicles: 12, lastVisit: "Today", value: "JOD 18,740" },
  { id: "c3", name: "Yousef Nasser", phone: "+962 7 7731 0224", city: "Irbid", vehicles: 2, lastVisit: "2 Sep", value: "JOD 924" },
  { id: "c4", name: "Sama Mobility", phone: "+962 3 209 1170", city: "Aqaba", vehicles: 8, lastVisit: "1 Sep", value: "JOD 11,360" },
  { id: "c5", name: "Omar Qasem", phone: "+962 7 9550 3818", city: "Zarqa", vehicles: 1, lastVisit: "29 Aug", value: "JOD 486" },
];

export const vehicles: Vehicle[] = [
  { id: "v1", vin: "WVWZZZE1ZNP012418", model: "ID.4 Pro", registration: "41-88219", customer: "Lina Haddad", mileage: "44,210 km", soh: 94, nextService: "12 Mar 2027", branch: "Amman" },
  { id: "v2", vin: "WVWZZZE2ZPP038211", model: "ID.3 Pure", registration: "38-11402", customer: "Yousef Nasser", mileage: "62,840 km", soh: 89, nextService: "Today", branch: "Irbid" },
  { id: "v3", vin: "WVGZZZEBZRH004972", model: "ID. Buzz Cargo", registration: "62-73011", customer: "Maha Logistics", mileage: "81,204 km", soh: 86, nextService: "18 Dec 2026", branch: "Amman" },
  { id: "v4", vin: "WVWZZZE2ZRP006128", model: "ID.5 GTX", registration: "50-90217", customer: "Omar Qasem", mileage: "29,670 km", soh: 97, nextService: "4 Apr 2027", branch: "Amman" },
  { id: "v5", vin: "WVWZZZEDZSP001741", model: "ID.7 Pro S", registration: "70-11029", customer: "Sama Mobility", mileage: "18,920 km", soh: 98, nextService: "21 Jul 2027", branch: "Aqaba" },
];

export const inventory: InventoryItem[] = [
  { id: "p1", partNumber: "1EA 819 653", description: "Pollen filter, activated carbon", branch: "Amman", onHand: 14, reserved: 5, reorderAt: 8, value: "JOD 322.000" },
  { id: "p2", partNumber: "1EA 698 451 A", description: "Rear brake pad set", branch: "Amman", onHand: 4, reserved: 3, reorderAt: 4, value: "JOD 516.000" },
  { id: "p3", partNumber: "000 096 311 T", description: "Brake fluid DOT 4", branch: "Irbid", onHand: 22, reserved: 4, reorderAt: 10, value: "JOD 198.000" },
  { id: "p4", partNumber: "1EA 915 181", description: "12V auxiliary battery", branch: "Aqaba", onHand: 2, reserved: 1, reorderAt: 3, value: "JOD 284.000" },
  { id: "p5", partNumber: "N 106 663 02", description: "Underbody fastener set", branch: "Amman", onHand: 3, reserved: 3, reorderAt: 12, value: "JOD 12.750" },
];

export const invoices: Invoice[] = [
  { id: "i1", number: "AMM-INV-02684", customer: "Lina Haddad", branch: "Amman", date: "Today, 09:12", amount: "JOD 186.400", status: "paid", eInvoice: "accepted" },
  { id: "i2", number: "AMM-INV-02683", customer: "Maha Logistics", branch: "Amman", date: "Today, 08:48", amount: "JOD 742.250", status: "partially_paid", eInvoice: "accepted" },
  { id: "i3", number: "IRB-INV-01142", customer: "Yousef Nasser", branch: "Irbid", date: "3 Sep", amount: "JOD 94.700", status: "posted", eInvoice: "queued" },
  { id: "i4", number: "AQB-INV-00781", customer: "Sama Mobility", branch: "Aqaba", date: "3 Sep", amount: "JOD 1,224.000", status: "paid", eInvoice: "accepted" },
  { id: "i5", number: "AMM-INV-02679", customer: "Omar Qasem", branch: "Amman", date: "2 Sep", amount: "JOD 318.900", status: "draft", eInvoice: "not_submitted" },
];
