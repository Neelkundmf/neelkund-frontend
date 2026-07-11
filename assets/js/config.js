/* =========================================================================
 * NEELKUND MICROFINANCE — config.js
 * Engine File 1 of 4  |  App configuration & constants
 *
 * এই ফাইলটাই পুরো অ্যাপের "কন্ট্রোল প্যানেল"।
 * সার্ভারের ঠিকানা, সব endpoint, সব enum, লোনের নিয়ম, permission —
 * সবকিছু এখানে একজায়গায়। অন্য কোনো ফাইলে হার্ডকোড করা নেই।
 *
 * Load order (প্রতিটি HTML পেজে এই ক্রমেই দিতে হবে):
 *   config.js  →  theme.js  →  api.js  →  auth.js  →  pages/*.js
 * ========================================================================= */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
   * 1. BACKEND ADDRESS — নিজে থেকেই বদলায়
   *    localhost এ টেস্ট করলে  → local server
   *    Render এ লাইভ হলে       → live server
   * --------------------------------------------------------------------- */
  var host = (window.location && window.location.hostname) || "";
  var IS_LOCAL =
    host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "";

  var API_BASE_URL = IS_LOCAL
    ? "http://localhost:8080"
    : "https://neelkund-backend.onrender.com";

  var NK = {
    /* ---------------------------------------------------------------------
     * APP INFO
     * ------------------------------------------------------------------- */
    APP_NAME: "NEELKUND",
    APP_TAGLINE_BN: "মাইক্রোফাইন্যান্স ম্যানেজমেন্ট সিস্টেম",
    APP_VERSION: "1.0.0",
    LOGO_PATH: "assets/img/Nil_Khund.png",
    LOCALE: "en-IN",
    CURRENCY: "INR",
    IS_LOCAL: IS_LOCAL,
    API_BASE_URL: API_BASE_URL,

    /* ---------------------------------------------------------------------
     * 2. ENDPOINTS — সব API ঠিকানা একজায়গায়
     *    ব্যাকএন্ডে কোনো path বদলালে শুধু এখানে বদলাবেন, আর কোথাও না।
     *    {id} লেখা জায়গায় NK.api নিজে থেকেই আসল id বসিয়ে নেবে।
     * ------------------------------------------------------------------- */
    ENDPOINTS: {
      /* Auth */
      LOGIN: "/api/auth/login",
      REFRESH: "/api/auth/refresh",
      LOGOUT: "/api/auth/logout",
      ME: "/api/auth/me",
      FORGOT_PASSWORD: "/api/auth/forgot-password",
      RESET_PASSWORD: "/api/auth/reset-password",

      /* Customers + KYC */
      CUSTOMERS: "/api/customers",
      CUSTOMER_BY_ID: "/api/customers/{id}",
      CUSTOMER_KYC: "/api/customers/{id}/kyc",
      CUSTOMER_PHOTO: "/api/customers/{id}/photo",

      /* Loans */
      LOANS: "/api/loans",
      LOAN_BY_ID: "/api/loans/{id}",
      LOAN_SCHEDULE: "/api/loans/{id}/schedule",
      LOAN_CLOSE: "/api/loans/{id}/close",

      /* Payments / Collection */
      PAYMENTS: "/api/payments",
      PAYMENT_STATUS: "/api/payments/loan/{id}/status",
      PAYMENTS_BY_LOAN: "/api/payments/loan/{id}",
      PAYMENTS_TODAY: "/api/payments/today",

      /* Defaulters */
      DEFAULTERS: "/api/defaulters",

      /* Agents */
      AGENTS: "/api/agents",
      AGENT_CUSTOMERS: "/api/agents/{id}/customers",

      /* Staff / Salary */
      SALARIES: "/api/salaries",
      SALARY_BY_ID: "/api/salaries/{id}",

      /* Expenses */
      EXPENSES: "/api/expenses",
      EXPENSE_BY_ID: "/api/expenses/{id}",

      /* Fund / Capital */
      FUNDS: "/api/funds",
      FUND_BALANCE: "/api/funds/balance",

      /* Users / Team */
      USERS: "/api/users",
      USER_BY_ID: "/api/users/{id}",

      /* Branches */
      BRANCHES: "/api/branches",
      BRANCH_BY_ID: "/api/branches/{id}",

      /* Permissions */
      PERMISSIONS: "/api/permissions",
      PERMISSIONS_BY_ROLE: "/api/permissions/{role}",
      MY_PERMISSIONS: "/api/permissions/me",

      /* Reports / P&L */
      REPORT_SUMMARY: "/api/reports/summary",
      REPORT_PNL: "/api/reports/pnl",

      /* Access control (holiday / time window) */
      ACCESS_RULES: "/api/access-rules",

      /* Audit / Login log */
      AUDIT_LOGS: "/api/admin/audit-logs",
      LOGIN_LOGS: "/api/admin/audit-logs/logins",

      /* Files */
      UPLOAD: "/api/files/upload",

      /* About (public) */
      ABOUT: "/api/about",
    },

    /* ---------------------------------------------------------------------
     * 3. LOCALSTORAGE KEYS
     * ------------------------------------------------------------------- */
    STORAGE: {
      ACCESS_TOKEN: "nk_access_token",
      REFRESH_TOKEN: "nk_refresh_token",
      USER: "nk_user",
      PERMISSIONS: "nk_permissions",
      BRANCH: "nk_active_branch",
    },

    /* ---------------------------------------------------------------------
     * 4. ROLES
     * ------------------------------------------------------------------- */
    ROLES: {
      ADMIN: "ADMIN",
      PARTNER: "PARTNER",
      MANAGER: "MANAGER",
      AGENT: "AGENT",
    },
    ROLE_LABELS: {
      ADMIN: "অ্যাডমিন",
      PARTNER: "পার্টনার",
      MANAGER: "ম্যানেজার",
      AGENT: "এজেন্ট",
    },

    /* লগইনের পর কে কোন পেজে যাবে */
    ROLE_HOME: {
      ADMIN: "admin-dashboard.html",
      PARTNER: "partner-dashboard.html",
      MANAGER: "manager-dashboard.html",
      AGENT: "agent-dashboard.html",
    },

    ROUTES: {
      LOGIN: "login.html",
      ABOUT: "about.html",
    },

    /* ---------------------------------------------------------------------
     * 5. ENUMS — ব্যাকএন্ডের সাথে হুবহু মিল, সাথে বাংলা লেবেল
     * ------------------------------------------------------------------- */
    KYC_STATUS: {
      PENDING: "যাচাই বাকি",
      VERIFIED: "যাচাই হয়েছে",
      REJECTED: "বাতিল",
    },

    LOAN_STATUS: {
      ACTIVE: "চলমান",
      CLOSED: "শোধ হয়ে গেছে",
      DEFAULTED: "খেলাপি",
    },

    EMI_STATUS: {
      PENDING: "বাকি",
      PAID: "জমা হয়েছে",
      OVERDUE: "সময় পার",
    },

    FLAG: {
      GREEN: "সবুজ — ঠিক আছে",
      YELLOW: "হলুদ — সতর্কতা",
      RED: "লাল — বিপদ",
    },

    PAYMENT_STANDING: {
      UP_TO_DATE: "আপ-টু-ডেট",
      BEHIND: "পিছিয়ে আছে",
      ADVANCE: "অগ্রিম জমা",
      CLOSED: "শোধ হয়ে গেছে",
    },

    EXPENSE_CATEGORY: {
      RENT: "ভাড়া",
      TRANSPORT: "যাতায়াত",
      UTILITIES: "বিদ্যুৎ/জল/বিল",
      OFFICE_SUPPLIES: "অফিস সামগ্রী",
      MARKETING: "বিজ্ঞাপন",
      MISCELLANEOUS: "বিবিধ",
    },

    FUND_TYPE: {
      DEPOSIT: "জমা (পুঁজি ঢালা)",
      WITHDRAWAL: "উত্তোলন",
    },

    SALARY_STATUS: {
      PENDING: "বাকি",
      PAID: "দেওয়া হয়েছে",
    },

    ACCESS_RULE_TYPE: {
      HOLIDAY: "ছুটির দিন",
      TIME_WINDOW: "সময়সীমা",
    },

    /* ---------------------------------------------------------------------
     * 6. LOAN RULES — ব্যাকএন্ডের নিয়মের হুবহু কপি
     *    শুধু এই ৫টা অঙ্কের লোন, ১৫% ফ্ল্যাট মার্কআপ, ৪৬ দিনের দৈনিক EMI
     * ------------------------------------------------------------------- */
    LOAN: {
      ALLOWED_PRINCIPALS: [2000, 4000, 6000, 8000, 10000],
      MARKUP_PERCENT: 15,
      TENURE_DAYS: 46,

      /* মোট ফেরতযোগ্য = আসল × ১.১৫ */
      totalRepayable: function (principal) {
        return Math.round(Number(principal) * 1.15);
      },
      /* দৈনিক কিস্তি = মোট ফেরতযোগ্য ÷ ৪৬ (উপরের দিকে গোল) */
      dailyEmi: function (principal) {
        return Math.ceil(NK.LOAN.totalRepayable(principal) / NK.LOAN.TENURE_DAYS);
      },
      /* লাভ = মোট ফেরতযোগ্য − আসল */
      profit: function (principal) {
        return NK.LOAN.totalRepayable(principal) - Number(principal);
      },
      isAllowed: function (principal) {
        return NK.LOAN.ALLOWED_PRINCIPALS.indexOf(Number(principal)) !== -1;
      },
    },

    /* খেলাপি ধরার সীমা (ব্যাকএন্ডের cron-এর সাথে মিল) */
    DEFAULTER_THRESHOLDS: {
      YELLOW_DAYS: 1,
      RED_DAYS: 46,
      AUTO_DEFAULT_DAYS: 90,
    },

    /* ---------------------------------------------------------------------
     * 7. PERMISSIONS — ১৮টি কী, বাংলা নাম সহ
     * ------------------------------------------------------------------- */
    PERMISSION_KEYS: [
      { key: "DASHBOARD_VIEW", label: "ড্যাশবোর্ড দেখা" },
      { key: "CUSTOMER_VIEW", label: "গ্রাহক দেখা" },
      { key: "CUSTOMER_MANAGE", label: "গ্রাহক যোগ/সম্পাদনা" },
      { key: "LOAN_VIEW", label: "লোন দেখা" },
      { key: "LOAN_MANAGE", label: "লোন দেওয়া/সম্পাদনা" },
      { key: "COLLECTION_VIEW", label: "কালেকশন দেখা" },
      { key: "COLLECTION_MANAGE", label: "টাকা জমা নেওয়া" },
      { key: "DEFAULTER_VIEW", label: "খেলাপি তালিকা" },
      { key: "AGENT_VIEW", label: "এজেন্ট দেখা" },
      { key: "AGENT_MANAGE", label: "এজেন্ট পরিচালনা" },
      { key: "SALARY_VIEW", label: "বেতন দেখা" },
      { key: "SALARY_MANAGE", label: "বেতন পরিচালনা" },
      { key: "EXPENSE_MANAGE", label: "খরচ পরিচালনা" },
      { key: "FUND_MANAGE", label: "ফান্ড/পুঁজি পরিচালনা" },
      { key: "REPORT_VIEW", label: "রিপোর্ট ও লাভ-ক্ষতি" },
      { key: "USER_MANAGE", label: "টিম/ইউজার পরিচালনা" },
      { key: "PERMISSION_MANAGE", label: "পারমিশন এডিটর" },
      { key: "AUDIT_VIEW", label: "লগইন লগ / অডিট" },
    ],

    /* ব্যাকএন্ড থেকে পারমিশন আনতে না পারলে এই ডিফল্ট ম্যাট্রিক্স কাজে লাগবে,
     * যাতে মেনু ফাঁকা না দেখায়। (ব্যাকএন্ডের defaultFor()-এর সাথে মিল) */
    DEFAULT_PERMISSIONS: {
      ADMIN: "*", // সব কিছু
      PARTNER: [
        "DASHBOARD_VIEW",
        "CUSTOMER_VIEW",
        "LOAN_VIEW",
        "COLLECTION_VIEW",
        "DEFAULTER_VIEW",
        "AGENT_VIEW",
        "SALARY_VIEW",
        "REPORT_VIEW",
        "FUND_MANAGE",
        "AUDIT_VIEW",
      ],
      MANAGER: [
        "DASHBOARD_VIEW",
        "CUSTOMER_VIEW",
        "CUSTOMER_MANAGE",
        "LOAN_VIEW",
        "LOAN_MANAGE",
        "COLLECTION_VIEW",
        "COLLECTION_MANAGE",
        "DEFAULTER_VIEW",
        "AGENT_VIEW",
        "AGENT_MANAGE",
        "SALARY_VIEW",
        "EXPENSE_MANAGE",
        "REPORT_VIEW",
      ],
      AGENT: [
        "DASHBOARD_VIEW",
        "CUSTOMER_VIEW",
        "LOAN_VIEW",
        "COLLECTION_VIEW",
        "COLLECTION_MANAGE",
        "DEFAULTER_VIEW",
      ],
    },

    /* ---------------------------------------------------------------------
     * 8. NETWORK & MISC
     * ------------------------------------------------------------------- */
    NET: {
      TIMEOUT_MS: 60000, // Render free/starter server ঘুম থেকে উঠতে সময় নেয়
      RETRY_ON_WAKE: true,
    },
    PAGE_SIZE: 20,
    DEBUG: IS_LOCAL,
  };

  /* config-এর মানগুলো লক করে দিচ্ছি যাতে ভুল করে কেউ বদলে না ফেলে —
   * কিন্তু NK নিজে খোলা থাকবে, কারণ api.js / auth.js / theme.js
   * নিজেদের অংশ (NK.api, NK.auth, NK.theme, NK.utils) এখানে জুড়বে। */
  Object.keys(NK).forEach(function (key) {
    if (NK[key] && typeof NK[key] === "object") Object.freeze(NK[key]);
  });

  window.NK = NK;

  if (NK.DEBUG) {
    console.log("[NK] config loaded →", NK.API_BASE_URL);
  }
})();
