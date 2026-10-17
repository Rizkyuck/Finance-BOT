# Panduan Setup WhatsApp AI Finance Bot (100% Free & No Laptop Needed)

Proyek ini telah dibuat di:
`C:\Users\advan\.gemini\antigravity\scratch\wa-finance-bot`

---

## 🚀 Mengapa Solusi Ini Berhasil Menyelesaikan Masalah Anda:

1. **Anti-Kategori Ganda (Strict Taxonomy):**
   * Menggunakan Gemini AI dengan mode JSON terstruktur & daftar kategori terkunci.
   * `beli makan 13k`, `makan 13rb`, `eat 13k`, `sarapan 13000` **pasti masuk ke satu kategori**: `"Makan & Minum"`.
   * Angka `13k`, `13rb`, `13.000` otomatis jadi integer: `13000`.

2. **Tanpa Laptop Nyala & Tanpa VPS Mati-Mati (Serverless):**
   * Bot dideploy ke **Vercel** (Free Tier).
   * Vercel hanya hidup sepersekian detik saat WhatsApp mengirim pesan, lalu tidur tanpa memakan biaya.
   * **Tidak pernah down, tidak pernah sleep, gratis selamanya untuk pemakaian pribadi.**

3. **Multi-Akun & Perbandingan Bulanan:**
   * Memisahkan otomatis: **Cash**, **E-Wallet** (Gopay, OVO, Dana), **Bank** (BCA, Mandiri), dan **Investasi** (Bibit, Saham).
   * Menyediakan perbandingan bulan ini vs bulan lalu (misal: "Naik 12% / Hemat 15%").

---

## 📋 Langkah Aktivasi Singkat:

### 1. Buat Google Sheet
* Buka Google Sheets baru, beri nama misalnya: `Keuangan Pribadi`.
* Buat tab bernama `Transactions` dengan header baris 1:
  `Tanggal | Tipe | Kategori | Nominal | Dari Akun | Ke Akun | Catatan`
* Buat **Service Account** di Google Cloud Console (gratis), unduh file JSON-nya, dan bagikan (*share*) sheet tersebut ke email service account sebagai *Editor*.

### 2. Dapatkan Gemini API Key (Gratis)
* Buka [Google AI Studio](https://aistudio.google.com/) -> Buat API Key gratis.

### 3. WhatsApp Cloud API (Meta for Developers)
* Buka [developers.facebook.com](https://developers.facebook.com/) -> Buat App -> Pilih WhatsApp.
* Di sana Anda langsung diberi **Test Phone Number** gratis dan **Access Token**.
* Masukkan nomor WhatsApp asli Anda sebagai nomor penerima/pengirim yang diizinkan.

### 4. Deploy ke Vercel (1 Klik dari GitHub)
* Upload folder `wa-finance-bot` ke GitHub Anda.
* Masuk ke [vercel.com](https://vercel.com) -> New Project -> Import repo.
* Masukkan Environment Variables di Vercel:
  * `GEMINI_API_KEY`: API key dari Google AI Studio
  * `WHATSAPP_PHONE_ID`: Phone Number ID dari Meta
  * `WHATSAPP_ACCESS_TOKEN`: Token dari Meta
  * `WHATSAPP_VERIFY_TOKEN`: Buat kata sandi bebas (misal: `rahasiaku123`)
  * `ALLOWED_PHONE`: Nomor WA Anda dengan format `628xxxxxxxxxx` (agar orang lain tidak bisa utak-atik keuangan Anda)
  * `SPREADSHEET_ID`: ID dari link Google Sheets Anda
  * `GOOGLE_CREDENTIALS`: Isi teks lengkap dari file JSON Service Account Google
* Salin URL Vercel Anda (misal `https://wa-bot.vercel.app/api/webhook`) dan tempel di Callback URL portal Meta WhatsApp.

---

Selesai! Sekarang Anda bisa langsung chat ke WhatsApp bot kapanpun:
* `makan 13k` -> Otomatis tercatat di Sheets & Saldo Cash terpotong 13.000.
* `kopi 25rb gopay` -> Saldo Gopay terpotong 25.000.
* `topup ovo 100k bca` -> Pindah dana dari BCA ke OVO.
* `saldo` -> Langsung dapat rekap aset & perbandingan pengeluaran bulan ini.
