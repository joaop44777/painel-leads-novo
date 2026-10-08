import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
type Header={name:string;value:string};type Msg={id:string;internalDate?:string;payload?:{headers?:Header[];parts?:any[];body?:{data?:string}}};
function b64(s:string){return Buffer.from(s.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8")}
function headers(m:Msg){return Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]))}
function body(m:Msg):string{const p=m.payload;if(!p)return "";if(p.body?.data)return b64(p.body.data);for(const x of p.parts||[]){if(x.mimeType==="text/plain"&&x.body?.data)return b64(x.body.data);const v=body(x);if(v)return v}return ""}
function field(text:string,names:string[]){for(const n of names){const r=new RegExp("^\\s*"+n+"\\s*[:：-]\\s*(.+)$","im").exec(text);if(r)return r[1].trim()}return null}
async function access(refresh:string){const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,refresh_token:refresh,grant_type:"refresh_token"})});if(!r.ok)throw new Error("google_refresh_failed");return (await r.json()).access_token}
export async function POST(req:Request){if(req.headers.get("authorization")!=="Bearer "+process.env.SYNC_SECRET)return new Response("Unauthorized",{status:401});
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);const {data:tokens}=await admin.from("google_tokens").select("*");
 let imported=0,notified=0;
 for(const t of tokens||[]){try{const token=await access(t.refresh_token);const sr=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=20",{headers:{Authorization:"Bearer "+token}});if(!sr.ok)continue;const list=await sr.json();for(const item of list.messages||[]){const mr=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+item.id+"?format=full",{headers:{Authorization:"Bearer "+token}});if(!mr.ok)continue;const m:Msg=await mr.json(),h=headers(m),text=body(m),email=t.google_email;
 const lead={name:field(text,["NOME","NOME DO CLIENTE"]),phone:field(text,["TELEFONE","CELULAR"]),plate:field(text,["PLACA"]),taxi_app:field(text,["TAXI/APP","TAXI","APP"]),received_at:new Date(Number(m.internalDate||Date.now())).toISOString(),sender_email:h.from||null,subject:h.subject||null,raw_email:text,external_message_id:h["message-id"]||m.id};
 const ins=await admin.from("leads").upsert(lead,{onConflict:"external_message_id"}).select("id").single();if(ins.error||!ins.data)continue;
 const {data:profile}=await admin.from("profiles").select("id").eq("email",email).eq("active",true).maybeSingle();if(!profile)continue;
 const rec=await admin.from("lead_recipients").upsert({lead_id:ins.data.id,user_id:profile.id,recipient_email:email},{onConflict:"lead_id,user_id"}).select("id").single();
 if(rec.data){await admin.from("notifications").insert({user_id:profile.id,lead_id:ins.data.id,title:"Novo lead recebido",message:"Um novo lead chegou no seu e-mail: "+(lead.name||"Sem nome")});notified++;imported++}
 } }catch(e){continue}}
 return Response.json({ok:true,imported,notified})}