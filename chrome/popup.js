/* Whip Cowboy — chrome/popup.js : toolbar popup (Chrome glue). Reads/writes chrome.storage.sync. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const defaults = WC.config.defaults;
  let S = Object.assign({}, defaults);
  const $ = (sel) => document.querySelector(sel);
  const status = $('#status');

  const fmtSpeed = (v) => (Math.round(v * 100) / 100).toString().replace('.', S.lang === 'de' ? ',' : '.') + '×';

  function render() {
    document.documentElement.lang = S.lang;
    document.body.classList.toggle('disabled', !S.enabled);
    document.querySelectorAll('[data-i18n]').forEach((n) => (n.textContent = WC.i18n.popup(S.lang, n.dataset.i18n)));
    document.querySelectorAll('[data-key]').forEach((n) => {
      const v = S[n.dataset.key];
      if (n.type === 'checkbox') n.checked = !!v;
      else n.value = v;
    });
    $('#speed').textContent = fmtSpeed(S.speed);
    $('#volume').value = Math.round((Number(S.volume) || 0) * 100);
    $('#volume').disabled = !S.sound;
    $('#customRow').style.display = S.nameMode === 'custom' ? '' : 'none';
    $('#customName').placeholder = WC.i18n.popup(S.lang, 'namePlaceholder');
    const sites = Object.assign({}, defaults.sites, S.sites);
    document.querySelectorAll('[data-site]').forEach((n) => (n.checked = sites[n.dataset.site] !== false));
  }

  function save(partial) {
    Object.assign(S, partial);
    render();
    return chrome.storage.sync.set(partial);
  }

  function say(msg, err) {
    status.textContent = msg;
    status.classList.toggle('err', !!err);
  }

  document.querySelectorAll('[data-key]').forEach((n) => {
    n.addEventListener('change', () => {
      const k = n.dataset.key;
      let v;
      if (n.type === 'checkbox') v = n.checked;
      else if (n.type === 'text') v = n.value.trim().slice(0, 24);
      else if (n.type === 'number') v = Math.max(3, Math.min(600, Number(n.value) || defaults[k]));
      else v = n.value;
      save({ [k]: v });
    });
  });

  const clampSpeed = (v) => Math.max(0.25, Math.min(4, Math.round(v * 100) / 100));
  $('#faster').addEventListener('click', () => save({ speed: clampSpeed(S.speed * 1.25) }));
  $('#slower').addEventListener('click', () => save({ speed: clampSpeed(S.speed * 0.75) }));
  $('#volume').addEventListener('input', (e) => save({ volume: Number(e.target.value) / 100 }));
  document.querySelectorAll('[data-site]').forEach((n) =>
    n.addEventListener('change', () => save({ sites: Object.assign({}, defaults.sites, S.sites, { [n.dataset.site]: n.checked }) }))
  );
  $('#resetPos').addEventListener('click', () => save({ position: null }));

  async function sendToTab(msg) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) throw new Error('no tab');
    return chrome.tabs.sendMessage(tab.id, msg);
  }

  $('#test').addEventListener('click', async () => {
    say('');
    try {
      if (!S.enabled) {
        await save({ enabled: true });
        await new Promise((r) => setTimeout(r, 400)); // let the page boot the cowboy
      }
      const res = await sendToTab({ type: 'wc:test' });
      if (res && res.ok) say(WC.i18n.popup(S.lang, 'testing'));
      else say(WC.i18n.popup(S.lang, 'noTab'), true);
    } catch (_) {
      say(WC.i18n.popup(S.lang, 'noTab'), true);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const k in changes) S[k] = changes[k].newValue === undefined ? defaults[k] : changes[k].newValue;
    render();
  });

  chrome.storage.sync.get(defaults).then((v) => {
    S = Object.assign({}, defaults, v);
    render();
  });
  render();
})();
