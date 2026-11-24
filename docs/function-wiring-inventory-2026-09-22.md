# Server Action wiring inventory — 22 September 2026

Companion to [the workflow audit](./code-workflow-audit-2026-09-22.md). Covers every exported async function in application modules marked `use server`. References are static application references, not proof of runtime invocation or database deployment. Conditional behavior and defects are described in the audit; a named RPC definition existing is not certification of its semantics. Helpers, React components and SQL functions are not each independently unit-tested by this inventory.

## app/(app)/appointments/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createAppointment](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:9) | `create_catalog_appointments` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |
| [transitionAppointment](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:67) | `transition_appointment` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |
| [openWorkOrderFromCheckin](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:93) | `open_repair_order_from_checkin` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |
| [createWaitlistEntry](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:114) | `create_waitlist_entry` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |
| [transitionWaitlistEntry](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:152) | `transition_waitlist_entry` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |
| [completeVehicleCheckin](/Volumes/PRO-G40/idstore/app/(app)/appointments/actions.ts:176) | `complete_vehicle_checkin` | [app/(app)/appointments/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/appointments/page.tsx) |

## app/(app)/branches/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createBranch](/Volumes/PRO-G40/idstore/app/(app)/branches/actions.ts:11) | `create_branch` | [app/(app)/branches/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/branches/page.tsx) |
| [updateBranchContacts](/Volumes/PRO-G40/idstore/app/(app)/branches/actions.ts:55) | `update_branch_contacts` | [app/(app)/branches/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/branches/page.tsx) |

## app/(app)/catalog/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [retireService](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:12) | `retire_catalog_service` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [createSimpleService](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:26) | `save_workshop_service` | [components/simple-service-form.tsx](/Volumes/PRO-G40/idstore/components/simple-service-form.tsx) |
| [createServiceTemplate](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:47) | `create_service_template` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [addServiceTask](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:74) | `add_service_template_task` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [publishServiceTemplate](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:109) | `publish_service_template_version` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [createResource](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:124) | `create_resource` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [bookAppointmentResource](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:147) | `book_appointment_resource` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [upsertOperatingHour](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:163) | `upsert_branch_operating_hour` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |
| [upsertBranchHoliday](/Volumes/PRO-G40/idstore/app/(app)/catalog/actions.ts:188) | `upsert_branch_holiday` | [app/(app)/catalog/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/catalog/page.tsx) |

## app/(app)/customers/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createCustomer](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:10) | `find_customer_duplicates`, `create_customer`, `optional provision-customer Edge Function` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |
| [provisionCustomerPortal](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:105) | `Edge Function: provision-customer → provision_customer_portal` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |
| [addCustomerContact](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:121) | `find_customer_duplicates`, `add_customer_contact` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |
| [recordCustomerConsent](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:149) | `record_customer_consent` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |
| [addCustomerAddress](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:156) | `add_customer_address` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |
| [transitionCustomerStatus](/Volumes/PRO-G40/idstore/app/(app)/customers/actions.ts:187) | `transition_customer_status` | [app/(app)/customers/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/customers/page.tsx) |

## app/(app)/estimates/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createEstimate](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:15) | `create_estimate_from_repair_order` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [addEstimateLine](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:32) | `add_estimate_line` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [removeEstimateLine](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:61) | `remove_estimate_line` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [sendEstimate](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:77) | `send_estimate` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [recordEstimateDecision](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:93) | `record_estimate_decision` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [recordEstimateGroupDecision](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:116) | `record_estimate_group_decision` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [createSupplementaryEstimate](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:137) | `create_supplementary_estimate` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |
| [approvePriceOverride](/Volumes/PRO-G40/idstore/app/(app)/estimates/actions.ts:155) | `approve_estimate_price_override` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx) |

