// test-ai.js
import 'dotenv/config';
import { parseTransaction } from './lib/aiParser.js';

async function test() {
  const tests = [
    "beli makan 13k",
    "makan 13rb",
    "eat 13k",
    "kopi 25rb gopay",
    "saldo",
    "topup ovo 50k bca"
  ];

  console.log("=== TESTING AI PARSER ===");
  for (const t of tests) {
    try {
      const res = await parseTransaction(t, process.env.GEMINI_API_KEY);
      console.log(`Input: "${t}" -> Output:`, JSON.stringify(res));
    } catch (e) {
      console.error(`Error on "${t}":`, e.message);
    }
  }
}

test();
