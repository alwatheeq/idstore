export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          branch_id: string
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string
          end_at: string
          id: string
          notes: string | null
          organization_id: string
          promised_at: string | null
          start_at: string
          status: string
          updated_at: string
          vehicle_id: string
          version: number
        }
        Insert: {
          branch_id: string
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          end_at: string
          id?: string
          notes?: string | null
          organization_id: string
          promised_at?: string | null
          start_at: string
          status?: string
          updated_at?: string
          vehicle_id: string
          version?: number
        }
        Update: {
          branch_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          end_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          promised_at?: string | null
          start_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          branch_id: string | null
          bucket: string
          classification: string
          created_at: string
          created_by: string | null
          id: string
          linked_id: string
          linked_type: string
          mime_type: string
          object_path: string
          organization_id: string
          sha256: string
          size_bytes: number
        }
        Insert: {
          branch_id?: string | null
          bucket: string
          classification?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_id: string
          linked_type: string
          mime_type: string
          object_path: string
          organization_id: string
          sha256: string
          size_bytes: number
        }
        Update: {
          branch_id?: string | null
          bucket?: string
          classification?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_id?: string
          linked_type?: string
          mime_type?: string
          object_path?: string
          organization_id?: string
          sha256?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      battery_health_reports: {
        Row: {
          attachment_id: string | null
          branch_id: string
          conditions_json: Json
          created_at: string
          id: string
          measured_at: string
          method: string
          organization_id: string
          repair_order_id: string | null
          soh_percent: number | null
          tool: string | null
          usable_kwh: number | null
          vehicle_id: string
        }
        Insert: {
          attachment_id?: string | null
          branch_id: string
          conditions_json?: Json
          created_at?: string
          id?: string
          measured_at: string
          method: string
          organization_id: string
          repair_order_id?: string | null
          soh_percent?: number | null
          tool?: string | null
          usable_kwh?: number | null
          vehicle_id: string
        }
        Update: {
          attachment_id?: string | null
          branch_id?: string
          conditions_json?: Json
          created_at?: string
          id?: string
          measured_at?: string
          method?: string
          organization_id?: string
          repair_order_id?: string | null
          soh_percent?: number | null
          tool?: string | null
          usable_kwh?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battery_health_reports_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_health_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_health_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_health_reports_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_health_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      bins: {
        Row: {
          bin_type: string
          branch_id: string
          code: string
          created_at: string
          id: string
          organization_id: string
          status: string
          warehouse_id: string
        }
        Insert: {
          bin_type?: string
          branch_id: string
          code: string
          created_at?: string
          id?: string
          organization_id: string
          status?: string
          warehouse_id: string
        }
        Update: {
          bin_type?: string
          branch_id?: string
          code?: string
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bins_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_capabilities: {
        Row: {
          branch_id: string
          capability_code: string
          created_at: string
          evidence_path: string | null
          id: string
          organization_id: string
          status: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          branch_id: string
          capability_code: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          organization_id: string
          status?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          branch_id?: string
          capability_code?: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          organization_id?: string
          status?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_capabilities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_capabilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_service_areas: {
        Row: {
          area_name: string
          branch_id: string
          created_at: string
          id: string
          mobile_service_enabled: boolean
          organization_id: string
          pickup_enabled: boolean
          radius_km: number | null
        }
        Insert: {
          area_name: string
          branch_id: string
          created_at?: string
          id?: string
          mobile_service_enabled?: boolean
          organization_id: string
          pickup_enabled?: boolean
          radius_km?: number | null
        }
        Update: {
          area_name?: string
          branch_id?: string
          created_at?: string
          id?: string
          mobile_service_enabled?: boolean
          organization_id?: string
          pickup_enabled?: boolean
          radius_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_service_areas_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_service_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_json: Json
          admin_area: string | null
          city: string
          code: string
          country_code: string
          created_at: string
          currency: string
          display_name: string
          email: string | null
          id: string
          latitude: number | null
          legal_name: string
          longitude: number | null
          organization_id: string
          phone: string | null
          status: string
          tax_registration: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address_json?: Json
          admin_area?: string | null
          city: string
          code: string
          country_code?: string
          created_at?: string
          currency?: string
          display_name: string
          email?: string | null
          id?: string
          latitude?: number | null
          legal_name: string
          longitude?: number | null
          organization_id: string
          phone?: string | null
          status?: string
          tax_registration?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_json?: Json
          admin_area?: string | null
          city?: string
          code?: string
          country_code?: string
          created_at?: string
          currency?: string
          display_name?: string
          email?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string
          longitude?: number | null
          organization_id?: string
          phone?: string | null
          status?: string
          tax_registration?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          counted_close: number | null
          created_at: string
          expected_close: number | null
          id: string
          opened_at: string
          opening_float: number
          organization_id: string
          register_code: string
          staff_user_id: string
          status: string
          variance: number | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          counted_close?: number | null
          created_at?: string
          expected_close?: number | null
          id?: string
          opened_at?: string
          opening_float?: number
          organization_id: string
          register_code: string
          staff_user_id: string
          status?: string
          variance?: number | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          counted_close?: number | null
          created_at?: string
          expected_close?: number | null
          id?: string
          opened_at?: string
          opening_float?: number
          organization_id?: string
          register_code?: string
          staff_user_id?: string
          status?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          channel: string
          customer_id: string
          id: string
          organization_id: string
          policy_version: string
          purpose: string
          recorded_at: string
          recorded_by: string | null
          source: string
          state: string
        }
        Insert: {
          channel: string
          customer_id: string
          id?: string
          organization_id: string
          policy_version: string
          purpose: string
          recorded_at?: string
          recorded_by?: string | null
          source: string
          state: string
        }
        Update: {
          channel?: string
          customer_id?: string
          id?: string
          organization_id?: string
          policy_version?: string
          purpose?: string
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          branch_id: string
          created_at: string
          credit_note_id: string
          id: string
          invoice_line_id: string
          line_total: number
          organization_id: string
          quantity: number
          tax_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          credit_note_id: string
          id?: string
          invoice_line_id: string
          line_total: number
          organization_id: string
          quantity: number
          tax_amount?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          credit_note_id?: string
          id?: string
          invoice_line_id?: string
          line_total?: number
          organization_id?: string
          quantity?: number
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          branch_id: string
          created_at: string
          credit_number: string
          document_hash: string | null
          grand_total: number
          id: string
          invoice_id: string
          organization_id: string
          posted_at: string
          posted_by: string | null
          reason: string
          subtotal: number
          tax_total: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          credit_number: string
          document_hash?: string | null
          grand_total?: number
          id?: string
          invoice_id: string
          organization_id: string
          posted_at?: string
          posted_by?: string | null
          reason: string
          subtotal?: number
          tax_total?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          credit_number?: string
          document_hash?: string | null
          grand_total?: number
          id?: string
          invoice_id?: string
          organization_id?: string
          posted_at?: string
          posted_by?: string | null
          reason?: string
          subtotal?: number
          tax_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          auth_user_id: string
          created_at: string
          customer_id: string
          organization_id: string
          status: string
          verified_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          customer_id: string
          organization_id: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          customer_id?: string
          organization_id?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string
          admin_area: string | null
          city: string
          country_code: string
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean
          organization_id: string
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type?: string
          admin_area?: string | null
          city: string
          country_code?: string
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean
          organization_id: string
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string
          admin_area?: string | null
          city?: string
          country_code?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean
          kind: string
          normalized_value: string
          organization_id: string
          value: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean
          kind: string
          normalized_value: string
          organization_id: string
          value: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
          kind?: string
          normalized_value?: string
          organization_id?: string
          value?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          customer_type: string
          display_name: string
          id: string
          legal_name: string | null
          notes: string | null
          organization_id: string
          preferred_branch_id: string | null
          preferred_locale: string
          status: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_type?: string
          display_name: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          organization_id: string
          preferred_branch_id?: string | null
          preferred_locale?: string
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_type?: string
          display_name?: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          organization_id?: string
          preferred_branch_id?: string | null
          preferred_locale?: string
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_preferred_branch_id_fkey"
            columns: ["preferred_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_sessions: {
        Row: {
          attachment_id: string | null
          branch_id: string
          created_at: string
          ended_at: string | null
          external_ref: string | null
          id: string
          interface_serial: string | null
          organization_id: string
          repair_order_id: string
          started_at: string
          technician_id: string | null
          tool: string
          tool_version: string | null
        }
        Insert: {
          attachment_id?: string | null
          branch_id: string
          created_at?: string
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          interface_serial?: string | null
          organization_id: string
          repair_order_id: string
          started_at: string
          technician_id?: string | null
          tool: string
          tool_version?: string | null
        }
        Update: {
          attachment_id?: string | null
          branch_id?: string
          created_at?: string
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          interface_serial?: string | null
          organization_id?: string
          repair_order_id?: string
          started_at?: string
          technician_id?: string | null
          tool?: string
          tool_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_sessions_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_trouble_codes: {
        Row: {
          after_status: string | null
          before_status: string | null
          branch_id: string
          code: string
          control_unit: string
          created_at: string
          description_snapshot: string | null
          id: string
          organization_id: string
          session_id: string
        }
        Insert: {
          after_status?: string | null
          before_status?: string | null
          branch_id: string
          code: string
          control_unit: string
          created_at?: string
          description_snapshot?: string | null
          id?: string
          organization_id: string
          session_id: string
        }
        Update: {
          after_status?: string | null
          before_status?: string | null
          branch_id?: string
          code?: string
          control_unit?: string
          created_at?: string
          description_snapshot?: string | null
          id?: string
          organization_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_trouble_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_trouble_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_trouble_codes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_approvals: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          branch_id: string
          channel: string
          decided_at: string
          decision: string
          estimate_line_id: string | null
          estimate_version_id: string
          evidence_json: Json
          id: string
          organization_id: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          branch_id: string
          channel: string
          decided_at?: string
          decision: string
          estimate_line_id?: string | null
          estimate_version_id: string
          evidence_json?: Json
          id?: string
          organization_id: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          branch_id?: string
          channel?: string
          decided_at?: string
          decision?: string
          estimate_line_id?: string | null
          estimate_version_id?: string
          evidence_json?: Json
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_approvals_estimate_line_id_fkey"
            columns: ["estimate_line_id"]
            isOneToOne: false
            referencedRelation: "estimate_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_approvals_estimate_version_id_fkey"
            columns: ["estimate_version_id"]
            isOneToOne: false
            referencedRelation: "estimate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_lines: {
        Row: {
          approval_group: string | null
          branch_id: string
          created_at: string
          description_snapshot: string
          discount_amount: number
          estimate_version_id: string
          id: string
          line_no: number
          line_total: number
          line_type: string
          organization_id: string
          quantity: number
          source_id: string | null
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          approval_group?: string | null
          branch_id: string
          created_at?: string
          description_snapshot: string
          discount_amount?: number
          estimate_version_id: string
          id?: string
          line_no: number
          line_total?: number
          line_type: string
          organization_id: string
          quantity?: number
          source_id?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          approval_group?: string | null
          branch_id?: string
          created_at?: string
          description_snapshot?: string
          discount_amount?: number
          estimate_version_id?: string
          id?: string
          line_no?: number
          line_total?: number
          line_type?: string
          organization_id?: string
          quantity?: number
          source_id?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_lines_estimate_version_id_fkey"
            columns: ["estimate_version_id"]
            isOneToOne: false
            referencedRelation: "estimate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_versions: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount_total: number
          document_hash: string | null
          expires_at: string | null
          grand_total: number
          id: string
          organization_id: string
          repair_order_id: string
          sent_at: string | null
          status: string
          subtotal: number
          tax_total: number
          updated_at: string
          version_no: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          discount_total?: number
          document_hash?: string | null
          expires_at?: string | null
          grand_total?: number
          id?: string
          organization_id: string
          repair_order_id: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          version_no: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_total?: number
          document_hash?: string | null
          expires_at?: string | null
          grand_total?: number
          id?: string
          organization_id?: string
          repair_order_id?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_versions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          inspection_item_id: string
          organization_id: string
          recommended_operation_id: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          inspection_item_id: string
          organization_id: string
          recommended_operation_id?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          inspection_item_id?: string
          organization_id?: string
          recommended_operation_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_recommended_operation_id_fkey"
            columns: ["recommended_operation_id"]
            isOneToOne: false
            referencedRelation: "labor_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_lines: {
        Row: {
          branch_id: string
          destination_bin_id: string
          goods_receipt_id: string
          id: string
          lot_id: string | null
          organization_id: string
          purchase_order_line_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          branch_id: string
          destination_bin_id: string
          goods_receipt_id: string
          id?: string
          lot_id?: string | null
          organization_id: string
          purchase_order_line_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          branch_id?: string
          destination_bin_id?: string
          goods_receipt_id?: string
          id?: string
          lot_id?: string | null
          organization_id?: string
          purchase_order_line_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_destination_bin_id_fkey"
            columns: ["destination_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          organization_id: string
          purchase_order_id: string
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          supplier_document_no: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          organization_id: string
          purchase_order_id: string
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          supplier_document_no?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          purchase_order_id?: string
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          supplier_document_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      hv_permit_checks: {
        Row: {
          actor_id: string | null
          branch_id: string
          check_code: string
          id: string
          occurred_at: string
          organization_id: string
          permit_id: string
          result: string
          tool_ref: string | null
          witness_id: string | null
        }
        Insert: {
          actor_id?: string | null
          branch_id: string
          check_code: string
          id?: string
          occurred_at?: string
          organization_id: string
          permit_id: string
          result: string
          tool_ref?: string | null
          witness_id?: string | null
        }
        Update: {
          actor_id?: string | null
          branch_id?: string
          check_code?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          permit_id?: string
          result?: string
          tool_ref?: string | null
          witness_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hv_permit_checks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hv_permit_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hv_permit_checks_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "hv_work_permits"
            referencedColumns: ["id"]
          },
        ]
      }
      hv_work_permits: {
        Row: {
          authorized_by: string | null
          branch_id: string
          created_at: string
          id: string
          job_id: string
          organization_id: string
          procedure_ref: string
          repair_order_id: string
          risk_json: Json
          state: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          authorized_by?: string | null
          branch_id: string
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          procedure_ref: string
          repair_order_id: string
          risk_json?: Json
          state?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          authorized_by?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          procedure_ref?: string
          repair_order_id?: string
          risk_json?: Json
          state?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hv_work_permits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hv_work_permits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hv_work_permits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hv_work_permits_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          branch_id: string
          created_at: string
          customer_text: string | null
          finding_text: string | null
          id: string
          inspection_id: string
          measurement_json: Json
          organization_id: string
          result: string | null
          sequence: number
          template_task_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          customer_text?: string | null
          finding_text?: string | null
          id?: string
          inspection_id: string
          measurement_json?: Json
          organization_id: string
          result?: string | null
          sequence: number
          template_task_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          customer_text?: string | null
          finding_text?: string | null
          id?: string
          inspection_id?: string
          measurement_json?: Json
          organization_id?: string
          result?: string | null
          sequence?: number
          template_task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_template_task_id_fkey"
            columns: ["template_task_id"]
            isOneToOne: false
            referencedRelation: "service_template_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          branch_id: string
          completed_at: string | null
          created_at: string
          id: string
          organization_id: string
          repair_order_id: string
          started_at: string | null
          status: string
          technician_id: string | null
          template_version_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          repair_order_id: string
          started_at?: string | null
          status?: string
          technician_id?: string | null
          template_version_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          repair_order_id?: string
          started_at?: string | null
          status?: string
          technician_id?: string | null
          template_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "service_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          branch_id: string
          created_at: string
          description_snapshot: string
          discount_amount: number
          id: string
          invoice_id: string
          line_no: number
          line_total: number
          line_type: string
          organization_id: string
          quantity: number
          source_id: string | null
          source_type: string | null
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          description_snapshot: string
          discount_amount?: number
          id?: string
          invoice_id: string
          line_no: number
          line_total: number
          line_type: string
          organization_id: string
          quantity: number
          source_id?: string | null
          source_type?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          description_snapshot?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          line_no?: number
          line_total?: number
          line_type?: string
          organization_id?: string
          quantity?: number
          source_id?: string | null
          source_type?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_series: {
        Row: {
          branch_id: string
          created_at: string
          document_type: string
          fiscal_period: string
          id: string
          next_number: number
          organization_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          document_type: string
          fiscal_period: string
          id?: string
          next_number?: number
          organization_id: string
          prefix?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          document_type?: string
          fiscal_period?: string
          id?: string
          next_number?: number
          organization_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_series_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string
          buyer_snapshot: Json
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          discount_total: number
          document_hash: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoice_series_id: string | null
          organization_id: string
          paid_total: number
          posted_at: string | null
          repair_order_id: string | null
          seller_snapshot: Json
          status: string
          subtotal: number
          tax_total: number
          updated_at: string
          version: number
        }
        Insert: {
          branch_id: string
          buyer_snapshot?: Json
          created_at?: string
          created_by?: string | null
          currency: string
          customer_id: string
          discount_total?: number
          document_hash?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoice_series_id?: string | null
          organization_id: string
          paid_total?: number
          posted_at?: string | null
          repair_order_id?: string | null
          seller_snapshot?: Json
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          version?: number
        }
        Update: {
          branch_id?: string
          buyer_snapshot?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          discount_total?: number
          document_hash?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoice_series_id?: string | null
          organization_id?: string
          paid_total?: number
          posted_at?: string | null
          repair_order_id?: string | null
          seller_snapshot?: Json
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_series_id_fkey"
            columns: ["invoice_series_id"]
            isOneToOne: false
            referencedRelation: "invoice_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assignment_kind: string
          branch_id: string
          id: string
          job_id: string
          organization_id: string
          technician_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assignment_kind?: string
          branch_id: string
          id?: string
          job_id: string
          organization_id: string
          technician_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assignment_kind?: string
          branch_id?: string
          id?: string
          job_id?: string
          organization_id?: string
          technician_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          issued_quantity: number
          job_id: string
          organization_id: string
          part_id: string
          requested_quantity: number
          returned_quantity: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          issued_quantity?: number
          job_id: string
          organization_id: string
          part_id: string
          requested_quantity?: number
          returned_quantity?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          issued_quantity?: number
          job_id?: string
          organization_id?: string
          part_id?: string
          requested_quantity?: number
          returned_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          branch_id: string
          completed_at: string | null
          created_at: string
          description_snapshot: string
          estimate_line_id: string | null
          id: string
          operation_code: string | null
          organization_id: string
          planned_minutes: number
          repair_order_id: string
          required_qualification_code: string | null
          safety_class: string
          started_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          branch_id: string
          completed_at?: string | null
          created_at?: string
          description_snapshot: string
          estimate_line_id?: string | null
          id?: string
          operation_code?: string | null
          organization_id: string
          planned_minutes?: number
          repair_order_id: string
          required_qualification_code?: string | null
          safety_class?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          description_snapshot?: string
          estimate_line_id?: string | null
          id?: string
          operation_code?: string | null
          organization_id?: string
          planned_minutes?: number
          repair_order_id?: string
          required_qualification_code?: string | null
          safety_class?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_estimate_line_id_fkey"
            columns: ["estimate_line_id"]
            isOneToOne: false
            referencedRelation: "estimate_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_entries: {
        Row: {
          branch_id: string
          created_at: string
          ended_at: string | null
          id: string
          job_id: string
          organization_id: string
          pause_reason: string | null
          source: string
          started_at: string
          technician_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id: string
          organization_id: string
          pause_reason?: string | null
          source?: string
          started_at: string
          technician_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          pause_reason?: string | null
          source?: string
          started_at?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_operations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_price: number
          description_ar: string | null
          description_en: string
          id: string
          organization_id: string
          standard_minutes: number
          tax_code_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_price?: number
          description_ar?: string | null
          description_en: string
          id?: string
          organization_id: string
          standard_minutes?: number
          tax_code_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_price?: number
          description_ar?: string | null
          description_en?: string
          id?: string
          organization_id?: string
          standard_minutes?: number
          tax_code_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_operations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_operations_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_branches: {
        Row: {
          branch_id: string
          created_at: string
          membership_id: string
          organization_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          membership_id: string
          organization_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          membership_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_branches_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_permissions: {
        Row: {
          allowed: boolean
          granted_at: string
          granted_by: string | null
          limits_json: Json
          membership_id: string
          organization_id: string
          permission_code: string
        }
        Insert: {
          allowed?: boolean
          granted_at?: string
          granted_by?: string | null
          limits_json?: Json
          membership_id: string
          organization_id: string
          permission_code: string
        }
        Update: {
          allowed?: boolean
          granted_at?: string
          granted_by?: string | null
          limits_json?: Json
          membership_id?: string
          organization_id?: string
          permission_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      memberships: {
        Row: {
          all_branches: boolean
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_branches?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_branches?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          branch_id: string | null
          channel: string
          created_at: string
          customer_id: string
          dedupe_key: string
          id: string
          organization_id: string
          provider_ref: string | null
          sent_at: string | null
          status: string
          template_code: string
          template_version: number
        }
        Insert: {
          branch_id?: string | null
          channel: string
          created_at?: string
          customer_id: string
          dedupe_key: string
          id?: string
          organization_id: string
          provider_ref?: string | null
          sent_at?: string | null
          status?: string
          template_code: string
          template_version: number
        }
        Update: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string
          dedupe_key?: string
          id?: string
          organization_id?: string
          provider_ref?: string | null
          sent_at?: string | null
          status?: string
          template_code?: string
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_readings: {
        Row: {
          branch_id: string | null
          correction_reason: string | null
          id: string
          organization_id: string
          reading_km: number
          recorded_at: string
          recorded_by: string | null
          source: string
          vehicle_id: string
        }
        Insert: {
          branch_id?: string | null
          correction_reason?: string | null
          id?: string
          organization_id: string
          reading_km: number
          recorded_at?: string
          recorded_by?: string | null
          source: string
          vehicle_id: string
        }
        Update: {
          branch_id?: string | null
          correction_reason?: string | null
          id?: string
          organization_id?: string
          reading_km?: number
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odometer_readings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_readings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_currency: string
          created_at: string
          default_locale: string
          display_name: string
          id: string
          legal_name: string
          status: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          default_locale?: string
          display_name: string
          id?: string
          legal_name: string
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          default_locale?: string
          display_name?: string
          id?: string
          legal_name?: string
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      part_supersessions: {
        Row: {
          effective_at: string
          new_part_id: string
          old_part_id: string
          organization_id: string
          source: string | null
        }
        Insert: {
          effective_at: string
          new_part_id: string
          old_part_id: string
          organization_id: string
          source?: string | null
        }
        Update: {
          effective_at?: string
          new_part_id?: string
          old_part_id?: string
          organization_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_supersessions_new_part_id_fkey"
            columns: ["new_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_supersessions_old_part_id_fkey"
            columns: ["old_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_supersessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string
          hazardous_classification: string | null
          id: string
          organization_id: string
          part_number: string
          sale_price: number
          status: string
          tax_code_id: string | null
          tracking: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en: string
          hazardous_classification?: string | null
          id?: string
          organization_id: string
          part_number: string
          sale_price?: number
          status?: string
          tax_code_id?: string | null
          tracking?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string
          hazardous_classification?: string | null
          id?: string
          organization_id?: string
          part_number?: string
          sale_price?: number
          status?: string
          tax_code_id?: string | null
          tracking?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          id: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          id?: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          method: string
          organization_id: string
          provider_ref: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          currency: string
          id?: string
          idempotency_key: string
          method: string
          organization_id: string
          provider_ref?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          method?: string
          organization_id?: string
          provider_ref?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string
        }
        Insert: {
          code: string
          description: string
        }
        Update: {
          code?: string
          description?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          locale: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          locale?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          locale?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          branch_id: string
          id: string
          line_no: number
          ordered_quantity: number
          organization_id: string
          part_id: string
          purchase_order_id: string
          received_quantity: number
          tax_rate: number
          unit_cost: number
        }
        Insert: {
          branch_id: string
          id?: string
          line_no: number
          ordered_quantity: number
          organization_id: string
          part_id: string
          purchase_order_id: string
          received_quantity?: number
          tax_rate?: number
          unit_cost: number
        }
        Update: {
          branch_id?: string
          id?: string
          line_no?: number
          ordered_quantity?: number
          organization_id?: string
          part_id?: string
          purchase_order_id?: string
          received_quantity?: number
          tax_rate?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          currency: string
          grand_total: number
          id: string
          ordered_at: string | null
          organization_id: string
          po_number: string
          status: string
          subtotal: number
          supplier_id: string
          tax_total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          grand_total?: number
          id?: string
          ordered_at?: string | null
          organization_id: string
          po_number: string
          status?: string
          subtotal?: number
          supplier_id: string
          tax_total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          grand_total?: number
          id?: string
          ordered_at?: string | null
          organization_id?: string
          po_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          scope_json: Json
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          scope_json?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          scope_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_order_events: {
        Row: {
          actor_id: string | null
          branch_id: string
          from_status: string | null
          id: string
          occurred_at: string
          organization_id: string
          reason: string | null
          repair_order_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          branch_id: string
          from_status?: string | null
          id?: string
          occurred_at?: string
          organization_id: string
          reason?: string | null
          repair_order_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          branch_id?: string
          from_status?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          reason?: string | null
          repair_order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_order_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_events_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          appointment_id: string | null
          branch_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_concern: string | null
          customer_id: string
          id: string
          odometer_km: number | null
          opened_at: string
          organization_id: string
          promised_at: string | null
          risk_state: string
          ro_number: string
          state_of_charge: number | null
          status: string
          updated_at: string
          vehicle_id: string
          version: number
        }
        Insert: {
          appointment_id?: string | null
          branch_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_concern?: string | null
          customer_id: string
          id?: string
          odometer_km?: number | null
          opened_at?: string
          organization_id: string
          promised_at?: string | null
          risk_state?: string
          ro_number: string
          state_of_charge?: number | null
          status?: string
          updated_at?: string
          vehicle_id: string
          version?: number
        }
        Update: {
          appointment_id?: string | null
          branch_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_concern?: string | null
          customer_id?: string
          id?: string
          odometer_km?: number | null
          opened_at?: string
          organization_id?: string
          promised_at?: string | null
          risk_state?: string
          ro_number?: string
          state_of_charge?: number | null
          status?: string
          updated_at?: string
          vehicle_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_bookings: {
        Row: {
          appointment_id: string | null
          branch_id: string
          created_at: string
          ends_at: string
          id: string
          organization_id: string
          resource_id: string
          starts_at: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          branch_id: string
          created_at?: string
          ends_at: string
          id?: string
          organization_id: string
          resource_id: string
          starts_at: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          branch_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          organization_id?: string
          resource_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          branch_id: string
          capabilities: Json
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          resource_type: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capabilities?: Json
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          resource_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capabilities?: Json
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          resource_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_template_tasks: {
        Row: {
          description_ar: string | null
          description_en: string
          id: string
          organization_id: string | null
          procedure_ref: string | null
          required_permission: string | null
          required_qualification_code: string | null
          result_schema: Json
          sequence: number
          standard_minutes: number
          task_code: string
          version_id: string
        }
        Insert: {
          description_ar?: string | null
          description_en: string
          id?: string
          organization_id?: string | null
          procedure_ref?: string | null
          required_permission?: string | null
          required_qualification_code?: string | null
          result_schema?: Json
          sequence: number
          standard_minutes?: number
          task_code: string
          version_id: string
        }
        Update: {
          description_ar?: string | null
          description_en?: string
          id?: string
          organization_id?: string | null
          procedure_ref?: string | null
          required_permission?: string | null
          required_qualification_code?: string | null
          result_schema?: Json
          sequence?: number
          standard_minutes?: number
          task_code?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_template_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_template_tasks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "service_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_template_versions: {
        Row: {
          applicability_json: Json
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          interval_km: number | null
          interval_months: number | null
          organization_id: string | null
          source_uri: string | null
          status: string
          template_id: string
          version_no: number
        }
        Insert: {
          applicability_json?: Json
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          organization_id?: string | null
          source_uri?: string | null
          status?: string
          template_id: string
          version_no: number
        }
        Update: {
          applicability_json?: Json
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          organization_id?: string | null
          source_uri?: string | null
          status?: string
          template_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_template_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_templates: {
        Row: {
          code: string
          created_at: string
          id: string
          market: string | null
          name_ar: string | null
          name_en: string
          organization_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          market?: string | null
          name_ar?: string | null
          name_en: string
          organization_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          market?: string | null
          name_ar?: string | null
          name_en?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          average_cost: number
          bin_id: string
          branch_id: string
          id: string
          lot_id: string | null
          on_hand: number
          organization_id: string
          part_id: string
          reserved: number
          updated_at: string
          version: number
        }
        Insert: {
          average_cost?: number
          bin_id: string
          branch_id: string
          id?: string
          lot_id?: string | null
          on_hand?: number
          organization_id: string
          part_id: string
          reserved?: number
          updated_at?: string
          version?: number
        }
        Update: {
          average_cost?: number
          bin_id?: string
          branch_id?: string
          id?: string
          lot_id?: string | null
          on_hand?: number
          organization_id?: string
          part_id?: string
          reserved?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_lots: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          organization_id: string
          part_id: string
          serial_no: string | null
          supplier_lot: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id: string
          part_id: string
          serial_no?: string | null
          supplier_lot?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id?: string
          part_id?: string
          serial_no?: string | null
          supplier_lot?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string
          created_at: string
          from_bin_id: string | null
          id: string
          idempotency_key: string
          lot_id: string | null
          movement_type: string
          organization_id: string
          part_id: string
          posted_at: string
          posted_by: string | null
          quantity: number
          reversal_of: string | null
          source_id: string
          source_type: string
          to_bin_id: string | null
          unit_cost: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          idempotency_key: string
          lot_id?: string | null
          movement_type: string
          organization_id: string
          part_id: string
          posted_at?: string
          posted_by?: string | null
          quantity: number
          reversal_of?: string | null
          source_id: string
          source_type: string
          to_bin_id?: string | null
          unit_cost: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          idempotency_key?: string
          lot_id?: string | null
          movement_type?: string
          organization_id?: string
          part_id?: string
          posted_at?: string
          posted_by?: string | null
          quantity?: number
          reversal_of?: string | null
          source_id?: string
          source_type?: string
          to_bin_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          bin_id: string
          branch_id: string
          created_at: string
          expires_at: string | null
          id: string
          job_id: string
          lot_id: string | null
          organization_id: string
          part_id: string
          quantity: number
          status: string
        }
        Insert: {
          bin_id: string
          branch_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id: string
          lot_id?: string | null
          organization_id: string
          part_id: string
          quantity: number
          status?: string
        }
        Update: {
          bin_id?: string
          branch_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id?: string
          lot_id?: string | null
          organization_id?: string
          part_id?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_lines: {
        Row: {
          destination_bin_id: string | null
          discrepancy_reason: string | null
          id: string
          lot_id: string | null
          organization_id: string
          part_id: string
          received_quantity: number
          requested_quantity: number
          shipped_quantity: number
          source_bin_id: string | null
          transfer_id: string
        }
        Insert: {
          destination_bin_id?: string | null
          discrepancy_reason?: string | null
          id?: string
          lot_id?: string | null
          organization_id: string
          part_id: string
          received_quantity?: number
          requested_quantity: number
          shipped_quantity?: number
          source_bin_id?: string | null
          transfer_id: string
        }
        Update: {
          destination_bin_id?: string | null
          discrepancy_reason?: string | null
          id?: string
          lot_id?: string | null
          organization_id?: string
          part_id?: string
          received_quantity?: number
          requested_quantity?: number
          shipped_quantity?: number
          source_bin_id?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_lines_destination_bin_id_fkey"
            columns: ["destination_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_source_bin_id_fkey"
            columns: ["source_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          destination_branch_id: string
          dispatched_at: string | null
          id: string
          organization_id: string
          received_at: string | null
          source_branch_id: string
          status: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_branch_id: string
          dispatched_at?: string | null
          id?: string
          organization_id: string
          received_at?: string | null
          source_branch_id: string
          status?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_branch_id?: string
          dispatched_at?: string | null
          id?: string
          organization_id?: string
          received_at?: string | null
          source_branch_id?: string
          status?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_parts: {
        Row: {
          currency: string | null
          last_cost: number | null
          lead_days: number | null
          organization_id: string
          part_id: string
          supplier_id: string
          supplier_sku: string | null
        }
        Insert: {
          currency?: string | null
          last_cost?: number | null
          lead_days?: number | null
          organization_id: string
          part_id: string
          supplier_id: string
          supplier_sku?: string | null
        }
        Update: {
          currency?: string | null
          last_cost?: number | null
          lead_days?: number | null
          organization_id?: string
          part_id?: string
          supplier_id?: string
          supplier_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          status: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_codes: {
        Row: {
          code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          external_code: string | null
          id: string
          jurisdiction: string
          organization_id: string
          rate: number
        }
        Insert: {
          code: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          external_code?: string | null
          id?: string
          jurisdiction: string
          organization_id: string
          rate: number
        }
        Update: {
          code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          external_code?: string | null
          id?: string
          jurisdiction?: string
          organization_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_profiles: {
        Row: {
          active: boolean
          created_at: string
          employee_no: string | null
          id: string
          labor_grade: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_no?: string | null
          id?: string
          labor_grade?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_no?: string | null
          id?: string
          labor_grade?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_qualifications: {
        Row: {
          certificate_reference: string | null
          created_at: string
          evidence_attachment_id: string | null
          id: string
          issuer: string
          organization_id: string
          qualification_type_id: string
          technician_id: string
          valid_from: string
          valid_to: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          certificate_reference?: string | null
          created_at?: string
          evidence_attachment_id?: string | null
          id?: string
          issuer: string
          organization_id: string
          qualification_type_id: string
          technician_id: string
          valid_from: string
          valid_to?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          certificate_reference?: string | null
          created_at?: string
          evidence_attachment_id?: string | null
          id?: string
          issuer?: string
          organization_id?: string
          qualification_type_id?: string
          technician_id?: string
          valid_from?: string
          valid_to?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_qualifications_evidence_attachment_id_fkey"
            columns: ["evidence_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_qualifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_qualifications_qualification_type_id_fkey"
            columns: ["qualification_type_id"]
            isOneToOne: false
            referencedRelation: "qualification_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_qualifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_models: {
        Row: {
          created_at: string
          id: string
          make: string
          market: string | null
          model_code: string
          name: string
          organization_id: string | null
          platform: string | null
          valid_year_from: number | null
          valid_year_to: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          make?: string
          market?: string | null
          model_code: string
          name: string
          organization_id?: string | null
          platform?: string | null
          valid_year_from?: number | null
          valid_year_to?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          make?: string
          market?: string | null
          model_code?: string
          name?: string
          organization_id?: string | null
          platform?: string | null
          valid_year_from?: number | null
          valid_year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_ownerships: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          relationship: string
          valid_from: string
          valid_to: string | null
          vehicle_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          relationship?: string
          valid_from?: string
          valid_to?: string | null
          vehicle_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          relationship?: string
          valid_from?: string
          valid_to?: string | null
          vehicle_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_ownerships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_ownerships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_ownerships_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_recommendations: {
        Row: {
          branch_id: string
          created_at: string
          description: string
          due_date: string | null
          due_odometer_km: number | null
          finding_id: string | null
          id: string
          organization_id: string
          severity: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          description: string
          due_date?: string | null
          due_odometer_km?: number | null
          finding_id?: string | null
          id?: string
          organization_id: string
          severity: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          due_odometer_km?: number | null
          finding_id?: string | null
          id?: string
          organization_id?: string
          severity?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_recommendations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_recommendations_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_recommendations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          battery_code: string | null
          battery_kwh: number | null
          created_at: string
          id: string
          model_id: string | null
          model_year: number | null
          organization_id: string
          registration_country: string | null
          registration_no: string | null
          software_version: string | null
          status: string
          trim: string | null
          updated_at: string
          vin: string | null
        }
        Insert: {
          battery_code?: string | null
          battery_kwh?: number | null
          created_at?: string
          id?: string
          model_id?: string | null
          model_year?: number | null
          organization_id: string
          registration_country?: string | null
          registration_no?: string | null
          software_version?: string | null
          status?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
        }
        Update: {
          battery_code?: string | null
          battery_kwh?: number | null
          created_at?: string
          id?: string
          model_id?: string | null
          model_year?: number | null
          organization_id?: string
          registration_country?: string | null
          registration_no?: string | null
          software_version?: string | null
          status?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
          valuation_method: string
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: string
          valuation_method?: string
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          valuation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_job: {
        Args: {
          p_assignment_kind: string
          p_expected_version: number
          p_job_id: string
          p_technician_id: string
        }
        Returns: {
          assigned_at: string
          assignment_kind: string
          branch_id: string
          id: string
          job_id: string
          organization_id: string
          technician_id: string
          unassigned_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_appointment: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_end_at: string
          p_notes: string | null
          p_organization_id: string
          p_promised_at: string | null
          p_start_at: string
          p_vehicle_id: string
        }
        Returns: string
      }
      create_branch: {
        Args: {
          p_address_line1?: string
          p_city: string
          p_code: string
          p_display_name: string
          p_email?: string
          p_hv_capable?: boolean
          p_legal_name: string
          p_organization_id: string
          p_phone?: string
          p_tax_registration?: string
        }
        Returns: {
          address_json: Json
          admin_area: string | null
          city: string
          code: string
          country_code: string
          created_at: string
          currency: string
          display_name: string
          email: string | null
          id: string
          latitude: number | null
          legal_name: string
          longitude: number | null
          organization_id: string
          phone: string | null
          status: string
          tax_registration: string | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_customer: {
        Args: {
          p_address_line1?: string
          p_city?: string
          p_customer_type: string
          p_display_name: string
          p_email?: string
          p_mobile?: string
          p_notes?: string
          p_organization_id: string
          p_preferred_branch_id: string
          p_tax_number?: string
        }
        Returns: {
          created_at: string
          customer_type: string
          display_name: string
          id: string
          legal_name: string | null
          notes: string | null
          organization_id: string
          preferred_branch_id: string | null
          preferred_locale: string
          status: string
          tax_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_job: {
        Args: {
          p_description: string
          p_operation_code: string
          p_planned_minutes: number
          p_repair_order_id: string
          p_required_qualification_code: string
          p_safety_class: string
        }
        Returns: {
          branch_id: string
          completed_at: string | null
          created_at: string
          description_snapshot: string
          estimate_line_id: string | null
          id: string
          operation_code: string | null
          organization_id: string
          planned_minutes: number
          repair_order_id: string
          required_qualification_code: string | null
          safety_class: string
          started_at: string | null
          status: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_part: {
        Args: {
          p_branch_id: string
          p_description_en: string
          p_organization_id: string
          p_part_number: string
          p_sale_price: number
          p_tracking: string
          p_unit: string
        }
        Returns: {
          created_at: string
          description_ar: string | null
          description_en: string
          hazardous_classification: string | null
          id: string
          organization_id: string
          part_number: string
          sale_price: number
          status: string
          tax_code_id: string | null
          tracking: string
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_repair_order: {
        Args: {
          p_appointment_id?: string
          p_branch_id: string
          p_customer_concern?: string
          p_customer_id: string
          p_odometer_km?: number
          p_organization_id: string
          p_promised_at?: string
          p_state_of_charge?: number
          p_vehicle_id: string
        }
        Returns: {
          appointment_id: string | null
          branch_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_concern: string | null
          customer_id: string
          id: string
          odometer_km: number | null
          opened_at: string
          organization_id: string
          promised_at: string | null
          risk_state: string
          ro_number: string
          state_of_charge: number | null
          status: string
          updated_at: string
          vehicle_id: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vehicle: {
        Args: {
          p_battery_kwh?: number
          p_branch_id: string
          p_customer_id: string
          p_model_id: string
          p_model_year?: number
          p_odometer_km?: number
          p_organization_id: string
          p_registration_no: string
          p_trim?: string
          p_vin: string
        }
        Returns: {
          battery_code: string | null
          battery_kwh: number | null
          created_at: string
          id: string
          model_id: string | null
          model_year: number | null
          organization_id: string
          registration_country: string | null
          registration_no: string | null
          software_version: string | null
          status: string
          trim: string | null
          updated_at: string
          vin: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_job: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_note: string
          p_outcome: string
        }
        Returns: {
          branch_id: string
          completed_at: string | null
          created_at: string
          description_snapshot: string
          estimate_line_id: string | null
          id: string
          operation_code: string | null
          organization_id: string
          planned_minutes: number
          repair_order_id: string
          required_qualification_code: string | null
          safety_class: string
          started_at: string | null
          status: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_invoice: {
        Args: { p_expected_version: number; p_invoice_id: string }
        Returns: {
          branch_id: string
          buyer_snapshot: Json
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          discount_total: number
          document_hash: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoice_series_id: string | null
          organization_id: string
          paid_total: number
          posted_at: string | null
          repair_order_id: string | null
          seller_snapshot: Json
          status: string
          subtotal: number
          tax_total: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_stock_movement: {
        Args: {
          p_branch_id: string
          p_from_bin_id: string | null
          p_idempotency_key: string
          p_lot_id: string | null
          p_movement_type: string
          p_organization_id: string
          p_part_id: string
          p_quantity: number
          p_source_id: string
          p_source_type: string
          p_to_bin_id: string | null
          p_unit_cost: number
        }
        Returns: {
          branch_id: string
          created_at: string
          from_bin_id: string | null
          id: string
          idempotency_key: string
          lot_id: string | null
          movement_type: string
          organization_id: string
          part_id: string
          posted_at: string
          posted_by: string | null
          quantity: number
          reversal_of: string | null
          source_id: string
          source_type: string
          to_bin_id: string | null
          unit_cost: number
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provision_staff_access: {
        Args: {
          p_branch_ids: string[]
          p_display_name: string
          p_employee_no: string | null
          p_is_technician: boolean
          p_labor_grade: string | null
          p_mobile: string
          p_organization_id: string
          p_permission_codes: string[]
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: string
      }
      receive_invoice_payment: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_invoice_id: string
          p_method: string
          p_provider_ref: string
        }
        Returns: {
          amount: number
          branch_id: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          method: string
          organization_id: string
          provider_ref: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_job: {
        Args: { p_expected_version: number; p_job_id: string }
        Returns: {
          branch_id: string
          completed_at: string | null
          created_at: string
          description_snapshot: string
          estimate_line_id: string | null
          id: string
          operation_code: string | null
          organization_id: string
          planned_minutes: number
          repair_order_id: string
          required_qualification_code: string | null
          safety_class: string
          started_at: string | null
          status: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_appointment: {
        Args: {
          p_appointment_id: string
          p_expected_version: number
          p_to_status: string
        }
        Returns: {
          branch_id: string
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string
          end_at: string
          id: string
          notes: string | null
          organization_id: string
          promised_at: string | null
          start_at: string
          status: string
          updated_at: string
          vehicle_id: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_repair_order: {
        Args: {
          p_expected_version: number
          p_reason?: string
          p_repair_order_id: string
          p_to_status: string
        }
        Returns: {
          appointment_id: string | null
          branch_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_concern: string | null
          customer_id: string
          id: string
          odometer_km: number | null
          opened_at: string
          organization_id: string
          promised_at: string | null
          risk_state: string
          ro_number: string
          state_of_charge: number | null
          status: string
          updated_at: string
          vehicle_id: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
