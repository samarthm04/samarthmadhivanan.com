/* Samarth's Assistant — floating widget.
   Contact capture is a real validated form, never parsed out of model output. */
(function () {
  if (window.__saLoaded) return;
  window.__saLoaded = true;

  var CONV_KEY = 'sa_conv';
  var GREETING =
    "Hi — I'm Samarth's assistant. Ask me about his work, or leave a message and he'll get back to you.";

  var CODES = [
    ['+91', 'IN'], ['+1', 'US'], ['+44', 'UK'], ['+61', 'AU'], ['+65', 'SG'],
    ['+971', 'AE'], ['+49', 'DE'], ['+33', 'FR'], ['+31', 'NL'], ['+81', 'JP'],
    ['+86', 'CN'], ['+27', 'ZA'], ['+55', 'BR'], ['+64', 'NZ'], ['+353', 'IE'],
    ['+41', 'CH'], ['+46', 'SE'], ['+34', 'ES'], ['+39', 'IT'], ['+7', 'RU']
  ];

  var conversationId = null;
  try { conversationId = sessionStorage.getItem(CONV_KEY); } catch (e) {}

  var lastId = 0;
  var open = false;
  var busy = false;
  var handover = false;
  var started = false;
  var locked = false;
  var lastVisitorText = '';
  var pollTimer = null;

  /* ── build ── */
  var root = document.createElement('div');
  root.className = 'sa-root';
  root.innerHTML =
    '<div class="sa-panel" role="dialog" aria-label="Chat with Samarth\'s assistant">' +
      '<div class="sa-head">' +
        '<span class="sa-head-dot"></span>' +
        '<div class="sa-head-txt">' +
          '<div class="sa-head-title">Samarth\'s Assistant</div>' +
          '<div class="sa-head-sub" data-sub>Usually replies in 24h</div>' +
        '</div>' +
        '<button class="sa-close" type="button" aria-label="Close chat">✕</button>' +
      '</div>' +
      '<div class="sa-log" data-log></div>' +
      '<div class="sa-input-row">' +
        '<input type="text" data-input placeholder="Ask something…" maxlength="1000" aria-label="Your message">' +
        '<button class="sa-send" type="button" data-send aria-label="Send">➜</button>' +
      '</div>' +
      '<div class="sa-foot">AI assistant · not Samarth himself</div>' +
    '</div>' +
    '<button class="sa-blob" type="button" aria-label="Chat with Samarth\'s assistant">' +
      '<i></i><i></i><i></i><b>S</b><span class="sa-badge"></span>' +
    '</button>';
  document.body.appendChild(root);

  var panel = root.querySelector('.sa-panel');
  var log = root.querySelector('[data-log]');
  var input = root.querySelector('[data-input]');
  var sendBtn = root.querySelector('[data-send]');
  var blob = root.querySelector('.sa-blob');
  var sub = root.querySelector('[data-sub]');

  /* ── rendering ── */
  function scroll() { log.scrollTop = log.scrollHeight; }

  function bubble(role, text, who) {
    var el = document.createElement('div');
    el.className = 'sa-msg ' + role;
    if (who) {
      var w = document.createElement('div');
      w.className = 'sa-who';
      w.textContent = who;
      el.appendChild(w);
    }
    var body = document.createElement('div');
    body.textContent = text;
    el.appendChild(body);
    log.appendChild(el);
    scroll();
    return el;
  }

  function note(text) {
    var el = document.createElement('div');
    el.className = 'sa-note';
    el.textContent = text;
    log.appendChild(el);
    scroll();
  }

  function typing(on) {
    var existing = log.querySelector('.sa-typing');
    if (!on) { if (existing) existing.remove(); return; }
    if (existing) return;
    var el = document.createElement('div');
    el.className = 'sa-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(el);
    scroll();
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    input.disabled = on;
  }

  /* The assistant ended it, or the visitor hit a rate limit. Stop accepting input. */
  function lock(reason) {
    locked = true;
    input.disabled = true;
    sendBtn.disabled = true;
    input.value = '';
    input.placeholder = '';
    note(reason);
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ── network ── */
  async function post(url, payload) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    return { ok: res.ok, status: res.status, data: data };
  }

  function remember(id) {
    if (!id || id === conversationId) return;
    conversationId = id;
    try { sessionStorage.setItem(CONV_KEY, id); } catch (e) {}
  }

  /* ── the note form (deterministic; the model never fills this in) ── */
  function showForm() {
    if (log.querySelector('.sa-form')) return;

    var form = document.createElement('div');
    form.className = 'sa-form';
    var options = CODES.map(function (c) {
      return '<option value="' + c[0] + '">' + c[0] + ' ' + c[1] + '</option>';
    }).join('');

    form.innerHTML =
      '<h4>Leave it with me</h4>' +
      '<div class="sa-form-sub">Samarth will pick this up himself.</div>' +
      '<div class="sa-hp" aria-hidden="true">' +
        '<input type="text" id="saWebsite" tabindex="-1" autocomplete="off" placeholder="Website"></div>' +
      '<div class="sa-field"><label for="saNote">What should I pass on?</label>' +
        '<textarea id="saNote" maxlength="2000"></textarea></div>' +
      '<div class="sa-field"><label for="saName">Your name</label>' +
        '<input id="saName" type="text" maxlength="100" autocomplete="name"></div>' +
      '<div class="sa-field"><label for="saEmail">Email</label>' +
        '<input id="saEmail" type="email" maxlength="200" autocomplete="email" placeholder="you@company.com"></div>' +
      '<div class="sa-field"><label for="saPhone">Phone (optional)</label>' +
        '<div class="sa-phone">' +
          '<select id="saCode" aria-label="Country code">' + options + '</select>' +
          '<input id="saPhone" type="tel" maxlength="20" autocomplete="tel" placeholder="98765 43210">' +
        '</div></div>' +
      '<div class="sa-err" data-err></div>' +
      '<div class="sa-form-actions">' +
        '<button class="sa-btn" type="button" data-submit>Send to Samarth</button>' +
        '<button class="sa-btn ghost" type="button" data-cancel>Not now</button>' +
      '</div>';

    log.appendChild(form);
    form.querySelector('#saNote').value = lastVisitorText;
    scroll();

    var err = form.querySelector('[data-err]');
    var submit = form.querySelector('[data-submit]');

    form.querySelector('[data-cancel]').addEventListener('click', function () {
      form.remove();
      note('No problem — ask me anything else.');
    });

    submit.addEventListener('click', async function () {
      var payload = {
        conversationId: conversationId,
        note: form.querySelector('#saNote').value.trim(),
        name: form.querySelector('#saName').value.trim(),
        email: form.querySelector('#saEmail').value.trim(),
        phone: form.querySelector('#saPhone').value.trim(),
        countryCode: form.querySelector('#saCode').value,
        website: form.querySelector('#saWebsite').value
      };

      if (payload.name.length < 2) { err.textContent = 'A name helps.'; return; }
      if (!payload.note) { err.textContent = 'Tell me what to pass on.'; return; }
      if (!payload.email && !payload.phone) {
        err.textContent = 'An email or phone, so he can reply.'; return;
      }
      err.textContent = '';
      submit.disabled = true;
      submit.textContent = 'Sending…';

      var result;
      try {
        result = await post('/api/lead', payload);
      } catch (e) {
        result = { ok: false, data: {} };
      }

      if (!result.ok) {
        err.textContent = result.data.error || 'Could not send. Email samarthm04edu@gmail.com directly.';
        submit.disabled = false;
        submit.textContent = 'Send to Samarth';
        return;
      }

      form.remove();

      /* Abusive submission — the server has already closed the conversation. */
      if (result.data.closed) {
        lock('This conversation has ended.');
        return;
      }

      /* Read the note back so they can see exactly what was taken down. */
      var summary = 'Noted:\n' + payload.note + '\n\n' + payload.name;
      if (payload.email) summary += '\n' + payload.email;
      if (payload.phone) summary += '\n' + payload.countryCode + ' ' + payload.phone;
      bubble('bot', summary, 'Your message');
      bubble('bot', "That's with Samarth. He'll get back to you as soon as possible — usually within 24 hours.");
      startPolling();
    });
  }

  /* ── sending ── */
  async function send(text) {
    if (busy || locked || !text) return;
    lastVisitorText = text;
    bubble('visitor', text);
    input.value = '';
    setBusy(true);
    typing(true);

    var result;
    try {
      result = await post('/api/chat', { conversationId: conversationId, message: text });
    } catch (e) {
      result = { ok: false, data: {} };
    }

    typing(false);
    setBusy(false);
    input.focus();

    if (!result.ok && !result.data.reply) {
      bubble('bot', "I can't reach my brain right now. Email samarthm04edu@gmail.com and Samarth will pick it up.");
      return;
    }

    remember(result.data.conversationId);
    if (typeof result.data.lastId === 'number') lastId = Math.max(lastId, result.data.lastId);

    if (result.data.handover) {
      setHandover(true);
      note('Samarth is reading this — hang on.');
      startPolling();
      return;
    }

    if (result.data.reply) bubble('bot', result.data.reply);

    if (result.data.closed) { lock('This conversation has ended.'); return; }
    if (result.data.throttled) { lock('Paused — try again in a little while.'); return; }

    if (result.data.takeNote) showForm();
    startPolling();
  }

  function setHandover(on) {
    if (handover === on) return;
    handover = on;
    sub.textContent = on ? 'Samarth is here' : 'Usually replies in 24h';
  }

  /* ── polling for Samarth's replies ── */
  async function poll() {
    if (!conversationId) return;
    try {
      var res = await fetch('/api/messages?conversationId=' + encodeURIComponent(conversationId) + '&since=' + lastId);
      if (!res.ok) return;
      var data = await res.json();
      setHandover(!!data.handover);

      (data.messages || []).forEach(function (m) {
        if (m.id <= lastId) return;
        lastId = m.id;
        if (m.role === 'samarth') {
          bubble('samarth', m.content, 'Samarth');
          if (!open) root.classList.add('has-unread');
        }
      });
      if (typeof data.lastId === 'number') lastId = Math.max(lastId, data.lastId);
    } catch (e) { /* offline — try again next tick */ }
  }

  function startPolling() {
    if (pollTimer || !conversationId) return;
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      poll();
    }, open ? 5000 : 20000);
  }

  /* ── open / close ── */
  function toggle(next) {
    open = typeof next === 'boolean' ? next : !open;
    root.classList.toggle('is-open', open);
    if (open) {
      root.classList.remove('has-unread');
      if (!started) {
        started = true;
        bubble('bot', GREETING);
      }
      setTimeout(function () { input.focus(); }, 60);
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      startPolling();
    }
  }

  blob.addEventListener('click', function () { toggle(); });
  root.querySelector('.sa-close').addEventListener('click', function () { toggle(false); });
  sendBtn.addEventListener('click', function () { send(input.value.trim()); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); send(input.value.trim()); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) toggle(false);
  });

  if (conversationId) startPolling();
})();
