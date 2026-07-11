/* =========================================================================
 * NEELKUND MICROFINANCE — api.js
 * Engine File 3 of 4  |  API call handlers
 *
 * এটা অ্যাপের "বার্তাবাহক"। সার্ভারে যা কিছু পাঠানো বা আনার দরকার,
 * সব এই ফাইলের মাধ্যমে যায়। এটা নিজে থেকেই তিনটে কঠিন কাজ সামলায়:
 *   ১. প্রতিটি রিকোয়েস্টে লগইন টোকেন জুড়ে দেয়
 *   ২. টোকেনের মেয়াদ শেষ হলে ব্যাকগ্রাউন্ডে নতুন টোকেন এনে কাজ চালিয়ে যায়
 *   ৩. ভুল হলে বাংলায় বোধগম্য মেসেজ দেয়
 *
 * Load order: config.js → theme.js → api.js → auth.js
 * ========================================================================= */

(function () {
  "use strict";

  if (!window.NK) throw new Error("[NK] api.js: config.js আগে লোড করতে হবে।");
  var NK = window.NK;
  var S = NK.STORAGE;

  /* ট্রান্সলেশন: HTTP কোড → বাংলা মেসেজ */
  var HTTP_MSG = {
    0: "সার্ভারে পৌঁছানো যাচ্ছে না। ইন্টারনেট দেখুন।",
    400: "তথ্যে ভুল আছে। আবার দেখে নিন।",
    401: "লগইনের মেয়াদ শেষ। আবার লগইন করুন।",
    403: "এই কাজটি করার অনুমতি আপনার নেই।",
    404: "যা খুঁজছেন তা পাওয়া যায়নি।",
    409: "এই তথ্য আগে থেকেই আছে (ডুপ্লিকেট)।",
    422: "তথ্য গ্রহণযোগ্য নয়।",
    429: "অনেক বেশি চেষ্টা হয়েছে। কিছুক্ষণ পরে দেখুন।",
    500: "সার্ভারে সমস্যা হয়েছে।",
    502: "সার্ভার এখন সাড়া দিচ্ছে না।",
    503: "সার্ভার ঘুম থেকে উঠছে, একটু অপেক্ষা করুন।",
    504: "সার্ভার সময়মতো উত্তর দিল না।",
  };

  /* কাস্টম error object — .status, .message, .data থাকে */
  function ApiError(status, message, data) {
    var e = new Error(message || HTTP_MSG[status] || "অজানা সমস্যা হয়েছে।");
    e.name = "ApiError";
    e.status = status;
    e.data = data || null;
    return e;
  }

  /* ---- টোকেন হেল্পার ---- */
  function getAccess() {
    return localStorage.getItem(S.ACCESS_TOKEN) || "";
  }
  function getRefresh() {
    return localStorage.getItem(S.REFRESH_TOKEN) || "";
  }
  function saveTokens(data) {
    if (!data) return;
    var a = data.accessToken || data.token || data.access_token;
    var r = data.refreshToken || data.refresh_token;
    if (a) localStorage.setItem(S.ACCESS_TOKEN, a);
    if (r) localStorage.setItem(S.REFRESH_TOKEN, r);
  }
  function clearTokens() {
    localStorage.removeItem(S.ACCESS_TOKEN);
    localStorage.removeItem(S.REFRESH_TOKEN);
    localStorage.removeItem(S.USER);
    localStorage.removeItem(S.PERMISSIONS);
  }

  /* URL বানানো: "/api/loans/{id}" + {id:5} → "/api/loans/5" */
  function buildUrl(path, params, query) {
    var p = String(path);
    if (params) {
      Object.keys(params).forEach(function (k) {
        p = p.replace("{" + k + "}", encodeURIComponent(params[k]));
      });
    }
    var qs = query ? NK.utils.query(query) : "";
    return NK.API_BASE_URL + p + qs;
  }

  /* সার্ভারের error body থেকে আসল মেসেজ বের করা */
  function extractMessage(body, status) {
    if (!body) return HTTP_MSG[status] || "সমস্যা হয়েছে।";
    if (typeof body === "string") return body;
    if (body.message) return body.message;
    if (body.error) return body.error;
    if (body.errors && body.errors.length) {
      return body.errors
        .map(function (e) {
          return e.defaultMessage || e.message || String(e);
        })
        .join(", ");
    }
    return HTTP_MSG[status] || "সমস্যা হয়েছে।";
  }

  /* -----------------------------------------------------------------------
   * টোকেন রিফ্রেশ — single flight
   * একসাথে ৫টা রিকোয়েস্ট 401 খেলেও শুধু একবারই refresh কল হবে,
   * বাকিরা সেই একই প্রতিশ্রুতির জন্য অপেক্ষা করবে।
   * --------------------------------------------------------------------- */
  var refreshPromise = null;

  function refreshTokens() {
    if (refreshPromise) return refreshPromise;

    var rt = getRefresh();
    if (!rt) return Promise.reject(ApiError(401, HTTP_MSG[401]));

    refreshPromise = fetch(NK.API_BASE_URL + NK.ENDPOINTS.REFRESH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(function (res) {
        if (!res.ok) throw ApiError(401, HTTP_MSG[401]);
        return res.json();
      })
      .then(function (data) {
        saveTokens(data);
        refreshPromise = null;
        return data;
      })
      .catch(function (err) {
        refreshPromise = null;
        clearTokens();
        throw err;
      });

    return refreshPromise;
  }

  /* -----------------------------------------------------------------------
   * মূল রিকোয়েস্ট ফাংশন
   * --------------------------------------------------------------------- */
  function request(method, path, options) {
    options = options || {};
    var url = buildUrl(path, options.params, options.query);
    var isForm = options.body instanceof FormData;
    var attempted = false;

    function fire() {
      var headers = { Accept: "application/json" };
      if (!isForm) headers["Content-Type"] = "application/json";
      if (options.headers) {
        Object.keys(options.headers).forEach(function (k) {
          headers[k] = options.headers[k];
        });
      }
      var token = getAccess();
      if (token && !options.skipAuth) headers.Authorization = "Bearer " + token;

      var controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller
        ? setTimeout(function () {
            controller.abort();
          }, NK.NET.TIMEOUT_MS)
        : null;

      var init = { method: method, headers: headers };
      if (controller) init.signal = controller.signal;
      if (options.body !== undefined && options.body !== null) {
        init.body = isForm ? options.body : JSON.stringify(options.body);
      }

      return fetch(url, init)
        .catch(function () {
          if (timer) clearTimeout(timer);
          throw ApiError(0, HTTP_MSG[0]);
        })
        .then(function (res) {
          if (timer) clearTimeout(timer);

          /* 401 → একবার রিফ্রেশ করে আবার চেষ্টা */
          if (res.status === 401 && !attempted && !options.skipAuth && getRefresh()) {
            attempted = true;
            return refreshTokens().then(fire, function () {
              onSessionExpired();
              throw ApiError(401, HTTP_MSG[401]);
            });
          }

          /* 204 No Content */
          if (res.status === 204) return null;

          var ct = res.headers.get("content-type") || "";
          var parse = ct.indexOf("application/json") !== -1
            ? res.json().catch(function () {
                return null;
              })
            : res.text().catch(function () {
                return null;
              });

          return parse.then(function (body) {
            if (!res.ok) {
              if (res.status === 401) onSessionExpired();
              throw ApiError(res.status, extractMessage(body, res.status), body);
            }
            return body;
          });
        });
    }

    return fire();
  }

  /* সেশন শেষ হলে লগইন পেজে ফেরত */
  function onSessionExpired() {
    clearTokens();
    var here = (window.location.pathname || "").toLowerCase();
    if (here.indexOf(NK.ROUTES.LOGIN.toLowerCase()) === -1) {
      window.location.href = NK.ROUTES.LOGIN + "?expired=1";
    }
  }

  /* -----------------------------------------------------------------------
   * PUBLIC API
   * --------------------------------------------------------------------- */
  var api = {
    ApiError: ApiError,
    buildUrl: buildUrl,
    saveTokens: saveTokens,
    clearTokens: clearTokens,
    getAccessToken: getAccess,
    getRefreshToken: getRefresh,
    refreshTokens: refreshTokens,

    /* সাধারণ মেথড */
    get: function (path, opts) {
      return request("GET", path, opts);
    },
    post: function (path, body, opts) {
      opts = opts || {};
      opts.body = body;
      return request("POST", path, opts);
    },
    put: function (path, body, opts) {
      opts = opts || {};
      opts.body = body;
      return request("PUT", path, opts);
    },
    patch: function (path, body, opts) {
      opts = opts || {};
      opts.body = body;
      return request("PATCH", path, opts);
    },
    del: function (path, opts) {
      return request("DELETE", path, opts);
    },

    /* ফাইল/ছবি আপলোড (KYC ডকুমেন্ট, গ্রাহকের ছবি) */
    upload: function (file, extra) {
      var fd = new FormData();
      fd.append("file", file);
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          fd.append(k, extra[k]);
        });
      }
      return request("POST", NK.ENDPOINTS.UPLOAD, { body: fd });
    },

    /* ভুল হলে টোস্টে দেখানোর শর্টকাট */
    handleError: function (err) {
      var msg = (err && err.message) || "অজানা সমস্যা হয়েছে।";
      if (NK.theme) NK.theme.toast(msg, "error");
      if (NK.DEBUG) console.error("[NK api]", err);
      return msg;
    },

    /* =====================================================================
     * RESOURCE SHORTCUTS — পেজ থেকে সরাসরি ডাকা যায়
     * ===================================================================*/
    auth: {
      /* ব্যাকএন্ড ফোন নম্বর চায় (LoginRequest: phone + password) */
      login: function (phone, password) {
        return api.post(
          NK.ENDPOINTS.LOGIN,
          { phone: phone, password: password },
          { skipAuth: true }
        );
      },
      logoutServer: function () {
        return api.post(NK.ENDPOINTS.LOGOUT, {}).catch(function () {
          return null; /* সার্ভার না পারলেও লোকাল লগআউট হবেই */
        });
      },
      me: function () {
        return api.get(NK.ENDPOINTS.ME);
      },

      /* ইমেলে রিসেট লিংক পাঠাও */
      forgotPassword: function (email) {
        return api.post(
          NK.ENDPOINTS.FORGOT_PASSWORD,
          { email: email },
          { skipAuth: true }
        );
      },

      /* টোকেন + নতুন পাসওয়ার্ড পাঠাও */
      resetPassword: function (token, newPassword) {
        return api.post(
          NK.ENDPOINTS.RESET_PASSWORD,
          { token: token, newPassword: newPassword },
          { skipAuth: true }
        );
      },
    },

    customers: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.CUSTOMERS, { query: query });
      },
      get: function (id) {
        return api.get(NK.ENDPOINTS.CUSTOMER_BY_ID, { params: { id: id } });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.CUSTOMERS, data);
      },
      update: function (id, data) {
        return api.put(NK.ENDPOINTS.CUSTOMER_BY_ID, data, { params: { id: id } });
      },
      remove: function (id) {
        return api.del(NK.ENDPOINTS.CUSTOMER_BY_ID, { params: { id: id } });
      },
      kyc: function (id, data) {
        return api.put(NK.ENDPOINTS.CUSTOMER_KYC, data, { params: { id: id } });
      },
      photo: function (id, file) {
        var fd = new FormData();
        fd.append("file", file);
        return request("POST", NK.ENDPOINTS.CUSTOMER_PHOTO, {
          params: { id: id },
          body: fd,
        });
      },
    },

    loans: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.LOANS, { query: query });
      },
      get: function (id) {
        return api.get(NK.ENDPOINTS.LOAN_BY_ID, { params: { id: id } });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.LOANS, data);
      },
      schedule: function (id) {
        return api.get(NK.ENDPOINTS.LOAN_SCHEDULE, { params: { id: id } });
      },
      close: function (id) {
        return api.post(NK.ENDPOINTS.LOAN_CLOSE, {}, { params: { id: id } });
      },
    },

    payments: {
      /* যেকোনো অঙ্কের টাকা জমা — আংশিক বা অগ্রিম, দুটোই চলবে */
      collect: function (loanId, amount, note) {
        return api.post(NK.ENDPOINTS.PAYMENTS, {
          loanId: loanId,
          amount: Number(amount),
          note: note || "",
          paidOn: NK.utils.today(),
        });
      },
      status: function (loanId) {
        return api.get(NK.ENDPOINTS.PAYMENT_STATUS, { params: { id: loanId } });
      },
      byLoan: function (loanId) {
        return api.get(NK.ENDPOINTS.PAYMENTS_BY_LOAN, { params: { id: loanId } });
      },
      today: function (query) {
        return api.get(NK.ENDPOINTS.PAYMENTS_TODAY, { query: query });
      },
    },

    defaulters: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.DEFAULTERS, { query: query });
      },
    },

    agents: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.AGENTS, { query: query });
      },
      customers: function (id) {
        return api.get(NK.ENDPOINTS.AGENT_CUSTOMERS, { params: { id: id } });
      },
    },

    salaries: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.SALARIES, { query: query });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.SALARIES, data);
      },
      update: function (id, data) {
        return api.put(NK.ENDPOINTS.SALARY_BY_ID, data, { params: { id: id } });
      },
      remove: function (id) {
        return api.del(NK.ENDPOINTS.SALARY_BY_ID, { params: { id: id } });
      },
    },

    expenses: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.EXPENSES, { query: query });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.EXPENSES, data);
      },
      update: function (id, data) {
        return api.put(NK.ENDPOINTS.EXPENSE_BY_ID, data, { params: { id: id } });
      },
      remove: function (id) {
        return api.del(NK.ENDPOINTS.EXPENSE_BY_ID, { params: { id: id } });
      },
    },

    funds: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.FUNDS, { query: query });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.FUNDS, data);
      },
      balance: function (query) {
        return api.get(NK.ENDPOINTS.FUND_BALANCE, { query: query });
      },
    },

    users: {
      list: function (query) {
        return api.get(NK.ENDPOINTS.USERS, { query: query });
      },
      get: function (id) {
        return api.get(NK.ENDPOINTS.USER_BY_ID, { params: { id: id } });
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.USERS, data);
      },
      update: function (id, data) {
        return api.put(NK.ENDPOINTS.USER_BY_ID, data, { params: { id: id } });
      },
      remove: function (id) {
        return api.del(NK.ENDPOINTS.USER_BY_ID, { params: { id: id } });
      },
    },

    branches: {
      list: function () {
        return api.get(NK.ENDPOINTS.BRANCHES);
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.BRANCHES, data);
      },
      update: function (id, data) {
        return api.put(NK.ENDPOINTS.BRANCH_BY_ID, data, { params: { id: id } });
      },
    },

    permissions: {
      all: function () {
        return api.get(NK.ENDPOINTS.PERMISSIONS);
      },
      mine: function () {
        return api.get(NK.ENDPOINTS.MY_PERMISSIONS);
      },
      byRole: function (role) {
        return api.get(NK.ENDPOINTS.PERMISSIONS_BY_ROLE, { params: { role: role } });
      },
      save: function (role, keys) {
        return api.put(
          NK.ENDPOINTS.PERMISSIONS_BY_ROLE,
          { permissions: keys },
          { params: { role: role } }
        );
      },
    },

    reports: {
      summary: function (query) {
        return api.get(NK.ENDPOINTS.REPORT_SUMMARY, { query: query });
      },
      pnl: function (query) {
        return api.get(NK.ENDPOINTS.REPORT_PNL, { query: query });
      },
    },

    accessRules: {
      list: function () {
        return api.get(NK.ENDPOINTS.ACCESS_RULES);
      },
      create: function (data) {
        return api.post(NK.ENDPOINTS.ACCESS_RULES, data);
      },
      remove: function (id) {
        return api.del(NK.ENDPOINTS.ACCESS_RULES + "/" + id);
      },
    },

    audit: {
      logs: function (query) {
        return api.get(NK.ENDPOINTS.AUDIT_LOGS, { query: query });
      },
      logins: function (query) {
        return api.get(NK.ENDPOINTS.LOGIN_LOGS, { query: query });
      },
    },

    about: function () {
      return api.get(NK.ENDPOINTS.ABOUT, { skipAuth: true });
    },

    /* সার্ভার ঘুমিয়ে থাকলে জাগানোর জন্য (login পেজে ডাকুন) */
    wake: function () {
      return api.about().catch(function () {
        return null;
      });
    },
  };

  NK.api = api;
  if (NK.DEBUG) console.log("[NK] api loaded");
})();
