# Sistem Absensi QR Dinamis

Website absensi dengan QR token yang berganti setiap 10 detik, form identitas peserta, Supabase Database, dan dashboard sekretaris.

## Isi proyek
- `index.html`: dashboard admin.
- `scan.html`: form peserta yang dibuka dari QR.
- `js/config.js`: konfigurasi URL dan anon key Supabase.
- `supabase/migrations/001_init.sql`: tabel dan kebijakan akses.
- `supabase/functions/create-qr`: membuat token QR singkat untuk admin.
- `supabase/functions/submit-attendance`: memvalidasi token dan menyimpan absensi.

## A. Buat proyek Supabase
1. Buat proyek di https://supabase.com/.
2. Buka **Project Settings > API**. Salin Project URL dan anon/public key.
3. Isi kedua nilai tersebut di `js/config.js`. Jangan pernah menaruh `service_role` key di file frontend.
4. Buka **SQL Editor**, jalankan seluruh isi `supabase/migrations/001_init.sql`.
5. Buka **Authentication > Users**, buat akun sekretaris menggunakan email dan password.
6. Salin User UID akun tersebut. Jalankan SQL berikut di SQL Editor:
   `insert into public.admins(user_id) values ('GANTI_DENGAN_USER_UID');`

## B. Deploy Edge Functions
Install Supabase CLI, lalu dari folder proyek jalankan:
1. `supabase login`
2. `supabase link --project-ref PROJECT_REF_ANDA`
3. Buat secret acak panjang untuk QR signing. Contoh membuatnya di terminal: `openssl rand -hex 32`
4. Atur secrets:
   `supabase secrets set QR_SIGNING_SECRET="SECRET_ACAK_PANJANG" PUBLIC_SITE_URL="https://USERNAME.github.io/NAMA-REPO"`
5. Deploy:
   `supabase functions deploy create-qr`
   `supabase functions deploy submit-attendance`

Supabase project URL, anon key, dan service role key disediakan otomatis ke Edge Functions oleh Supabase. Jangan menyalin service role key ke browser.

## C. Publikasikan ke GitHub Pages
1. Buat repository GitHub.
2. Upload seluruh isi folder proyek (bukan folder induknya).
3. Buka **Settings > Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
5. Pastikan `PUBLIC_SITE_URL` di Supabase secrets sama persis dengan alamat GitHub Pages, tanpa garis miring di akhir.
6. Buka URL GitHub Pages untuk login admin. Peserta membuka URL `scan.html` melalui QR.

## D. Alur penggunaan
1. Sekretaris login ke `index.html`.
2. Isi nama kegiatan dan tekan **Buat sesi & tampilkan QR**.
3. QR diperbarui setiap 10 detik. Peserta memindai QR terbaru dan mengisi nama serta nomor identitas.
4. Data muncul di dashboard (refresh otomatis setiap 5 detik).
5. Tekan **Akhiri sesi** untuk menutup absensi. Gunakan **Unduh CSV (Excel)** untuk mengunduh rekap.

## Catatan penting sebelum digunakan sungguhan
- QR diperbarui setiap 10 detik. Token berlaku maksimal 20 detik agar peserta punya waktu memindai dan mengirim form; token dari QR sebelumnya dapat memiliki masa berlaku singkat setelah QR berganti.
- Pengaturan jam perangkat peserta tidak dipercaya; waktu absensi dibuat oleh database/server.
- Satu nomor identitas hanya dapat tercatat sekali per sesi.
- Tambahkan CAPTCHA/rate limiting dan kebijakan privasi bila dipakai untuk acara besar atau data sensitif.
- Untuk repository GitHub Pages pada subpath, `PUBLIC_SITE_URL` harus menunjuk ke URL lengkap repository, misalnya `https://akun.github.io/repo`.
- Ini adalah starter project. Uji dengan beberapa akun/perangkat dan lakukan pemeriksaan keamanan sebelum dipakai untuk absensi resmi.
