// telegram.js - Serverless Telegram Webhook Handler
import { parseTransaction } from '../lib/aiParser.js';
import { appendTransaction, getFinancialSummary, buildReplyMessage, deleteLastTransaction } from '../lib/sheetsHelper.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Telegram Finance Bot Webhook is running!');
  }

  if (req.method === 'POST') {
    try {
      const update = req.body;
      const message = update?.message;

      if (!message || !message.text) {
        return res.status(200).send('OK');
      }

      const chatId = message.chat.id;
      const userText = message.text.trim();

      // Perintah /start
      if (userText === '/start') {
        const welcome = `🤖 *Halo! Saya Bot Keuangan Pribadi Kamu.*\n\n` +
          `Kamu bisa catat transaksi dengan gaya bahasa santai:\n` +
          `• \`beli makan 13k\`\n` +
          `• \`kopi 25rb gopay\`\n` +
          `• \`bensin 20k ovo\`\n` +
          `• \`gaji 10jt masuk bca\`\n` +
          `• \`invest 500k bibit\`\n\n` +
          `📊 *Cek Laporan:*\n` +
          `• Ketik \`saldo\` atau \`rekap\`\n` +
          `• Ketik \`pengeluaran bulan ini\`\n\n` +
          `🗑️ *Salah Input?*\n` +
          `• Cukup ketik \`batal\` atau \`undo\``;
        await sendTelegramMessage(chatId, welcome);
        return res.status(200).json({ status: 'ok' });
      }

      // Parsing transaksi via AI
      const parsed = await parseTransaction(userText, process.env.GEMINI_API_KEY);
      const scriptUrl = process.env.APPS_SCRIPT_URL;

      let replyText = "";

      if (parsed.action === 'QUERY') {
        const summary = await getFinancialSummary(scriptUrl, parsed.query_period);
        replyText = buildReplyMessage(parsed, summary);
      } else if (parsed.action === 'UNDO') {
        const delRes = await deleteLastTransaction(scriptUrl);
        if (delRes?.deletedRow) {
          replyText = `🗑️ *Transaksi Terakhir Dibatalkan!*\n` +
                      `───────────────────────\n` +
                      `📌 *Data yang dihapus:*\n` +
                      `• Kategori: ${delRes.deletedRow[2]}\n` +
                      `• Nominal: Rp ${Number(delRes.deletedRow[3] || 0).toLocaleString('id-ID')}\n` +
                      `• Akun: ${delRes.deletedRow[4]}\n` +
                      `• Catatan: "${delRes.deletedRow[6]}"\n` +
                      `───────────────────────\nSaldo otomatis disesuaikan kembali.`;
        } else {
          replyText = `⚠️ Tidak ada transaksi yang bisa dihapus.`;
        }
      } else {
        await appendTransaction(scriptUrl, parsed);
        replyText = buildReplyMessage(parsed);
      }

      // Kirim balasan ke Telegram
      await sendTelegramMessage(chatId, replyText);
      return res.status(200).json({ status: 'success' });
    } catch (err) {
      console.error('Error handling Telegram webhook:', err);
      return res.status(200).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}
