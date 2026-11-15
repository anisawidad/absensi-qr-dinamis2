const {createClient}=supabase;
const db=createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
const params=new URLSearchParams(location.search);
const token=params.get("t");
const $=id=>document.getElementById(id);
if(!token){$("formArea").hidden=true;showResult("QR tidak valid. Silakan pindai QR terbaru dari sekretaris.",true);}
function showResult(text,error=false){$("result").hidden=false;$("result").textContent=text;$("result").className=error?"result error":"result";}
$("submitBtn").onclick=async()=>{
  const name=$("name").value.trim(), identity=$("identity").value.trim();
  if(name.length<2||identity.length<2){showResult("Mohon isi nama dan nomor identitas dengan benar.",true);return;}
  $("submitBtn").disabled=true;$("submitBtn").textContent="Mengirim...";
  const {data,error}=await db.functions.invoke("submit-attendance",{body:{token,full_name:name,identity_number:identity}});
  $("submitBtn").disabled=false;$("submitBtn").textContent="Kirim absensi";
  if(error){showResult("Absensi gagal dikirim. Pastikan koneksi internet aktif dan QR masih berlaku. "+error.message,true);return;}
  $("formArea").hidden=true;showResult(data.message||"Absensi berhasil dicatat. Terima kasih!");
};