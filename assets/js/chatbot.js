/* ============================================================
   VITREA Asistan — yapay zeka sohbet widget'i
   Arka uc: Cloudflare Worker (bkz. cloudflare-worker.js + BOT-KURULUM.md)
   ============================================================ */
'use strict';
(function () {

  /* Cloudflare Worker adresin — kurulumdan sonra buraya yapistir.
     Bos birakilirsa widget gorunmez (site bozulmaz). */
  var ENDPOINT = window.VITREA_BOT_ENDPOINT || '';
  if (!ENDPOINT) return;

  /* ---------- bilgi tabani: urunlerden sistem talimati uret ---------- */
  function sistemTalimati() {
    var urunler = (window.VITREA_PRODUCTS || [])
      .filter(function (p) { return p.active !== false; })
      .map(function (p) {
        var s = p.name + ' (' + p.code + '): ' + p.vol + ' ml, ' + (p.cat || '') +
                ', olcu ' + p.dim + ' mm, koli ' + p.box + ' adet';
        if (p.lid) s += ', PET kapakli';
        if (p.note) s += '. ' + p.note;
        return '- ' + s;
      }).join('\n');

    return [
      'Sen VITREA Asistan\'sin: vitreaplas.com sitesinin Turkce konusan yardimcisisin.',
      'VITREAPLAS, sutlu tatlilar (sutlac, kazandibi, supangle, trilece, magnolia, profiterol) icin',
      'kristal berrakliginda PS govde ve PET kapakli ambalajlar sunar. Satis toptan/koli bazindadir.',
      '',
      'URUN LISTESI:',
      urunler,
      '',
      'KURALLAR:',
      '- Her zaman Turkce, dogal, kibar ve kisa yaz. Sorulmayan bilgiyi yigma.',
      '- Fiyat sorulursa net rakam verme; fiyatlar teklifle netlesir, "Teklif Al" formuna yonlendir.',
      '- Israr etme, abartili vaatte bulunma. Emin olmadigin konuda uydurma; iletisim bolumune yonlendir.',
      '- Siparis, numune, kargo ve odeme detaylari icin iletisim formunu veya telefonu oner.',
      '- Konu disi sorulara nazikce kisa cevap ver ve ambalaj konusuna don.'
    ].join('\n');
  }

  /* ---------- stil ---------- */
  var css = [
    '.vbot-btn{position:fixed;right:22px;bottom:22px;z-index:999;width:56px;height:56px;border-radius:50%;',
    'background:#C0703C;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45);',
    'display:flex;align-items:center;justify-content:center;transition:transform .2s}',
    '.vbot-btn:hover{transform:scale(1.07)}',
    '.vbot-panel{position:fixed;right:22px;bottom:90px;z-index:999;width:min(360px,calc(100vw - 32px));',
    'height:min(520px,calc(100vh - 120px));background:#131316;border:1px solid #2a2a2e;border-radius:16px;',
    'display:none;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.6);',
    'font-family:"Inter Tight",system-ui,sans-serif}',
    '.vbot-panel.acik{display:flex}',
    '.vbot-head{padding:14px 18px;background:#0C0C0E;border-bottom:1px solid #2a2a2e;display:flex;align-items:center;gap:10px}',
    '.vbot-head b{color:#F2EFE9;font-weight:600;font-size:15px}',
    '.vbot-head span{color:#8a8a90;font-size:12px}',
    '.vbot-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}',
    '.vbot-m{max-width:85%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap}',
    '.vbot-m.bot{background:#1d1d21;color:#F2EFE9;align-self:flex-start;border-bottom-left-radius:4px}',
    '.vbot-m.ben{background:#C0703C;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.vbot-in{display:flex;gap:8px;padding:12px;border-top:1px solid #2a2a2e;background:#0C0C0E}',
    '.vbot-in input{flex:1;background:#1d1d21;border:1px solid #2a2a2e;border-radius:10px;padding:10px 12px;',
    'color:#F2EFE9;font-size:14px;outline:none}',
    '.vbot-in input:focus{border-color:#C0703C}',
    '.vbot-in button{background:#C0703C;border:none;border-radius:10px;padding:0 16px;color:#fff;cursor:pointer;font-size:14px}',
    '.vbot-in button:disabled{opacity:.5;cursor:default}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- arayuz ---------- */
  var btn = document.createElement('button');
  btn.className = 'vbot-btn'; btn.setAttribute('aria-label', 'Sohbet asistanini ac');
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'vbot-panel';
  panel.innerHTML =
    '<div class="vbot-head"><b>VITREA Asistan</b><span>ambalaj sorulariniz icin</span></div>' +
    '<div class="vbot-msgs" id="vbotMsgs"></div>' +
    '<div class="vbot-in"><input id="vbotIn" type="text" placeholder="Sorunuzu yazin..." maxlength="500">' +
    '<button id="vbotSend">Gonder</button></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('#vbotMsgs');
  var giris = panel.querySelector('#vbotIn');
  var gonderBtn = panel.querySelector('#vbotSend');
  var gecmis = [];   // {role:'user'|'model', text:...}

  function ekle(rol, metin) {
    var d = document.createElement('div');
    d.className = 'vbot-m ' + (rol === 'ben' ? 'ben' : 'bot');
    d.textContent = metin;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  btn.addEventListener('click', function () {
    panel.classList.toggle('acik');
    if (panel.classList.contains('acik') && !msgs.children.length) {
      ekle('bot', 'Merhaba! Sutlu tatli ambalajlarimizla ilgili sorularinizi cevaplayabilirim. Hangi tatli icin ambalaj ariyorsunuz?');
      giris.focus();
    }
  });

  function gonder() {
    var metin = giris.value.trim();
    if (!metin || gonderBtn.disabled) return;
    giris.value = '';
    ekle('ben', metin);
    gecmis.push({ role: 'user', text: metin });
    gonderBtn.disabled = true;
    var bekle = ekle('bot', '...');

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: sistemTalimati(), messages: gecmis.slice(-12) })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var cevap = (j && j.text) ? j.text : 'Su an cevap veremiyorum, lutfen iletisim formunu kullanin.';
        bekle.textContent = cevap;
        gecmis.push({ role: 'model', text: cevap });
      })
      .catch(function () {
        bekle.textContent = 'Baglanti sorunu olustu. Lutfen daha sonra tekrar deneyin veya iletisim formunu kullanin.';
      })
      .then(function () { gonderBtn.disabled = false; giris.focus(); });
  }

  gonderBtn.addEventListener('click', gonder);
  giris.addEventListener('keydown', function (e) { if (e.key === 'Enter') gonder(); });
})();