## app/(app)/finance-control/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [postCreditNote](/Volumes/PRO-G40/idstore/app/(app)/finance-control/actions.ts:13) | `post_credit_note` | [app/(app)/finance-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/finance-control/page.tsx) |
| [recordRefund](/Volumes/PRO-G40/idstore/app/(app)/finance-control/actions.ts:20) | `record_payment_refund` | [app/(app)/finance-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/finance-control/page.tsx) |
| [openCashSession](/Volumes/PRO-G40/idstore/app/(app)/finance-control/actions.ts:27) | `open_cash_session` | [app/(app)/finance-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/finance-control/page.tsx) |
| [closeCashSession](/Volumes/PRO-G40/idstore/app/(app)/finance-control/actions.ts:34) | `close_cash_session` | [app/(app)/finance-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/finance-control/page.tsx) |
| [approveCashSession](/Volumes/PRO-G40/idstore/app/(app)/finance-control/actions.ts:41) | `approve_cash_session` | [app/(app)/finance-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/finance-control/page.tsx) |

## app/(app)/inspections/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [cancelInspection](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:10) | `cancel_inspection_record` | [app/(app)/inspections/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inspections/page.tsx) |
| [selectInspectionServices](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:24) | `select_inspection_services` | [components/inspection-services-form.tsx](/Volumes/PRO-G40/idstore/components/inspection-services-form.tsx) |
| [saveInspectionWorkflow](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:39) | `configure_inspection_check`, `inspection_workflow` | [app/(app)/inspections/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inspections/page.tsx) |
| [createInspection](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:79) | `create_inspection` | [app/(app)/inspections/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inspections/page.tsx) |
| [addInspectionItem](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:96) | `add_inspection_item` | No application reference found; legacy/unwired export |
| [addInspectionCatalogItems](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:121) | `add_inspection_catalog_items` | [components/inspection-check-matrix.tsx](/Volumes/PRO-G40/idstore/components/inspection-check-matrix.tsx) |
| [createInspectionCheckDefinition](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:143) | `create_inspection_check_definition` | No application reference found; legacy/unwired export |
| [removeInspectionItem](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:174) | `remove_inspection_item` | No application reference found; legacy/unwired export |
| [completeInspection](/Volumes/PRO-G40/idstore/app/(app)/inspections/actions.ts:190) | `complete_inspection` | No application reference found; legacy/unwired export |

## app/(app)/inventory/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createPart](/Volumes/PRO-G40/idstore/app/(app)/inventory/actions.ts:10) | `create_part` | [app/(app)/inventory/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inventory/page.tsx) |
| [postInventoryMovement](/Volumes/PRO-G40/idstore/app/(app)/inventory/actions.ts:43) | `post_stock_movement` | [app/(app)/inventory/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inventory/page.tsx) |
| [configurePartCatalog](/Volumes/PRO-G40/idstore/app/(app)/inventory/actions.ts:108) | `configure_part_catalog` | [app/(app)/inventory/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inventory/page.tsx) |
| [recordInventoryDisposition](/Volumes/PRO-G40/idstore/app/(app)/inventory/actions.ts:135) | `record_inventory_disposition` | [app/(app)/inventory/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/inventory/page.tsx) |

