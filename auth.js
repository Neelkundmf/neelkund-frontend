/* =========================================================================
 * NEELKUND MICROFINANCE — auth.js  (v2 — চক্র/blink বন্ধ করা সংস্করণ)
 *
 * আগের সংস্করণে সমস্যা ছিল: অনুমতি না মিললে denied() নিজেই
 * নিজের পাতায় ফেরত পাঠাত → পাতা বারবার রিলোড → blink।
 * এখানে তিনটে "চক্র-রোধক" বসানো হয়েছে:
 *   ১. একই পাতায় ফেরত পাঠানো নিষিদ্ধ
 *   ২. প্রতি পাতা-লোডে সর্বোচ্চ একবার redirect
 *   ৩. কেন বেরিয়ে গেল, তার কারণ login পাতায় দেখাবে
 *
 * Load order: config.js → theme.js → api.js → auth.js
 * ========================================================================= */

(function () {
  "use strict";

  if (!window.NK) throw new Error("[NK] auth.js: config.js আগে লোড করতে হবে।");
  if (!window.NK.api) throw new Error("[NK] auth.js: api.js আগে লোড করতে হবে।");

  var NK = window.NK;
  var S = NK.STORAGE;

  /* ---------------------------------------------------------------------
   * চক্র-রোধক
   * ------------------------------------------------------------------- */
  var didRedirect = false; // এই পাতা-লোডে একবারই redirect

  function currentPage() {
    var p = (window.location.pathname || "").split("/").pop();
    return (p || "index.html").toLowerCase();
  }

  function samePage(target) {
    return String(target || "").toLowerCase().split("?")[0] === currentPage();
  }

  /* নিরাপদ redirect — একই পাতায় হলে যায় না, দুবারও যায় না */
  function go(target, reason) {
    if (didRedirect) {
      console.warn("[NK] redirect আটকানো হল (একবারই যায়):", target, reason);
      return false;
    }
    if (samePage(target)) {
      console.warn("[NK] redirect আটকানো হল (একই পাতা):", target, reason);
      if (NK.theme && reason) NK.theme.toast(reason, "error", 6000);
      return false;
    }
    didRedirect = true;
    if (reason) {
      try { sessionStorage.setItem("nk_logout_reason", reason); } catch (e) {}
    }
    window.location.replace(target);
    return true;
  }

  /* login পাতা এই কারণটা পড়ে দেখাতে পারে */
  function takeReason() {
    try {
      var r = sessionStorage.getItem("nk_logout_reason");
      sessionStorage.removeItem("nk_logout_reason");
      return r || "";
    } catch (e) { return ""; }
  }

  /* ---------------------------------------------------------------------
   * JWT পড়া (verify নয় — শুধু পড়া)
   * ------------------------------------------------------------------- */
  function decodeJwt(token) {
    try {
      var part = String(token).split(".")[1];
      if (!part) return null;
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
      var json = decodeURIComponent(
        atob(b64 + new Array(pad + 1).join("="))
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function normalizeUser(data, token) {
    var claims = decodeJwt(token) || {};
    var role =
      data.role ||
      data.userRole ||
      claims.role ||
      (claims.authorities && claims.authorities[0]) ||
      (claims.roles && claims.roles[0]) ||
      "";
    role = String(role).replace(/^ROLE_/, "").toUpperCase();

    return {
      id: data.id || data.userId || claims.uid || null,
      phone: data.phone || claims.sub || "",
      fullName: data.fullName || data.name || data.phone || claims.sub || "",
      role: role,
      branchId: data.branchId !== undefined ? data.branchId : claims.branchId || null,
      branchName: data.branchName || "",
      email: data.email || "",
    };
  }

  var auth = {
    takeLogoutReason: takeReason,

    /* -------------------------------------------------------------------
     * LOGIN
     * ----------------------------------------------------------------- */
    login: function (phone, password) {
      return NK.api.auth.login(phone, password).then(function (data) {
        if (!data) throw NK.api.ApiError(500, "সার্ভার কোনো উত্তর দেয়নি।");

        NK.api.saveTokens(data);
        var token = localStorage.getItem(S.ACCESS_TOKEN);
        if (!token) throw NK.api.ApiError(500, "টোকেন পাওয়া যায়নি।");

        var user = normalizeUser(data, token);
        if (!user.role) user.role = "ADMIN"; /* role না এলেও আটকে থাকবে না */

        localStorage.setItem(S.USER, JSON.stringify(user));
        if (user.branchId) localStorage.setItem(S.BRANCH, String(user.branchId));

        return auth.loadPermissions().then(function () {
          return user;
        });
      });
    },

    logout: function (silent) {
      return NK.api.auth.logoutServer().then(function () {
        NK.api.clearTokens();
        localStorage.removeItem(S.BRANCH);
        if (!silent) window.location.href = NK.ROUTES.LOGIN;
      });
    },

    /* -------------------------------------------------------------------
     * SESSION
     * ----------------------------------------------------------------- */
    getToken: function () { return NK.api.getAccessToken(); },
    getUser: function () { return readJson(S.USER, null); },
    getRole: function () { var u = auth.getUser(); return u ? u.role : ""; },
    getBranchId: function () { return localStorage.getItem(S.BRANCH) || null; },
    setBranchId: function (b) {
      if (b === null || b === undefined || b === "") localStorage.removeItem(S.BRANCH);
      else localStorage.setItem(S.BRANCH, String(b));
    },
    isAdmin: function () { return auth.getRole() === NK.ROLES.ADMIN; },

    isTokenExpired: function () {
      var claims = decodeJwt(auth.getToken());
      if (!claims || !claims.exp) return false;
      return Date.now() >= claims.exp * 1000;
    },

    isLoggedIn: function () {
      return !!auth.getToken() && !!auth.getUser();
    },

    /* -------------------------------------------------------------------
     * PERMISSIONS
     * ----------------------------------------------------------------- */
    loadPermissions: function () {
      return NK.api.permissions
        .mine()
        .then(function (data) {
          var keys = Array.isArray(data)
            ? data
            : (data && (data.permissions || data.keys)) || [];
          if (!keys.length) throw new Error("empty");
          localStorage.setItem(S.PERMISSIONS, JSON.stringify(keys));
          return keys;
        })
        .catch(function () {
          var role = auth.getRole();
          var def = NK.DEFAULT_PERMISSIONS[role];
          var keys =
            def === "*"
              ? NK.PERMISSION_KEYS.map(function (p) { return p.key; })
              : def || [];
          localStorage.setItem(S.PERMISSIONS, JSON.stringify(keys));
          return keys;
        });
    },

    getPermissions: function () {
      var stored = readJson(S.PERMISSIONS, null);
      if (stored && stored.length) return stored;
      var def = NK.DEFAULT_PERMISSIONS[auth.getRole()];
      if (def === "*") return NK.PERMISSION_KEYS.map(function (p) { return p.key; });
      return def || [];
    },

    can: function (key) {
      if (auth.isAdmin()) return true;
      return auth.getPermissions().indexOf(key) !== -1;
    },

    canAny: function (keys) {
      return (keys || []).some(function (k) { return auth.can(k); });
    },

    /* -------------------------------------------------------------------
     * PAGE GUARD — চক্র-নিরাপদ
     * ----------------------------------------------------------------- */
    requireAuth: function (opts) {
      opts = opts || {};

      if (!auth.isLoggedIn() || auth.isTokenExpired()) {
        NK.api.clearTokens();
        go(NK.ROUTES.LOGIN, "লগইনের মেয়াদ শেষ। আবার লগইন করুন।");
        return false;
      }

      if (opts.roles && opts.roles.length) {
        if (opts.roles.indexOf(auth.getRole()) === -1) {
          auth.denied("এই পাতাটি " + opts.roles.join("/") + "-এর জন্য।");
          return false;
        }
      }

      if (opts.permission && !auth.can(opts.permission)) {
        auth.denied("এই পাতায় ঢোকার অনুমতি নেই (" + opts.permission + ")।");
        return false;
      }

      return true;
    },

    /* আর কখনও নিজের পাতায় ফেরত পাঠাবে না */
    denied: function (why) {
      var msg = why || "এই পাতায় ঢোকার অনুমতি আপনার নেই।";
      var home = auth.homePage();

      if (samePage(home)) {
        if (NK.theme) NK.theme.toast(msg, "error", 6000);
        console.warn("[NK] denied, কিন্তু এটাই নিজের হোম পাতা — চক্র এড়াতে থামলাম।");
        return;
      }
      if (NK.theme) NK.theme.toast(msg, "error");
      setTimeout(function () { go(home, msg); }, 1200);
    },

    homePage: function () {
      return NK.ROLE_HOME[auth.getRole()] || NK.ROUTES.LOGIN;
    },

    goHome: function () {
      var home = auth.homePage();
      if (samePage(home)) return;
      window.location.href = home;
    },

    /* login.html-এ ডাকা হয় — নিজের পাতায় হলে যাবে না */
    redirectIfLoggedIn: function () {
      if (!auth.isLoggedIn() || auth.isTokenExpired()) return false;
      var home = auth.homePage();
      if (samePage(home)) return false;
      return go(home, null);
    },

    /* -------------------------------------------------------------------
     * UI HELPERS
     * ----------------------------------------------------------------- */
    applyPermissionsToDom: function (root) {
      NK.utils.qsa("[data-perm]", root || document).forEach(function (el) {
        if (!auth.can(el.getAttribute("data-perm"))) el.style.display = "none";
      });
      NK.utils.qsa("[data-role]", root || document).forEach(function (el) {
        var roles = el.getAttribute("data-role").split(",").map(function (r) {
          return r.trim().toUpperCase();
        });
        if (roles.indexOf(auth.getRole()) === -1) el.style.display = "none";
      });
    },

    paintUserBox: function () {
      var u = auth.getUser();
      if (!u) return;
      NK.utils.setText("#nk-user-name", u.fullName || u.phone);
      NK.utils.setText("#nk-user-role", NK.ROLE_LABELS[u.role] || u.role);
      NK.utils.setText("#nk-user-initials", NK.utils.initials(u.fullName));
      var btn = NK.utils.qs("#nk-logout");
      if (btn) {
        NK.utils.on(btn, "click", function (e) {
          e.preventDefault();
          auth.logout();
        });
      }
    },

    initPage: function (opts) {
      if (!auth.requireAuth(opts)) return false;
      NK.theme.init();
      auth.paintUserBox();
      auth.applyPermissionsToDom();
      auth.startExpiryWatch();
      return true;
    },

    startExpiryWatch: function () {
      if (auth._watch) return;
      auth._watch = setInterval(function () {
        if (auth.isLoggedIn() && auth.isTokenExpired()) {
          NK.api.refreshTokens().catch(function () {
            clearInterval(auth._watch);
            auth._watch = null;
            NK.api.clearTokens();
            go(NK.ROUTES.LOGIN, "লগইনের মেয়াদ শেষ।");
          });
        }
      }, 60000);
    },

    decodeJwt: decodeJwt,
  };

  NK.auth = auth;
  if (NK.DEBUG) console.log("[NK] auth v2 loaded");
})();
