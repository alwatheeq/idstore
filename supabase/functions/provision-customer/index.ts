import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors}); if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
 const authorization=request.headers.get("Authorization"),url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!authorization||!url||!anon||!service)return reply(401,{error:"Authentication is required."});
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false}});const token=authorization.replace(/^Bearer\s+/i,"");const {data:auth}=await caller.auth.getUser(token);if(!auth.user)return reply(401,{error:"Authentication is required."});
 let input:Record<string,unknown>;try{input=await request.json();}catch{return reply(400,{error:"A valid JSON body is required."});}
 const organizationId=typeof input.organizationId==="string"?input.organizationId:"",customerId=typeof input.customerId==="string"?input.customerId:"",mobile=typeof input.mobile==="string"?input.mobile:"",pin=typeof input.pin==="string"?input.pin:"";
 if(!organizationId||!customerId||!/^\+[1-9][0-9]{7,14}$/.test(mobile)||!/^\d{6}$/.test(pin))return reply(400,{error:"Customer, valid mobile and six-digit PIN are required."});
 const {data:membership}=await caller.from("memberships").select("id, role").eq("organization_id",organizationId).eq("user_id",auth.user.id).eq("status","active").maybeSingle();if(!membership)return reply(403,{error:"You are not authorized to create portal access."});
 if(!["admin","staff"].includes(membership.role)) return reply(403,{error:"You are not authorized to create portal access."});
 if(membership.role==="staff"){const {data:permission}=await caller.from("membership_permissions").select("permission_code").eq("organization_id",organizationId).eq("membership_id",membership.id).eq("permission_code","crm.manage").eq("allowed",true).maybeSingle();if(!permission)return reply(403,{error:"You are not authorized to create portal access."});}
 const {data:contactOwners,error:contactError}=await caller.from("customer_contacts").select("customer_id").eq("organization_id",organizationId).eq("kind","mobile").eq("normalized_value",mobile);if(contactError)return reply(400,{error:"Customer identity could not be validated."});if(contactOwners?.some((owner)=>owner.customer_id!==customerId))return reply(409,{error:"This mobile number is already assigned to another customer."});
 const {data:customer}=await caller.from("customers").select("id,display_name").eq("id",customerId).eq("organization_id",organizationId).eq("status","active").maybeSingle();if(!customer)return reply(404,{error:"Active customer not found."});
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});const email=`${mobile.slice(1)}@mobile.idstore.invalid`;const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:pin,email_confirm:true,user_metadata:{display_name:customer.display_name,mobile,account_type:"customer"}});
 if(createError||!created.user)return reply(createError?.status===422?409:400,{error:createError?.status===422?"This mobile number already has an account.":"The portal account could not be created."});
 const {error:linkError}=await caller.rpc("provision_customer_portal",{p_customer_id:customer.id,p_auth_user_id:created.user.id});if(linkError){await admin.auth.admin.deleteUser(created.user.id);return reply(400,{error:"The portal identity could not be linked."});}
 return reply(201,{customerId:customer.id});
});
