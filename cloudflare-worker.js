/* ============================================================
   VITREA Asistan — Cloudflare Worker (Gemini API vekili)
   Amac: API anahtarini sitede gostermeden bulutta tutmak.

   KURULUM (ozet — ayrinti BOT-KURULUM.md'de):
   1. dash.cloudflare.com > Workers & Pages > Create Worker
   2. Bu dosyanin icerigini yapistir, Deploy et
   3. Settings > Variables > "GEMINI_API_KEY" adinda SECRET ekle
   4. Worker adresini (https://....workers.dev) chatbot.js'e yaz
   ============================================================ */

const IZINLI_ORIGINLER = [
  'https://vitreaplas.com',
  'https://www.vitreaplas.com',
  'http://localhost:8161'
];

const MODEL = 'gemini-2.5-flash';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsBasliklari = {
      'Access-Control-Allow-Origin': IZINLI_ORIGINLER.includes(origin) ? origin : IZINLI_ORIGINLER[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsBasliklari });
    }
    if (request.method !== 'POST') {
      return new Response('Sadece POST', { status: 405, headers: corsBasliklari });
    }

    let govde;
    try { govde = await request.json(); } catch (e) {
      return Response.json({ error: 'gecersiz istek' }, { status: 400, headers: corsBasliklari });
    }

    const mesajlar = Array.isArray(govde.messages) ? govde.messages.slice(-12) : [];
    if (!mesajlar.length) {
      return Response.json({ error: 'mesaj yok' }, { status: 400, headers: corsBasliklari });
    }

    const geminiIstek = {
      system_instruction: { parts: [{ text: String(govde.system || '').slice(0, 20000) }] },
      contents: mesajlar.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text || '').slice(0, 2000) }]
      })),
      generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
    };

    const cevap = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiIstek)
      }
    );

    if (!cevap.ok) {
      const detay = (await cevap.text()).slice(0, 500);
      return Response.json(
        { error: 'model hatasi', durum: cevap.status, detay: detay },
        { status: 502, headers: corsBasliklari }
      );
    }

    const veri = await cevap.json();
    const metin = veri?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return Response.json({ text: metin }, { headers: corsBasliklari });
  }
};
