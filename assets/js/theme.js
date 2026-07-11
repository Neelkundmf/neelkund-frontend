/* =========================================================================
 * NEELKUND MICROFINANCE — theme.js
 * Engine File 2 of 4  |  NK.utils + NK.theme + base stylesheet
 *
 * এই ফাইল তিনটে কাজ করে:
 *   ১. ফন্ট ও পুরো অ্যাপের CSS নিজে থেকেই বসিয়ে দেয়
 *   ২. NK.utils — ছোট ছোট কাজের সরঞ্জাম (qs, money, date, ...)
 *   ৩. NK.theme — টোস্ট, মডাল, লোডিং
 *
 * Load order: config.js → theme.js → api.js → auth.js
 * ========================================================================= */

(function () {
  "use strict";

  if (!window.NK) throw new Error("[NK] theme.js: config.js আগে লোড করতে হবে।");
  var NK = window.NK;

  /* =======================================================================
   * ১. লোগো ফলব্যাক — ছবি না পেলে assets/logo.png ব্যবহার করবে
   * ===================================================================== */
  document.addEventListener(
    "error",
    function (e) {
      var el = e.target;
      if (el && el.tagName === "IMG" && !el.dataset.nkFallbackDone) {
        el.dataset.nkFallbackDone = "1";
        el.src = "assets/logo.png";
      }
    },
    true
  );

  /* =======================================================================
   * ২. ফন্ট + বেস CSS
   * ===================================================================== */
  function injectHead() {
    if (document.getElementById("nk-base-style")) return;

    var f = document.createElement("link");
    f.rel = "stylesheet";
    f.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap";
    document.head.appendChild(f);

    var s = document.createElement("style");
    s.id = "nk-base-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var CSS = [
    ":root{",
    "--nk-navy:#102A40;--nk-navy-dark:#0A1C2B;--nk-red:#E12A1F;",
    "--nk-paper:#F6F4EF;--nk-border:#DCD7CC;--nk-muted:#5E6B78;",
    "--nk-green:#1E8E5A;--nk-amber:#C98A00;--nk-white:#FFFFFF;}",

    "*{box-sizing:border-box;}",
    "body{font-family:'Hind Siliguri',system-ui,sans-serif;color:#12212E;}",
    ".nk-bn{font-family:'Hind Siliguri',sans-serif;}",

    ".nk-label{display:block;font-size:13px;font-weight:600;color:var(--nk-navy);",
    "margin-bottom:6px;font-family:'Hind Siliguri',sans-serif;}",

    ".nk-input,.nk-select,.nk-textarea{width:100%;padding:12px 14px;font-size:15px;",
    "border:1px solid var(--nk-border);border-radius:9px;background:#fff;",
    "font-family:'Hind Siliguri',sans-serif;outline:none;color:#12212E;}",
    ".nk-input:focus,.nk-select:focus,.nk-textarea:focus{border-color:var(--nk-navy);",
    "box-shadow:0 0 0 3px rgba(16,42,64,.10);}",

    ".nk-btn{display:inline-block;padding:11px 18px;font-size:14.5px;font-weight:600;",
    "border:1px solid transparent;border-radius:9px;cursor:pointer;",
    "font-family:'Hind Siliguri',sans-serif;transition:background .15s;}",
    ".nk-btn:disabled{opacity:.6;cursor:not-allowed;}",
    ".nk-btn-primary{background:var(--nk-navy);color:#fff;}",
    ".nk-btn-primary:hover:not(:disabled){background:#1B3E5C;}",
    ".nk-btn-danger{background:var(--nk-red);color:#fff;}",
    ".nk-btn-ghost{background:#fff;color:var(--nk-navy);border-color:var(--nk-border);}",

    ".nk-card{background:#fff;border:1px solid var(--nk-border);border-radius:12px;padding:20px;}",
    ".nk-table{width:100%;border-collapse:collapse;font-size:14px;background:#fff;}",
    ".nk-table th{text-align:left;padding:11px 12px;background:#F0EDE6;color:var(--nk-navy);",
    "font-weight:600;border-bottom:1px solid var(--nk-border);}",
    ".nk-table td{padding:11px 12px;border-bottom:1px solid #EDEAE3;}",

    ".nk-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;}",
    ".nk-badge-green{background:#E4F3EA;color:var(--nk-green);}",
    ".nk-badge-amber{background:#FBF1DA;color:var(--nk-amber);}",
    ".nk-badge-red{background:#FBE5E3;color:#B71E15;}",
    ".nk-badge-grey{background:#ECEFF2;color:var(--nk-muted);}",

    "#nk-toast-wrap{position:fixed;top:18px;right:18px;z-index:9999;display:flex;",
    "flex-direction:column;gap:10px;}",
    ".nk-toast{min-width:240px;max-width:360px;padding:12px 16px;border-radius:9px;",
    "font-size:14px;line-height:1.5;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);",
    "animation:nkSlide .2s ease-out;}",
    ".nk-toast-success{background:var(--nk-green);}",
    ".nk-toast-error{background:var(--nk-red);}",
    ".nk-toast-info{background:var(--nk-navy);}",
    ".nk-toast-warn{background:var(--nk-amber);}",
    "@keyframes nkSlide{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}",

    "#nk-loading{position:fixed;inset:0;z-index:9998;background:rgba(10,28,43,.45);",
    "display:none;align-items:center;justify-content:center;}",
    "#nk-loading.open{display:flex;}",
    ".nk-spinner{width:44px;height:44px;border:4px solid rgba(255,255,255,.3);",
    "border-top-color:#fff;border-radius:50%;animation:nkSpin .8s linear infinite;}",
    "@keyframes nkSpin{to{transform:rotate(360deg);}}",

    "@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}",
  ].join("");

  /* =======================================================================
   * ৩. NK.utils — ছোট সরঞ্জাম
   * ===================================================================== */
  var utils = {
    qs: function (sel, root) {
      return (root || document).querySelector(sel);
    },
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },
    on: function (el, evt, fn) {
      if (el) el.addEventListener(evt, fn);
    },
    setText: function (sel, text) {
      var el = typeof sel === "string" ? utils.qs(sel) : sel;
      if (el) el.textContent = text == null ? "" : String(text);
    },
    setHtml: function (sel, html) {
      var el = typeof sel === "string" ? utils.qs(sel) : sel;
      if (el) el.innerHTML = html == null ? "" : html;
    },
    escape: function (str) {
      var d = document.createElement("div");
      d.textContent = str == null ? "" : String(str);
      return d.innerHTML;
    },

    /* টাকা: 12345 → ₹12,345 */
    money: function (n) {
      var v = Number(n || 0);
      try {
        return "₹" + v.toLocaleString(NK.LOCALE, { maximumFractionDigits: 0 });
      } catch (e) {
        return "₹" + v;
      }
    },

    /* আজকের তারিখ: 2026-07-11 */
    today: function () {
      var d = new Date();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    },

    /* "2026-07-11" → "11 Jul 2026" */
    date: function (v) {
      if (!v) return "—";
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      try {
        return d.toLocaleDateString(NK.LOCALE, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch (e) {
        return String(v);
      }
    },

    dateTime: function (v) {
      if (!v) return "—";
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      try {
        return d.toLocaleString(NK.LOCALE, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return String(v);
      }
    },

    /* {a:1, b:"x"} → "?a=1&b=x"  (খালি হলে "") */
    query: function (obj) {
      if (!obj) return "";
      var parts = [];
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (v === undefined || v === null || v === "") return;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      });
      return parts.length ? "?" + parts.join("&") : "";
    },

    /* "Rajkumar Das" → "RD" */
    initials: function (name) {
      var s = String(name || "").trim();
      if (!s) return "?";
      var w = s.split(/\s+/);
      if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
      return (w[0][0] + w[w.length - 1][0]).toUpperCase();
    },

    /* ভারতীয় ১০ সংখ্যার মোবাইল */
    isPhone: function (v) {
      return /^[6-9]\d{9}$/.test(String(v || "").replace(/\D/g, ""));
    },

    isEmail: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
    },

    badge: function (text, tone) {
      return (
        '<span class="nk-badge nk-badge-' +
        (tone || "grey") +
        '">' +
        utils.escape(text) +
        "</span>"
      );
    },

    debounce: function (fn, ms) {
      var t;
      return function () {
        var self = this,
          a = arguments;
        clearTimeout(t);
        t = setTimeout(function () {
          fn.apply(self, a);
        }, ms || 300);
      };
    },
  };

  /* =======================================================================
   * ৪. NK.theme — টোস্ট, লোডিং, মডাল
   * ===================================================================== */
  function ensureToastWrap() {
    var w = document.getElementById("nk-toast-wrap");
    if (!w) {
      w = document.createElement("div");
      w.id = "nk-toast-wrap";
      document.body.appendChild(w);
    }
    return w;
  }

  function ensureLoading() {
    var l = document.getElementById("nk-loading");
    if (!l) {
      l = document.createElement("div");
      l.id = "nk-loading";
      l.innerHTML = '<div class="nk-spinner"></div>';
      document.body.appendChild(l);
    }
    return l;
  }

  var theme = {
    init: function () {
      injectHead();
      if (document.body) {
        ensureToastWrap();
        ensureLoading();
      }
      return true;
    },

    /* NK.theme.toast("জমা হয়েছে", "success") */
    toast: function (message, type, ms) {
      if (!document.body) return;
      var wrap = ensureToastWrap();
      var t = document.createElement("div");
      t.className = "nk-toast nk-toast-" + (type || "info");
      t.textContent = message;
      wrap.appendChild(t);
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, ms || 3500);
    },

    loading: function (show) {
      var l = ensureLoading();
      if (show) l.classList.add("open");
      else l.classList.remove("open");
    },

    /* বোতামে "অপেক্ষা করুন" দেখানো */
    btnLoading: function (btn, on, busyText) {
      if (!btn) return;
      if (on) {
        btn.dataset.nkOldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = busyText || "অপেক্ষা করুন...";
      } else {
        btn.disabled = false;
        if (btn.dataset.nkOldText) btn.textContent = btn.dataset.nkOldText;
      }
    },

    /* Promise<boolean> ফেরত দেয় */
    confirm: function (message) {
      return Promise.resolve(window.confirm(message));
    },
  };

  /* ---- হুক আপ ---- */
  injectHead();
  NK.utils = utils;
  NK.theme = theme;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      theme.init();
    });
  } else {
    theme.init();
  }

  if (NK.DEBUG) console.log("[NK] theme loaded");
})();
