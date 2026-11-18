
/* global supabase, APP_CONFIG */

const { createClient } = supabase;

const db = createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const params = new URLSearchParams(location.search);
const qrToken = params.get("t");

const $ = id => document.getElementById(id);

let formToken = null;
let isVerified = false;

function showResult(text, error = false) {
  $("result").hidden = false;
  $("result").textContent = text;
  $("result").className = error ? "result error" : "result";
}

function setFormEnabled(enabled) {
  $("name").disabled = !enabled;
  $("identity").disabled = !enabled;
  $("submitBtn").disabled = !enabled;
}

async function verifyLocation() {
  if (!qrToken) {
    $("formArea").hidden = true;
    showResult("QR tidak valid. Silakan pindai QR terbaru.", true);
    return;
  }

  if (!navigator.geolocation) {
    $("formArea").hidden = true;
    showResult("Perangkat Anda tidak mendukung pemeriksaan lokasi.", true);
    return;
  }

  setFormEnabled(false);
  showResult("Memeriksa lokasi Anda. Mohon izinkan akses lokasi pada HP.");

  navigator.geolocation.getCurrentPosition(
    async position => {
      try {
        const { data, error } = await db.functions.invoke(
          "start-attendance",
          {
            body: {
              qr_token: qrToken,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          }
        );

        if (error) {
          throw new Error(error.message);
        }

        if (!data || !data.success || !data.form_token) {
          throw new Error(data?.error || "Verifikasi lokasi gagal.");
        }

        formToken = data.form_token;
        isVerified = true;

        setFormEnabled(true);
        showResult(
          "Lokasi berhasil diverifikasi. Silakan isi formulir dalam waktu 60 detik."
        );

        setTimeout(() => {
          if (!isVerified) return;

          isVerified = false;
          formToken = null;
          setFormEnabled(false);
          showResult(
            "Waktu pengisian habis. Silakan pindai QR terbaru.",
            true
          );
        }, 60000);

      } catch (err) {
        $("formArea").hidden = true;
        showResult(
          err.message || "Verifikasi gagal. Silakan pindai QR terbaru.",
          true
        );
      }
    },

    error => {
      $("formArea").hidden = true;

      let message = "Tidak dapat memperoleh lokasi perangkat.";

      if (error.code === 1) {
        message = "Izin lokasi ditolak. Aktifkan izin lokasi lalu pindai QR kembali.";
      } else if (error.code === 2) {
        message = "Lokasi tidak tersedia. Periksa GPS dan koneksi perangkat.";
      } else if (error.code === 3) {
        message = "Pemeriksaan lokasi terlalu lama. Silakan coba lagi.";
      }

      showResult(message, true);
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

$("submitBtn").onclick = async () => {
  if (!isVerified || !formToken) {
    showResult("Lokasi belum diverifikasi. Silakan pindai QR kembali.", true);
    return;
  }

  const name = $("name").value.trim();
  const identity = $("identity").value.trim();

  if (name.length < 2 || identity.length < 2) {
    showResult("Mohon isi nama dan nomor identitas dengan benar.", true);
    return;
  }

  $("submitBtn").disabled = true;
  $("submitBtn").textContent = "Mengirim...";

  try {
    const { data, error } = await db.functions.invoke(
      "submit-attendance",
      {
        body: {
          form_token: formToken,
          full_name: name,
          identity_number: identity
        }
      }
    );

    if (error) {
  let detail = error.message;

  try {
    const body = await error.context.json();
    detail = body.error || body.message || detail;
  } catch (e) {}

  throw new Error(detail);
}

    isVerified = false;
    formToken = null;
    $("formArea").hidden = true;

    showResult(data.message || "Absensi berhasil dicatat. Terima kasih.");

  } catch (err) {
    $("submitBtn").disabled = false;
    $("submitBtn").textContent = "Kirim absensi";

    showResult(
      err.message || "Absensi gagal dikirim. Silakan coba kembali.",
      true
    );
  }
};

setFormEnabled(false);
verifyLocation();
