import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=new TextEncoder();
function b64url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
async function sign(value:string,secret:string){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value))));}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, secret=Deno.env.get("QR_SIGNING_SECRET")!;
  const auth=req.headers.get("Authorization")||"";
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userErr}=await userClient.auth.getUser();
  if(userErr||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const admin=createClient(url,service);
  const {data:adminRow}=await admin.from("admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(!adminRow)return Response.json({error:"Admin access required"},{status:403,headers:cors});
  const {session_id}=await req.json();
  const {data:session}=await admin.from("sessions").select("id,status").eq("id",session_id).eq("created_by",user.id).maybeSingle();
  if(!session||session.status!=="active")return Response.json({error:"Session is not active"},{status:400,headers:cors});
  const payload=b64url(enc.encode(JSON.stringify({sid:session.id,exp:Math.floor(Date.now()/1000)+20,nonce:crypto.randomUUID()})));
  const token=payload+"."+await sign(payload,secret);
  const site=Deno.env.get("PUBLIC_SITE_URL");
  if(!site)throw new Error("PUBLIC_SITE_URL belum diatur");
  return Response.json({url:`${site.replace(/\\/$/,"")}/scan.html?t=${token}`},{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return Response.json({error:String(e?.message||e)},{status:400,headers:cors});}
});