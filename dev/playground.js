/* Dev playground: a fake claude.ai page + a localStorage "host" instead of chrome.storage.
 * Open dev/playground.html directly in a browser (file://) — no extension needed. */
(() => {
  const WC = globalThis.WhipCowboy;
  const KEY = 'whipcowboy-playground';
  const load = () => {
    try { return Object.assign({}, WC.config.defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return Object.assign({}, WC.config.defaults); }
  };
  let S = load();
  let app = null;
  const host = {
    save(partial) {
      S = Object.assign({}, S, partial);
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* ignore */ }
      setTimeout(apply, 0); // mimic async chrome.storage.onChanged
      return Promise.resolve();
    },
  };
  function apply() {
    if (S.enabled && !app) app = WC.createApp(host, S);
    else if (!S.enabled && app) { app.dispose(); app = null; }
    else if (app) app.update(S);
    document.getElementById('lang').checked = S.lang === 'en';
    document.getElementById('debug').checked = !!S.debug;
  }
  window.wcPlayground = { get app() { return app; }, host, get S() { return S; } };

  // ---- fake streaming ----
  const chat = document.getElementById('chat');
  const send = document.getElementById('send');
  const WORDS = 'Okay so first I will read every file then I will think very hard about naming and then I will rename everything twice just to be sure and also add some tests that test the tests'.split(' ');
  let timer = 0, msg = null;
  function startStreaming(ms) {
    stopStreaming();
    const u = document.createElement('div');
    u.className = 'user';
    u.textContent = document.getElementById('input').value || 'Do the thing.';
    chat.appendChild(u);
    msg = document.createElement('div');
    msg.className = 'font-claude-response';
    msg.dataset.isStreaming = 'true';
    chat.appendChild(msg);
    send.setAttribute('aria-label', 'Stop response');
    send.textContent = '■';
    let i = 0;
    timer = setInterval(() => {
      msg.textContent += WORDS[i++ % WORDS.length] + ' ';
      window.scrollTo(0, document.body.scrollHeight);
    }, 180);
    if (ms) setTimeout(stopStreaming, ms);
  }
  function stopStreaming() {
    clearInterval(timer);
    if (msg) msg.dataset.isStreaming = 'false';
    send.setAttribute('aria-label', 'Send message');
    send.textContent = '↑';
  }
  document.getElementById('start').onclick = () => startStreaming(0);
  document.getElementById('long').onclick = () => startStreaming(30000);
  document.getElementById('stop').onclick = stopStreaming;
  send.onclick = () => (send.getAttribute('aria-label') === 'Stop response' ? stopStreaming() : startStreaming(8000));
  document.getElementById('dark').onclick = () => document.body.classList.toggle('dark');
  document.getElementById('lang').onchange = (e) => host.save({ lang: e.target.checked ? 'en' : 'de' });
  document.getElementById('debug').onchange = (e) => host.save({ debug: e.target.checked });
  document.getElementById('reset').onclick = () => host.save({ position: null });
  document.getElementById('enable').onclick = () => host.save({ enabled: true });

  document.getElementById('ev').onchange = (e) => { if (app && e.target.value) app.handleMessage({ type: 'wc:event', id: e.target.value }); e.target.value = ''; };
  document.getElementById('sound').onchange = (e) => host.save({ sound: e.target.checked });
  document.getElementById('name').onchange = (e) => host.save(e.target.value ? { nameMode: 'custom', customName: e.target.value } : { nameMode: 'auto', customName: '' });

  apply();
})();
