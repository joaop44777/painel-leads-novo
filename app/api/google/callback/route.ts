import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function GET(req:Request){
 const url=new URL(req.url),code=url.searchParams.get("code"),state=url.searchParams.get("state"),cookie=req.headers.get("cookie")||"";
 const expected=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("google_oauth_state="))?.split("=")[1];
 if(!code||!state||!expected||state!==expected)return NextResponse.redirect(new URL("/configuracao?error=oauth_state",url));
 const clientId=process.env.GOOGLE_CLIENT_ID!,clientSecret=process.env.GOOGLE_CLIENT_SECRET!,redirectUri=process.env.GOOGLE_REDIRECT_URI||new URL("/api/google/callback",url).toString();
 const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
 if(!tokenRes.ok)return NextResponse.redirect(new URL("/configuracao?error=google_token",url));
 const tokens=await tokenRes.json();
 const infoRes=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+tokens.access_token}});
 const info=await infoRes.json(); const userId=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("app_user_id="))?.split("=")[1];
 if(!userId||!info.email)return NextResponse.redirect(new URL("/configuracao?error=user",url));
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
 await admin.from("private.google_tokens").upsert({user_id:userId,google_email:info.email,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expiry_at:new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString(),updated_at:new Date().toISOString()});
 await admin.from("google_connections").upsert({user_id:userId,google_email:info.email,scopes:["gmail.readonly"],connected_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 const out=NextResponse.redirect(new URL("/leads",url));out.headers.append("Set-Cookie","google_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");out.headers.append("Set-Cookie","app_user_id=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");return out;
}