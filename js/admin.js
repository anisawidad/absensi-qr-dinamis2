/* global supabase, APP_CONFIG, QRCode */
const { createClient } = supabase;
const db = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
let currentSession = null, qrTimer = null, countdownTimer = null, refreshTimer = null;
let lastRows = [];

function show(el, yes=true){ $(el).hidden = !yes; }
function message(id, text){ $(id).textContent = text; }
async function isAdmin(user){
  const {data,error}=await db.from("admins").select("user_id").eq("user_id",user.id).maybeSingle();
  return !error && !!data;
}
async function updateAuth(){
  const {data:{session}}=await db.auth.getSession();
  if(session && await isAdmin(session.user)){
    show("loginPanel",false); show("adminPanel",true); $("adminEmail").textContent=session.user.email;
    await loadLatestSession();
  }else{
    show("adminPanel",false); show("loginPanel",true);
    if(session) message("loginMsg","Akun ini belum diberi hak admin. Minta administrator menambahkan user ID ke tabel admins.");
  }
}
$("loginBtn").onclick=async()=>{
  message("loginMsg","Memproses...");
  const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error){message("loginMsg",error.message);return;} await updateAuth();
};
$("logoutBtn").onclick=async()=>{stopTimers();await db.auth.signOut();await updateAuth();};
$("startBtn").onclick=async()=>{
  const name=$("sessionName").value.trim();
  if(!name){message("sessionMsg","Isi nama kegiatan terlebih dahulu.");return;}
  const {data:{user}}=await db.auth.getUser();
  const {data,error}=await db.from("sessions").insert({name,created_by:user.id,status:"active"}).select().single();
  if(error){message("sessionMsg",error.message);return;}
  currentSession=data; show("qrArea",true); message("sessionMsg","Sesi aktif: "+name);
  await refreshQR(); startTimers(); await loadAttendance();
};
async function refreshQR(){
  if(!currentSession)return;
  const {data:{session}}=await db.auth.getSession();
  const {data,error}=await db.functions.invoke("create-qr",{body:{session_id:currentSession.id}});
  if(error){message("sessionMsg","Gagal membuat QR: "+error.message);return;}
  $("qrcode").innerHTML="";
  new QRCode($("qrcode"),{text:data.url,width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
  window.qrExpiresAt=Date.now()+10000;
}
function startTimers(){
  stopTimers();
  refreshQR(); // refresh awal segera
  qrTimer=setInterval(refreshQR,10000);
  countdownTimer=setInterval(()=>{const left=Math.max(0,Math.ceil((window.qrExpiresAt-Date.now())/1000));$("countdown").textContent=String(left).padStart(2,"0");},250);
  refreshTimer=setInterval(loadAttendance,5000);
}
function stopTimers(){clearInterval(qrTimer);clearInterval(countdownTimer);clearInterval(refreshTimer);qrTimer=countdownTimer=refreshTimer=null;}
$("closeBtn").onclick=async()=>{
  if(!currentSession)return;
  const {error}=await db.from("sessions").update({status:"closed",ended_at:new Date().toISOString()}).eq("id",currentSession.id);
  if(error){message("sessionMsg",error.message);return;}
  stopTimers();show("qrArea",false);message("sessionMsg","Sesi telah diakhiri.");currentSession=null;
};
async function loadLatestSession(){
  const {data,error}=await db.from("sessions").select("*").eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error)return;
  if(data){currentSession=data;show("qrArea",true);message("sessionMsg","Sesi aktif: "+data.name);startTimers();await loadAttendance();}
}
async function loadAttendance(){
  if(!currentSession)return;
  const {data,error}=await db.from("attendance").select("id,full_name,identity_number,created_at").eq("session_id",currentSession.id).order("created_at",{ascending:true});
  if(error){message("sessionMsg","Gagal memuat data: "+error.message);return;}
  lastRows=data||[];$("total").textContent=lastRows.length+" peserta hadir";
  $("attendanceRows").innerHTML=lastRows.length?lastRows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.full_name)}</td><td>${escapeHtml(r.identity_number)}</td><td>${new Date(r.created_at).toLocaleString("id-ID")}</td></tr>`).join(""):'<tr><td colspan="4">Belum ada data.</td></tr>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("refreshBtn").onclick=loadAttendance;
$("exportBtn").onclick=()=>{
  if(!lastRows.length){alert("Belum ada data untuk diunduh.");return;}
  const rows=lastRows.map((r,i)=>({
    "No.":i+1,
    "Nama":r.full_name,
    "Nomor Identitas":r.identity_number,
    "Waktu Absensi":new Date(r.created_at).toLocaleString("id-ID")
  }));
  const sheet=XLSX.utils.json_to_sheet(rows);
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,sheet,"Kehadiran");
  XLSX.writeFile(book,"absensi-"+(currentSession?.name||"sesi").replace(/[^a-z0-9-_]/gi,"-")+".xlsx");
};
