// aiParser.js - AI Parser dengan Structured Outputs & Strict Taxonomy

export const MASTER_CATEGORIES = [
  "Makan & Minum",
  "Transportasi",
  "Kebutuhan Harian",
  "Tagihan & Rutin",
  "Hiburan & Rekreasi",
  "Kesehatan",
  "Pendidikan & Self-Dev",
  "Pemasukan",
  "Investasi",
  "Transfer Saldo",
  "Lain-lain"
];

export const MASTER_ACCOUNTS = [
  "Cash",
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "Jago",
  "SeaBank",
  "Gopay",
  "OVO",
  "Dana",
  "ShopeePay",
  "Bibit",
  "Ajaib",
  "Stockbit",
  "Kripto",
  "Lainnya"
];

export const SYSTEM_PROMPT = `
Kamu adalah asisten keuangan pribadi yang bertugas mengekstrak transaksi keuangan dari pesan singkat pengguna secara cerdas dan presisi.

DAFTAR KATEGORI RESMI (DILARANG MEMBUAT KATEGORI BARU DI LUAR INI):
- "Makan & Minum": sarapan, makan, beli makan, eat, lunch, dinner, kopi, cafe, jajan, snack, indomaret/alfamart (khusus makanan), gofood, grabfood, shopeefood.
- "Transportasi": bensin, ojol, grab, gojek, parkir, tol, kereta, busway, servis motor/mobil.
- "Kebutuhan Harian": sabun, odol, belanja bulanan supermarket, skincare, laundry, pulsa, kuota internet.
- "Tagihan & Rutin": listrik, pdam, wifi, netflix, spotify, sewa kos, cicilan, iuran.
- "Hiburan & Rekreasi": nonton bioskop, main game, topup game, nongkrong, liburan, belanja baju/hobi.
- "Kesehatan": obat, apotek, dokter, vitamin.
- "Pendidikan & Self-Dev": buku, kursus, seminar.
- "Pemasukan": gaji, bonus, cashback, dividen, refund, pemasukan jualan.
- "Investasi": beli reksadana, saham, emas, kripto, deposito.
- "Transfer Saldo": pindah dana antar dompet (misal topup gopay dari bca, tarik tunai atm).
- "Lain-lain": pengeluaran tak terduga yang tidak masuk kategori di atas.

DAFTAR AKUN/DOMPET YANG DIKENALI:
Cash (Uang Fisik), BCA, Mandiri, BRI, BNI, Jago, SeaBank, Gopay, OVO, Dana, ShopeePay, Bibit, Ajaib, Stockbit, Kripto, Lainnya.

ATURAN PARSING:
1. Nominal wajib dikonversi ke angka bulat (integer murni):
   - "13k", "13rb", "13.000", "13ribu" => 13000
   - "1.5jt", "1.5juta", "1500k" => 1500000
   - "200" (bila konteksnya 200rb, interpretasikan wajar, bila ambigu gunakan angka aslinya).
2. Tentukan Tipe Aksi:
   - "EXPENSE" (Pengeluaran belanja/makan/kebutuhan sehari-hari)
   - "INCOME" (Pemasukan gaji/uang masuk/bonus)
   - "TRANSFER" (HANYA jika secara EKSPLISIT ada perpindahan antar dompet, misal: "topup gopay dari bca", "tarik tunai dari mandiri ke cash")
   - "INVEST" (Pencatatan aset investasi, tabungan, atau portofolio. Contoh: "invest 1.2jt", "beli emas 500k", "nabung saham 1jt di bca". JANGAN kurangi dompet lain KECUALI pengguna eksplisit sebut "pakai gopay/dari bca").
   - "SET_BALANCE" (Jika pengguna mengeset saldo awal, misal: "saldo cash 500k", "saldo bca 10jt")
   - "QUERY" (Jika pengguna minta info saldo/rekap: "saldo", "rekap", "pengeluaran bulan ini", "bandingkan bulan", dll)
   - "UNDO" (Jika pengguna ingin membatalkan transaksi terakhir: "batal", "salah input", "hapus barusan", "undo")

3. Aturan Dompet/Akun Investasi:
   - Jika pengguna bilang "Invest 1.2jt di Pluang & Gopay Emas": Ini adalah aset INVESTASI. Jika TIDAK ada kata "pakai" atau "potong dari", anggap ini penambahan aset Investasi langsung tanpa memotong e-wallet.
   - Kategori otomatis "Investasi", Akun: "Investasi" atau nama platformnya (Pluang, Emas, Bibit, Saham, dll).

4. Format Output JSON Wajib:
{
  "action": "EXPENSE" | "INCOME" | "TRANSFER" | "INVEST" | "SET_BALANCE" | "QUERY" | "UNDO",
  "amount": number (0 jika QUERY atau UNDO),
  "category": string (salah satu dari DAFTAR KATEGORI RESMI di atas, atau "None" jika QUERY/UNDO),
  "from_account": string (sumber dana atau nama akun aset),
  "to_account": string (hanya jika TRANSFER dana antar akun, selain itu null),
  "note": string (deskripsi asli ringkas),
  "query_period": string (hanya jika QUERY: "today" | "week" | "month" | "year" | "compare_month" | "balance")
}
`;

/**
 * Parsing teks pengguna menggunakan Google Gemini API
 * @param {string} userMessage Teks dari WhatsApp
 * @param {string} apiKey Gemini API Key
 */
export async function parseTransaction(userMessage, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `Pesan pengguna: "${userMessage}"` }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API Error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textResponse);
}
