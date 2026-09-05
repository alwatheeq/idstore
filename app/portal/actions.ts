"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, routeMessage } from "@/lib/actions/form";
import { createClient } from "@/lib/supabase/server";
export async function decideEstimate(formData:FormData){const estimateId=formText(formData,"estimateId"),decision=formText(formData,"decision");if(!estimateId||!["approved","declined"].includes(decision))redirect(routeMessage("/portal","error","Choose a valid estimate decision."));try{const supabase=await createClient();const {error}=await supabase.rpc("portal_record_estimate_decision",{p_estimate_id:estimateId,p_decision:decision,p_evidence_note:formText(formData,"note")});if(error)throw error;}catch(error){redirect(routeMessage("/portal","error",operationError(error,"Your decision could not be recorded.")));}revalidatePath("/portal");redirect(routeMessage("/portal","created",`Estimate ${decision}.`));}