## app/(app)/invoices/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createInvoice](/Volumes/PRO-G40/idstore/app/(app)/invoices/actions.ts:12) | `create_invoice_from_repair_order` | [app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |
| [addInvoiceLine](/Volumes/PRO-G40/idstore/app/(app)/invoices/actions.ts:29) | `add_invoice_line` | [app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |
| [removeInvoiceLine](/Volumes/PRO-G40/idstore/app/(app)/invoices/actions.ts:68) | `remove_invoice_line` | [app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |
| [postInvoice](/Volumes/PRO-G40/idstore/app/(app)/invoices/actions.ts:91) | `post_invoice` | [app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |
| [receivePayment](/Volumes/PRO-G40/idstore/app/(app)/invoices/actions.ts:112) | `receive_invoice_payment` | [app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |

## app/(app)/purchasing/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createSupplier](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:22) | `create_supplier` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |
| [createPurchaseOrder](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:45) | `create_purchase_order` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |
| [addPurchaseOrderLine](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:75) | `add_purchase_order_line` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |
| [transitionPurchaseOrder](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:102) | `transition_purchase_order` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |
| [receivePurchaseOrderLine](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:125) | `receive_purchase_order_line` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |
| [recordSupplierInvoice](/Volumes/PRO-G40/idstore/app/(app)/purchasing/actions.ts:157) | `record_supplier_invoice` | [app/(app)/purchasing/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/purchasing/page.tsx) |

## app/(app)/quality-campaigns/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [recordQualityCheck](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/actions.ts:9) | `record_quality_check` | [app/(app)/quality-campaigns/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/page.tsx) |
| [createCampaign](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/actions.ts:10) | `create_service_campaign` | [app/(app)/quality-campaigns/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/page.tsx) |
| [transitionCampaign](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/actions.ts:11) | `transition_service_campaign` | [app/(app)/quality-campaigns/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/page.tsx) |
| [matchVehicle](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/actions.ts:12) | `match_vehicle_campaign` | [app/(app)/quality-campaigns/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/page.tsx) |
| [transitionMatch](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/actions.ts:13) | `transition_campaign_vehicle_match` | [app/(app)/quality-campaigns/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/quality-campaigns/page.tsx) |

## app/(app)/records/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [uploadEvidence](/Volumes/PRO-G40/idstore/app/(app)/records/actions.ts:31) | `register_attachment` | [app/(app)/records/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/records/page.tsx) |
| [queueCustomerMessage](/Volumes/PRO-G40/idstore/app/(app)/records/actions.ts:98) | `queue_customer_message` | [app/(app)/records/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/records/page.tsx) |

## app/(app)/records/manage/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [discardDraft](/Volumes/PRO-G40/idstore/app/(app)/records/manage/actions.ts:11) | `discard_draft_document` | [app/(app)/estimates/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/estimates/page.tsx)<br>[app/(app)/invoices/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/invoices/page.tsx) |
| [manageRecord](/Volumes/PRO-G40/idstore/app/(app)/records/manage/actions.ts:28) | `manage_directory_record` | [app/(app)/records/manage/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/records/manage/page.tsx) |

## app/(app)/settings/access/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [updateMembershipAccess](/Volumes/PRO-G40/idstore/app/(app)/settings/access/actions.ts:13) | `update_membership_access` | [app/(app)/settings/access/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/settings/access/page.tsx) |

## app/(app)/staff/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [manageStaff](/Volumes/PRO-G40/idstore/app/(app)/staff/actions.ts:10) | `manage_staff` | [components/staff-editor.tsx](/Volumes/PRO-G40/idstore/components/staff-editor.tsx) |
| [provisionStaff](/Volumes/PRO-G40/idstore/app/(app)/staff/actions.ts:45) | `Edge Function: provision-staff → provision_staff_access` | [app/(app)/staff/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/staff/page.tsx) |

## app/(app)/stock-control/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createStockTransfer](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:14) | `create_stock_transfer` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [addStockTransferLine](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:23) | `add_stock_transfer_line` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [transitionStockTransfer](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:34) | `transition_stock_transfer` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [receiveStockTransferLine](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:42) | `receive_stock_transfer_line` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [createStockCount](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:50) | `create_stock_count` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [recordStockCountLine](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:58) | `record_stock_count_line` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |
| [postStockCount](/Volumes/PRO-G40/idstore/app/(app)/stock-control/actions.ts:66) | `post_stock_count` | [app/(app)/stock-control/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/stock-control/page.tsx) |

## app/(app)/vehicles/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createVehicle](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:15) | `create_vehicle` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [completeVehicleIdentity](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:61) | `complete_vehicle_identity` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [createRecommendation](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:81) | `create_vehicle_recommendation` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [transitionRecommendation](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:98) | `transition_vehicle_recommendation` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [updateVehicleProfile](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:107) | `update_vehicle_service_profile` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [addVehicleOwnership](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:134) | `add_vehicle_ownership` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [endVehicleOwnership](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:163) | `end_vehicle_ownership` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |
| [recordOdometerReading](/Volumes/PRO-G40/idstore/app/(app)/vehicles/actions.ts:183) | `record_odometer_reading` | [app/(app)/vehicles/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/vehicles/page.tsx) |

## app/(app)/vehicles/followup-actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [rescheduleFollowup](/Volumes/PRO-G40/idstore/app/(app)/vehicles/followup-actions.ts:7) | `reschedule_vehicle_followup` | [components/followup-list.tsx](/Volumes/PRO-G40/idstore/components/followup-list.tsx) |

## app/(app)/work-orders/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [createWorkOrder](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:11) | `createRepairOrder → create_workshop_order` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [transitionWorkOrder](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:81) | `transition_repair_order` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [createJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:107) | `create_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [assignJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:135) | `assign_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [startJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:159) | `start_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [finishJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:175) | `finish_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [recordJobNarrative](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:199) | `record_job_narrative` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [interruptJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:216) | `interrupt_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [resumeJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:234) | `resume_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |
| [createReworkJob](/Volumes/PRO-G40/idstore/app/(app)/work-orders/actions.ts:250) | `create_rework_job` | [app/(app)/work-orders/page.tsx](/Volumes/PRO-G40/idstore/app/(app)/work-orders/page.tsx) |

## app/(app)/work-orders/item-actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [prepareOrderItems](/Volumes/PRO-G40/idstore/app/(app)/work-orders/item-actions.ts:21) | `create_estimate_from_repair_order` | [components/maintenance-order-items.tsx](/Volumes/PRO-G40/idstore/components/maintenance-order-items.tsx) |
| [addOrderItem](/Volumes/PRO-G40/idstore/app/(app)/work-orders/item-actions.ts:33) | `add_invoice_line`, `add_estimate_line` | [components/order-item-form.tsx](/Volumes/PRO-G40/idstore/components/order-item-form.tsx) |
| [removeOrderItem](/Volumes/PRO-G40/idstore/app/(app)/work-orders/item-actions.ts:82) | `remove_invoice_line`, `remove_estimate_line` | [components/maintenance-order-items.tsx](/Volumes/PRO-G40/idstore/components/maintenance-order-items.tsx) |

## app/(auth)/login/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [signIn](/Volumes/PRO-G40/idstore/app/(auth)/login/actions.ts:10) | `portal_identity` | [app/(auth)/login/login-form.tsx](/Volumes/PRO-G40/idstore/app/(auth)/login/login-form.tsx) |

## app/portal/actions.ts

| Action | Backend call(s) | Application reference(s) |
|---|---|---|
| [decideEstimate](/Volumes/PRO-G40/idstore/app/portal/actions.ts:6) | `portal_record_estimate_decision` | [app/portal/page.tsx](/Volumes/PRO-G40/idstore/app/portal/page.tsx) |
| [requestAppointment](/Volumes/PRO-G40/idstore/app/portal/actions.ts:8) | `portal_service_options`, `portal_request_appointment` | [app/portal/page.tsx](/Volumes/PRO-G40/idstore/app/portal/page.tsx) |
| [updateConsent](/Volumes/PRO-G40/idstore/app/portal/actions.ts:39) | `portal_update_consent` | [app/portal/page.tsx](/Volumes/PRO-G40/idstore/app/portal/page.tsx) |
| [requestPaymentLink](/Volumes/PRO-G40/idstore/app/portal/actions.ts:41) | `portal_request_payment_link` | [app/portal/page.tsx](/Volumes/PRO-G40/idstore/app/portal/page.tsx) |

Total: **106 Server Actions**. Four exports have no application reference: `addInspectionItem`, `createInspectionCheckDefinition`, `removeInspectionItem`, `completeInspection`. Their newer inspection workflow replaces much of this behavior; absence alone is not classified as a defect. `addInspectionCatalogItems` is referenced by a legacy component, which is not proof that the current inspection page renders it.
