/* Whip Cowboy — core/menu.js : in-page context menu styled like a native macOS menu.
 * Items: { label, emoji?, checked?, hint?, badge?, disabled?, action?, submenu?: Item[] } or { sep: true }. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U;

  class Menu {
    constructor(stage, scope) {
      this.stage = stage;
      this.scope = scope;
      this.el = null;
      this.subEl = null;
      this.ls = null;
      scope.add(() => this.close());
    }

    get isOpen() {
      return !!this.el;
    }

    open(x, y, items) {
      this.close();
      const ls = (this.ls = this.scope.child());
      this.dark = this.stage.isDarkPage();
      const el = (this.el = this._panel(items, false));
      this._position(el, x, y, null);
      const inside = (e) => e.composedPath().some((n) => n === this.el || n === this.subEl);
      ls.listen(document, 'pointerdown', (e) => { if (!inside(e)) this.close(); }, true);
      ls.listen(window, 'keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation(); // don't let claude.ai see this Escape
          e.preventDefault();
          this.close();
        }
      }, true);
      ls.listen(window, 'blur', () => this.close());
      ls.listen(window, 'resize', () => this.close());
    }

    close() {
      if (this.ls) this.ls.dispose();
      this.ls = null;
      this._closeSub();
      if (this.el) this.el.remove();
      this.el = null;
    }

    _closeSub() {
      if (this.subEl) this.subEl.remove();
      this.subEl = null;
      if (this.subOwner) this.subOwner.classList.remove('open');
      this.subOwner = null;
    }

    _position(el, x, y, avoidRect) {
      el.style.visibility = 'hidden';
      this.stage.ui.appendChild(el);
      const w = el.offsetWidth, h = el.offsetHeight, { vw, vh } = this.stage;
      let left = x, top = y;
      if (avoidRect) {
        left = avoidRect.right - 2;
        top = avoidRect.top - 5;
        if (left + w > vw - 4) left = avoidRect.left - w + 2;
      } else if (left + w > vw - 4) left = x - w;
      if (top + h > vh - 4) top = Math.max(4, vh - h - 4);
      el.style.transform = `translate(${Math.round(U.clamp(left, 4, vw - w - 4))}px, ${Math.round(top)}px)`;
      el.style.visibility = '';
    }

    _panel(items, isSub) {
      const el = document.createElement('div');
      el.className = 'wc-menu' + (this.dark ? ' dark' : '');
      el.setAttribute('role', 'menu');
      // Never take focus away from the chat input.
      el.addEventListener('pointerdown', (e) => e.preventDefault());
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      for (const it of items) {
        if (it.sep) {
          const s = document.createElement('div');
          s.className = 'wc-sep';
          el.appendChild(s);
          continue;
        }
        const row = document.createElement('div');
        row.className = 'wc-mi' + (it.disabled ? ' disabled' : '');
        row.setAttribute('role', 'menuitem');
        const span = (cls, text) => {
          const s = document.createElement('span');
          s.className = cls;
          s.textContent = text || '';
          row.appendChild(s);
          return s;
        };
        span('wc-check', it.checked ? '✓' : '');
        if (it.emoji !== undefined) span('wc-emoji', it.emoji);
        span('wc-label', it.label);
        if (it.badge) span('wc-badge', it.badge);
        if (it.hint) span('wc-hint', it.hint);
        if (it.submenu) span('wc-arrow', '▸');
        row.addEventListener('mouseenter', () => {
          if (isSub) return;
          if (it.submenu && !it.disabled) {
            if (this.subOwner === row) return;
            this._closeSub();
            this.subOwner = row;
            row.classList.add('open');
            this.subEl = this._panel(it.submenu, true);
            this._position(this.subEl, 0, 0, row.getBoundingClientRect());
          } else this._closeSub();
        });
        row.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (it.disabled || it.submenu) return;
          this.close();
          if (it.action) {
            try { it.action(); } catch (err) { console.error('[WhipCowboy] menu action', err); }
          }
        });
        el.appendChild(row);
      }
      return el;
    }
  }

  WC.Menu = Menu;
})();
