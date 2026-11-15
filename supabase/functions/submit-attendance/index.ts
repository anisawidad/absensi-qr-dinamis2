import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=new TextEncoder();
function fromB64url(s:string){const b=s.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(b+"=".repeat((4-b.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function validSig(payload:string,sig:string,secret:string){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);return crypto.subtle.verify("HMAC",key,fromB64url(sig),enc.encode(payload));}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const {token,full_name,identity_number}=await req.json();
  if(typeof token!=="string"||typeof full_name!=="string"||typeof identity_number!=="string")return Response.json({error:"Data tidak lengkap"},{status:400,headers:cors});
  const [payload,sig]=token.split(".");
  if(!payload||!sig||!await validSig(payload,sig,Deno.env.get("QR_SIGNING_SECRET")!))return Response.json({error:"QR tidak valid"},{status:400,headers:cors});
  const decoded=JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  if(!decoded.sid||decoded.exp<Math.floor(Date.now()/1000))return Response.json({error:"QR sudah kedaluwarsa. Pindai QR terbaru."},{status:400,headers:cors});
  const name=full_name.trim(), identity=identity_number.trim();
  if(name.length<2||name.length>120||identity.length<2||identity.length>64)return Response.json({error:"Nama atau nomor identitas tidak valid"},{status:400,headers:cors});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:session}=await admin.from("sessions").select("id,status").eq("id",decoded.sid).maybeSingle();
  if(!session||session.status!=="active")return Response.json({error:"Sesi absensi sudah ditutup"},{status:400,headers:cors});
  const {error}=await admin.from("attendance").insert({session_id:decoded.sid,full_name:name,identity_number:identity});
  if(error?.code==="23505")return Response.json({error:"Nomor identitas ini sudah melakukan absensi pada sesi ini."},{status:409,headers:cors});
  if(error)throw error;
  return Response.json({message:"Absensi berhasil dicatat. Terima kasih."},{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return Response.json({error:String(e?.message||e)},{status:400,headers:cors});}
});