// sheetsHelper.js - Sinkronisasi Google Sheets via Apps Script Webhook (Tanpa Service Account / Kartu Kredit)

export function formatRp(amount) {
  return "Rp " + Number(amount || 0).toLocaleString("id-ID");
}

/**
 * Catat baris transaksi ke Google Sheets lewat Apps Script URL
 */
export async function appendTransaction(scriptUrl, txData) {
  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "APPEND",
      tx: txData
    })
  });
  return await res.json();
}

/**
 * Hapus baris transaksi terakhir
 */
export async function deleteLastTransaction(scriptUrl) {
  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "DELETE_LAST"
    })
  });
  return await res.json();
}

/**
 * Mengambil ringkasan saldo dan pengeluaran dari Google Sheets
 */
export async function getFinancialSummary(scriptUrl, queryPeriod = 'balance') {
  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "GET_DATA"
    })
  });

  const data = await res.json();
  const rows = (data.rows || []).slice(1); // skip header row

  const balances = {
    Cash: 0,
    EWallet: 0,
    Bank: 0,
    Investasi: 0
  };

  const ewalletTypes = ['gopay', 'ovo', 'dana', 'shopeepay'];
  const bankTypes = ['bca', 'mandiri', 'bri', 'bni', 'jago', 'seabank'];
  const investTypes = ['bibit', 'ajaib', 'stockbit', 'kripto'];

  function categorizeAccount(accName) {
    if (!accName) return 'Cash';
    const lower = accName.toLowerCase();
    if (lower.includes('cash')) return 'Cash';
    if (ewalletTypes.some(t => lower.includes(t))) return 'EWallet';
    if (bankTypes.some(t => lower.includes(t))) return 'Bank';
    if (investTypes.some(t => lower.includes(t))) return 'Investasi';
    return 'Bank';
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let expenseThisMonth = 0;
  let expenseLastMonth = 0;
  let expenseThisYear = 0;

  for (const row of rows) {
    const [dateRaw, action, category, amountRaw, fromAcc, toAcc] = row;
    const amount = parseFloat(amountRaw) || 0;
    const rowDate = new Date(dateRaw);

    if (action === 'EXPENSE') {
      const type = categorizeAccount(fromAcc);
      balances[type] = (balances[type] || 0) - amount;

      if (!isNaN(rowDate)) {
        if (rowDate.getFullYear() === currentYear && rowDate.getMonth() === currentMonth) {
          expenseThisMonth += amount;
        } else if (
          (currentMonth === 0 && rowDate.getFullYear() === currentYear - 1 && rowDate.getMonth() === 11) ||
          (rowDate.getFullYear() === currentYear && rowDate.getMonth() === currentMonth - 1)
        ) {
          expenseLastMonth += amount;
        }
        if (rowDate.getFullYear() === currentYear) {
          expenseThisYear += amount;
        }
      }
    } else if (action === 'INCOME') {
      const type = categorizeAccount(fromAcc);
      balances[type] = (balances[type] || 0) + amount;
    } else if (action === 'INVEST') {
      // Penambahan aset investasi secara langsung (tanpa menguras ewallet kecuali transfer)
      balances.Investasi = (balances.Investasi || 0) + amount;
    } else if (action === 'SET_BALANCE') {
      // Pengguna mengeset saldo awal
      const type = categorizeAccount(fromAcc);
      balances[type] = amount;
    } else if (action === 'TRANSFER') {
      const fromType = categorizeAccount(fromAcc);
      const toType = categorizeAccount(toAcc);
      balances[fromType] = (balances[fromType] || 0) - amount;
      balances[toType] = (balances[toType] || 0) + amount;
    }
  }

  return {
    balances,
    expenseThisMonth,
    expenseLastMonth,
    expenseThisYear,
    queryPeriod
  };
}

export function buildReplyMessage(parsed, summary = null) {
  if (parsed.action === 'QUERY' && summary) {
    const { balances, expenseThisMonth, expenseLastMonth, expenseThisYear } = summary;
    const totalAset = Object.values(balances).reduce((a, b) => a + b, 0);

    let compText = "";
    if (expenseLastMonth > 0) {
      const diff = expenseThisMonth - expenseLastMonth;
      const pct = Math.abs(Math.round((diff / expenseLastMonth) * 100));
      if (diff > 0) {
        compText = `\n⚠️ *Naik ${pct}%* dibanding bulan lalu (${formatRp(expenseLastMonth)})`;
      } else {
        compText = `\n✅ *Hemat ${pct}%* dibanding bulan lalu (${formatRp(expenseLastMonth)})`;
      }
    }

    return (
      `📊 *RINGKASAN KEUANGAN KAMU*\n` +
      `───────────────────────\n` +
      `💵 *Cash:* ${formatRp(balances.Cash)}\n` +
      `📱 *E-Wallet:* ${formatRp(balances.EWallet)}\n` +
      `🏦 *Bank:* ${formatRp(balances.Bank)}\n` +
      `📈 *Investasi:* ${formatRp(balances.Investasi)}\n` +
      `───────────────────────\n` +
      `💰 *Total Aset:* ${formatRp(totalAset)}\n\n` +
      `📉 *Pengeluaran Bulan Ini:* ${formatRp(expenseThisMonth)}${compText}\n` +
      `📅 *Pengeluaran Tahun Ini:* ${formatRp(expenseThisYear)}`
    );
  }

  let actionEmoji = '💸';
  let actionLabel = 'Pengeluaran';

  if (parsed.action === 'INCOME') {
    actionEmoji = '💰';
    actionLabel = 'Pemasukan';
  } else if (parsed.action === 'INVEST') {
    actionEmoji = '📈';
    actionLabel = 'Aset Investasi';
  } else if (parsed.action === 'SET_BALANCE') {
    actionEmoji = '🏦';
    actionLabel = 'Saldo Awal';
  } else if (parsed.action === 'TRANSFER') {
    actionEmoji = '🔄';
    actionLabel = 'Pindah Dana / Transfer';
  }

  let text = `✅ *Tercatat Rapi!*\n───────────────────────\n`;
  text += `📌 *Tipe:* ${actionLabel} ${actionEmoji}\n`;
  if (parsed.category && parsed.category !== 'None') {
    text += `🏷️ *Kategori:* ${parsed.category}\n`;
  }
  text += `💵 *Nominal:* ${formatRp(parsed.amount)}\n`;
  text += `💳 *Akun:* ${parsed.from_account}`;
  if (parsed.to_account && parsed.to_account !== 'null') {
    text += ` ➡️ ${parsed.to_account}`;
  }
  text += `\n📝 *Catatan:* "${parsed.note}"\n`;
  text += `───────────────────────\n💡 _Ketik "saldo" untuk cek aset, atau "batal" jika salah input._`;

  return text;
}
