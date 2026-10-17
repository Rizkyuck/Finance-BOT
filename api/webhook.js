// webhook.js - Serverless function handler
import { parseTransaction } from '../lib/aiParser.js';
import { appendTransaction, getFinancialSummary, buildReplyMessage, deleteLastTransaction } from '../lib/sheetsHelper.js';

export default async function handler(req, res) {
  // 1. Verifikasi Webhook Meta (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // 2. Menerima Pesan WhatsApp (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const value = body?.entry?.[0]?.changes?.[0]?.value || body?.value;
      const message = value?.messages?.[0];

      if (!message || message.type !== 'text') {
        return res.status(200).send('EVENT_RECEIVED');
      }

      const senderNumber = message.from;
      const userText = message.text.body;

      // Filter nomor HP pemilik (izinkan nomor kamu atau pengujian Meta)
      if (process.env.ALLOWED_PHONE && senderNumber !== process.env.ALLOWED_PHONE && !senderNumber.startsWith('1631555')) {
        return res.status(200).send('UNAUTHORIZED_USER');
      }

      // Parsing pesan dengan Gemini AI
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

      // Kirim balasan ke WhatsApp via Meta Cloud API
      await sendWhatsAppMessage(senderNumber, replyText);

      return res.status(200).json({ status: 'success' });
    } catch (err) {
      console.error('Error handling webhook:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function sendWhatsAppMessage(to, text) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  
  if (!phoneId || !token) {
    console.log('WA Mock reply to', to, ':\n', text);
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
}
