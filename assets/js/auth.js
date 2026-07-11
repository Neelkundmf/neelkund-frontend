/* =========================================================================
 * NEELKUND MICROFINANCE — auth.js
 * Engine File 4 of 4  |  Login, session & permission logic
 *
 * এটা "দারোয়ান"। কে লগইন করেছে, তার role কী, সে কোন মেনু দেখতে পাবে,
 * টোকেনের মেয়াদ আছে কি না — সব এই ফাইল সামলায়।
 *
 * Load order: config.js → theme.js → api.js → auth.js
 * ========================================================================= */

(function () {
  "use strict";

  if (!window.NK) throw new Error("[NK] auth.js: config.js আগে লোড করতে হবে।");
  if (!window.NK.api) throw new Error("[NK] auth.js: api.js আগে লোড করতে হবে।");

  var NK = window.NK;
  var S = NK.STORAGE;

  /* JWT-এর ভেতরের তথ্য পড়া (verify নয় — শুধু পড়া) */
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

  /* লগইনের উত্তর থেকে ইউজারের তথ্য বের করা (ব্যাকএন্ড যেভাবেই পাঠাক) */
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
      /* ব্যাকএন্ডে ফোন নম্বরই লগইন-পরিচয় (JWT-এর sub = phone) */
      phone: data.phone || claims.sub || "",
      fullName: data.fullName || data.name || data.phone || claims.sub || "",
      role: role,
      branchId: data.branchId !== undefined ? data.branchId : claims.branchId || null,
      branchName: data.branchName || "",
      email: data.email || "",
    };
  }

  var auth = {
    /* -------------------------------------------------------------------
     * LOGIN — ফোন নম্বর + পাসওয়ার্ড
     * ----------------------------------------------------------------- */
    login: function (phone, password) {
      return NK.api.auth
        .login(phone, password)
        .then(function (data) {
          if (!data) throw NK.api.ApiError(500, "সার্ভার কোনো উত্তর দেয়নি।");

          NK.api.saveTokens(data);
          var token = localStorage.getItem(S.ACCESS_TOKEN);
          if (!token) throw NK.api.ApiError(500, "টোকেন পাওয়া যায়নি।");

          var user = normalizeUser(data, token);
          localStorage.setItem(S.USER, JSON.stringify(user));
          if (user.branchId) localStorage.setItem(S.BRANCH, String(user.branchId));

          /* পারমিশন আনার চেষ্টা — না পেলে ডিফল্ট ম্যাট্রিক্স চলবে */
          return auth.loadPermissions().then(function () {
            return user;
          });
        });
    },

    /* -------------------------------------------------------------------
     * LOGOUT
     * ----------------------------------------------------------------- */
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
    getToken: function () {
      return NK.api.getAccessToken();
    },

    getUser: function () {
      return readJson(S.USER, null);
    },

    getRole: function () {
      var u = auth.getUser();
      return u ? u.role : "";
    },

    getBranchId: function () {
      var b = localStorage.getItem(S.BRANCH);
      return b ? b : null;
    },

    /* Admin ব্যাঞ্চ সুইচার এই ফাংশনটা ব্যবহার করবে */
    setBranchId: function (branchId) {
      if (branchId === null || branchId === undefined || branchId === "") {
        localStorage.removeItem(S.BRANCH);
      } else {
        localStorage.setItem(S.BRANCH, String(branchId));
      }
    },

    isAdmin: function () {
      return auth.getRole() === NK.ROLES.ADMIN;
    },

    /* টোকেনের মেয়াদ শেষ কি না */
    isTokenExpired: function () {
      var claims = decodeJwt(auth.getToken());
      if (!claims || !claims.exp) return false; // exp না থাকলে সার্ভারকেই সিদ্ধান্ত নিতে দিই
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
          localStorage.setItem(S.PERMISSIONS, JSON.stringify(keys));
          return keys;
        })
        .catch(function () {
          /* সার্ভার থেকে না এলে role-এর ডিফল্ট ব্যবহার করি — মেনু ফাঁকা হবে না */
          var role = auth.getRole();
          var def = NK.DEFAULT_PERMISSIONS[role];
          var keys =
            def === "*"
              ? NK.PERMISSION_KEYS.map(function (p) {
                  return p.key;
                })
              : def || [];
          localStorage.setItem(S.PERMISSIONS, JSON.stringify(keys));
          return keys;
        });
    },

    getPermissions: function () {
      var stored = readJson(S.PERMISSIONS, null);
      if (stored && stored.length) return stored;

      var role = auth.getRole();
      var def = NK.DEFAULT_PERMISSIONS[role];
      if (def === "*") {
        return NK.PERMISSION_KEYS.map(function (p) {
          return p.key;
        });
      }
      return def || [];
    },

    can: function (key) {
      if (auth.isAdmin()) return true; // Admin সব পারে
      return auth.getPermissions().indexOf(key) !== -1;
    },

    canAny: function (keys) {
      return (keys || []).some(function (k) {
        return auth.can(k);
      });
    },

    /* -------------------------------------------------------------------
     * PAGE GUARDS — প্রতিটি ভেতরের পেজের একদম উপরে ডাকতে হবে
     *   NK.auth.requireAuth();                       // শুধু লগইন লাগবে
     *   NK.auth.requireAuth({ permission: "LOAN_MANAGE" });
     *   NK.auth.requireAuth({ roles: ["ADMIN","MANAGER"] });
     * ----------------------------------------------------------------- */
    requireAuth: function (opts) {
      opts = opts || {};

      if (!auth.isLoggedIn() || auth.isTokenExpired()) {
        NK.api.clearTokens();
        window.location.replace(NK.ROUTES.LOGIN + "?expired=1");
        return false;
      }

      if (opts.roles && opts.roles.length) {
        if (opts.roles.indexOf(auth.getRole()) === -1) {
          auth.denied();
          return false;
        }
      }

      if (opts.permission && !auth.can(opts.permission)) {
        auth.denied();
        return false;
      }

      return true;
    },

    denied: function () {
      if (NK.theme) NK.theme.toast("এই পাতায় ঢোকার অনুমতি আপনার নেই।", "error");
      setTimeout(function () {
        window.location.replace(auth.homePage());
      }, 1200);
    },

    /* role অনুযায়ী নিজের ড্যাশবোর্ড */
    homePage: function () {
      return NK.ROLE_HOME[auth.getRole()] || NK.ROUTES.LOGIN;
    },

    goHome: function () {
      window.location.href = auth.homePage();
    },

    /* login.html-এর উপরে ডাকুন — আগে থেকে লগইন থাকলে সোজা ড্যাশবোর্ডে পাঠাবে */
    redirectIfLoggedIn: function () {
      if (auth.isLoggedIn() && !auth.isTokenExpired()) {
        window.location.replace(auth.homePage());
        return true;
      }
      return false;
    },

    /* -------------------------------------------------------------------
     * MENU / UI HELPERS
     * ----------------------------------------------------------------- */
    /* HTML-এ data-perm="LOAN_MANAGE" লিখে দিলে অনুমতি না থাকলে
     * সেই মেনু/বোতাম নিজে থেকেই লুকিয়ে যাবে */
    applyPermissionsToDom: function (root) {
      NK.utils.qsa("[data-perm]", root || document).forEach(function (el) {
        var need = el.getAttribute("data-perm");
        if (!auth.can(need)) el.style.display = "none";
      });
      NK.utils.qsa("[data-role]", root || document).forEach(function (el) {
        var roles = el.getAttribute("data-role").split(",").map(function (r) {
          return r.trim().toUpperCase();
        });
        if (roles.indexOf(auth.getRole()) === -1) el.style.display = "none";
      });
    },

    /* হেডারে নাম/role/আদ্যক্ষর বসায় (id: nk-user-name, nk-user-role, nk-user-initials) */
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

    /* এক লাইনে পুরো পেজ সেটআপ:
     *   NK.auth.initPage({ permission: "REPORT_VIEW" });  */
    initPage: function (opts) {
      if (!auth.requireAuth(opts)) return false;
      NK.theme.init();
      auth.paintUserBox();
      auth.applyPermissionsToDom();
      auth.startExpiryWatch();
      return true;
    },

    /* প্রতি ৬০ সেকেন্ডে দেখে টোকেনের মেয়াদ শেষ কি না */
    startExpiryWatch: function () {
      if (auth._watch) return;
      auth._watch = setInterval(function () {
        if (auth.isLoggedIn() && auth.isTokenExpired()) {
          NK.api
            .refreshTokens()
            .catch(function () {
              clearInterval(auth._watch);
              auth._watch = null;
              NK.api.clearTokens();
              window.location.replace(NK.ROUTES.LOGIN + "?expired=1");
            });
        }
      }, 60000);
    },

    decodeJwt: decodeJwt,
  };

  NK.auth = auth;
  if (NK.DEBUG) console.log("[NK] auth loaded");
})();
