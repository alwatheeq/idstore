import { createClient } from "@/lib/supabase/server";
import { InspectionServicesForm } from "@/components/inspection-services-form";
import { isMaintenanceTask } from "@/lib/maintenance-order";

export async function InspectionServiceSelection({ inspectionId, organizationId, orderType, canSelect }: {
  inspectionId: string; organizationId: string; orderType: string; canSelect: boolean;
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [catalog, selected] = await Promise.all([
    supabase.from("service_template_versions").select("id, template:service_templates!inner(code, name_en, name_ar, work_order_type), service_template_tasks(result_schema)")
      .eq("organization_id", organizationId).eq("status", "published").eq("template.work_order_type", orderType)
      .lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`),
    supabase.from("work_order_service_choices").select("service_version_id").eq("organization_id", organizationId).eq("inspection_id", inspectionId),
  ]);
  if (catalog.error || selected.error) return <p role="alert">The service selection could not be loaded.</p>;
  const services = (catalog.data ?? []).filter(service => service.service_template_tasks.every(task => isMaintenanceTask(task.result_schema)))
    .map(service => ({ id: service.id, code: service.template.code, name: service.template.name_en, nameAr: service.template.name_ar })).sort((a, b) => a.code.localeCompare(b.code));
  return <InspectionServicesForm key={selected.data?.map(item => item.service_version_id).join(",")} inspectionId={inspectionId} services={services} selectedIds={selected.data?.map(item => item.service_version_id) ?? []} canSelect={canSelect} />;
}
