/* =========================================================================
   NEELKUND — মূল ইঞ্জিন
   সব পাতা এইটা ব্যবহার করবে।

   নিরাপত্তা:
   - অ্যাক্সেস টোকেন মেমরিতে থাকে, localStorage-এ নয়
   - রিফ্রেশ টোকেন localStorage-এ (ব্যাক বাটন/অ্যাপ বন্ধ করলেও থাকে,
     শুধু লগ-আউট করলে বা মেয়াদ (৭ দিন) শেষ হলে মোছে)
   - কোনো পাতা নিজে থেকে redirect করে না
   ========================================================================= */

(function (window) {
    "use strict";

    var API = "https://neelkund-backend.onrender.com";

    /* ---------------- টোকেন — মেমরিতে ---------------- */

    var accessToken = null;
    var me = null;
    var perms = null;

    /* রিফ্রেশ টোকেন — localStorage-এ।
       অ্যাপ বন্ধ/ব্যাক বাটনেও থাকে, লগ-আউট বা মেয়াদ শেষ হলে মোছে। */
    var RT_KEY = "nk_rt";

    function setRefresh(t) {
        try { localStorage.setItem(RT_KEY, t); } catch (e) {}
    }
    function getRefresh() {
        try { return localStorage.getItem(RT_KEY); } catch (e) { return null; }
    }
    function clearAll() {
        accessToken = null;
        me = null;
        perms = null;
        try { localStorage.removeItem(RT_KEY); } catch (e) {}
        try { localStorage.removeItem("nk_me"); } catch (e) {}
    }

    /* কে লগইন করে আছে — localStorage-এ (সংবেদনশীল নয়) */
    function saveMe(u) {
        me = u;
        try { localStorage.setItem("nk_me", JSON.stringify(u)); } catch (e) {}
    }
    function loadMe() {
        if (me) return me;
        try {
            var s = localStorage.getItem("nk_me");
            if (s) me = JSON.parse(s);
        } catch (e) {}
        return me;
    }

    /* ---------------- পদ অনুযায়ী নিজের পাতা ---------------- */

    var HOME = {
        ADMIN:   "admin.html",
        PARTNER: "partner.html",
        MANAGER: "manager.html",
        AGENT:   "agent.html"
    };

    function homeFor(role) {
        return HOME[role] || "login.html";
    }

    /* ---------------- ভুলের বার্তা — বাংলায় ---------------- */

    function msgFor(status, body) {
        if (body && body.message) return body.message;

        if (status === 400) return "তথ্য ঠিকমতো দেওয়া হয়নি।";
        if (status === 401) return "লগইনের মেয়াদ শেষ। আবার লগইন করুন।";
        if (status === 403) return "এই কাজের অনুমতি নেই।";
        if (status === 404) return "খুঁজে পাওয়া গেল না।";
        if (status === 409) return "এই তথ্য আগে থেকেই আছে।";
        if (status === 413) return "ফাইলটা খুব বড়।";
        if (status === 429) return "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার করুন।";
        if (status >= 500)  return "সার্ভারে সমস্যা হয়েছে। একটু পরে আবার করুন।";
        return "কাজটি করা গেল না।";
    }

    /* ---------------- API ডাকা ---------------- */

    var refreshing = null;   // একসাথে অনেকবার রিফ্রেশ যেন না হয়

    function refreshToken() {
        if (refreshing) return refreshing;

        var rt = getRefresh();
        if (!rt) return Promise.reject(new Error("লগইন করা নেই"));

        refreshing = fetch(API + "/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: rt })
        })
            .then(function (r) {
                if (!r.ok) throw new Error("লগইনের মেয়াদ শেষ");
                return r.json();
            })
            .then(function (d) {
                accessToken = d.accessToken;
                setRefresh(d.refreshToken);
                saveMe({
                    userId: d.userId,
                    fullName: d.fullName,
                    role: d.role,
                    mustChangePassword: d.mustChangePassword,
                    canEditSalary: d.canEditSalary
                });
                refreshing = null;
                return d.accessToken;
            })
            .catch(function (e) {
                refreshing = null;
                clearAll();
                throw e;
            });

        return refreshing;
    }

    function request(method, path, body, isForm, retried) {
        var opts = { method: method, headers: {} };

        if (accessToken) {
            opts.headers["Authorization"] = "Bearer " + accessToken;
        }

        if (body !== undefined && body !== null) {
            if (isForm) {
                opts.body = body;                    // FormData — হেডার দেব না
            } else {
                opts.headers["Content-Type"] = "application/json";
                opts.body = JSON.stringify(body);
            }
        }

        return fetch(API + path, opts).then(function (r) {

            /* টোকেনের মেয়াদ শেষ — একবার রিফ্রেশ করে আবার চেষ্টা */
            if (r.status === 401 && !retried && getRefresh()) {
                return refreshToken().then(function () {
                    return request(method, path, body, isForm, true);
                });
            }

            if (r.status === 204) return null;

            /* ফাইল নামানো */
            var ct = r.headers.get("content-type") || "";
            if (ct.indexOf("text/csv") !== -1 || ct.indexOf("image/") !== -1 || ct.indexOf("spreadsheetml") !== -1) {
                if (!r.ok) throw mkErr(r.status, null);
                return r.blob();
            }

            return r.json().catch(function () { return null; }).then(function (b) {
                if (!r.ok) throw mkErr(r.status, b);
                return b;
            });
        });
    }

    function mkErr(status, body) {
        var e = new Error(msgFor(status, body));
        e.status = status;
        return e;
    }

    /* ---------------- লগইন ---------------- */

    function login(phone, password) {
        return fetch(API + "/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone, password: password })
        })
            .then(function (r) {
                return r.json().catch(function () { return null; }).then(function (b) {
                    if (!r.ok) throw mkErr(r.status, b);
                    return b;
                });
            })
            .then(function (d) {
                accessToken = d.accessToken;
                setRefresh(d.refreshToken);
                saveMe({
                    userId: d.userId,
                    fullName: d.fullName,
                    role: d.role,
                    mustChangePassword: d.mustChangePassword,
                    canEditSalary: d.canEditSalary
                });
                return d;
            });
    }

    function logout() {
        clearAll();
    }

    /* ---------------- পাতা খোলার সময় ---------------- */

    /**
     * পাতা খুললে এইটা ডাকুন।
     * টোকেন না থাকলে রিফ্রেশ করে নেবে।
     * তবুও না হলে ok=false ফেরত দেবে — পাতা নিজে ঠিক করবে কী করবে।
     */
    function boot() {
        if (accessToken) {
            return Promise.resolve({ ok: true, me: loadMe() });
        }

        if (!getRefresh()) {
            return Promise.resolve({ ok: false });
        }

        return refreshToken()
            .then(function () { return { ok: true, me: loadMe() }; })
            .catch(function () { return { ok: false }; });
    }

    /** আমি কী কী পারি */
    function loadPerms() {
        if (perms) return Promise.resolve(perms);

        return request("GET", "/api/permissions/mine")
            .then(function (list) {
                perms = {};
                (list || []).forEach(function (k) { perms[k] = true; });
                return perms;
            })
            .catch(function () {
                perms = {};
                return perms;
            });
    }

    function can(key) {
        if (!perms) return false;
        return !!perms[key];
    }

    /* ---------------- ছোট সাহায্য ---------------- */

    /** লেখা নিরাপদ করা — XSS ঠেকাতে */
    function esc(s) {
        if (s === null || s === undefined) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /** টাকা — ₹১২,৩৪৫ */
    function inr(n) {
        var v = Number(n || 0);
        return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    }

    /** ছোট করে — ₹১.২ ল */
    function inrShort(n) {
        var v = Number(n || 0);
        if (Math.abs(v) >= 10000000) return "₹" + (v / 10000000).toFixed(2) + " কো";
        if (Math.abs(v) >= 100000)   return "₹" + (v / 100000).toFixed(2) + " ল";
        if (Math.abs(v) >= 1000)     return "₹" + (v / 1000).toFixed(1) + " হা";
        return inr(v);
    }

    /** তারিখ — ১৩ জুল ২০২৬ */
    function dt(v) {
        if (!v) return "—";
        var d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });
    }

    /** সময় — ১৩ জুল, ৩:৪৫ PM */
    function dtTime(v) {
        if (!v) return "—";
        var d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return d.toLocaleString("en-IN", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
    }

    /** তালিকা বের করা — Page হোক বা Array */
    function rows(r) {
        if (!r) return [];
        if (Array.isArray(r)) return r;
        return r.content || r.items || [];
    }
    /* ---------------- ব্যাকগ্রাউন্ডে গেলে ঝাপসা ---------------- */

    function initPrivacy() {
        if (document.getElementById("nk-privacy")) return;

        var d = document.createElement("div");
        d.id = "nk-privacy";
        d.style.cssText =
            "position:fixed;inset:0;z-index:99999;display:none;" +
            "align-items:center;justify-content:center;flex-direction:column;gap:12px;" +
            "background:rgba(15,41,66,.6);" +
            "backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);" +
            "color:#fff;font-family:'Hind Siliguri',sans-serif;" +
            "font-size:15px;font-weight:600;letter-spacing:.5px;";
        d.innerHTML = '<div style="font-size:38px;">🔒</div><div>NEELKUND</div>';

        document.body.appendChild(d);

        function showIt() { d.style.display = "flex"; }
        function hideIt() { d.style.display = "none"; }

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "hidden") showIt();
            else hideIt();
        });

        window.addEventListener("pagehide", showIt);
        window.addEventListener("pageshow", hideIt);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPrivacy);
    } else {
        initPrivacy();
    }
    /* ---------------- ভাষা (বাংলা / English) ----------------
       এখন শুধু মেনু/বাটন/হেডিং-এর মতো স্থায়ী লেখা বদলায়।
       লিস্ট/হিসাবের ভেতরের তথ্য (JS দিয়ে বসানো) এখনো বাংলাই থাকে। */

    var LANG_KEY = "nk_lang";

    var DICT = {
        "ড্যাশবোর্ড": "Dashboard", "হোম": "Home", "গ্রাহক": "Customer",
        "লোন": "Loan", "কালেকশন": "Collection", "আরও": "More",
        "ব্রাঞ্চ": "Branch", "মার্কেট": "Market", "টিম": "Team",
        "ফান্ড": "Fund", "খরচ": "Expense", "বেতন": "Salary",
        "কর্মীর ডিটেলস": "Staff Details", "KYC ছবি": "KYC Photos",
        "OD তালিকা": "OD List", "ধাপ": "Stages", "সেটিংস": "Settings",
        "পারমিশন": "Permission", "অ্যাক্সেস": "Access", "ইম্পোর্ট": "Import",
        "রিপোর্ট": "Report", "লগইন লগ": "Login Log", "লগ আউট": "Log Out",
        "এজেন্ট": "Agent", "ব্ল্যাকলিস্ট": "Blacklist", "কাগজ": "Sheet",
        "আজ": "Today", "নতুন": "New", "অগ্রগতি": "Growth",
        "বিনিয়োগ": "Investment",
        "ব্ল্যাকলিস্ট (১২০+ দিন)": "Blacklist (120+ days)",
        "আজকের রিপোর্ট": "Today's Report", "লোনের অনুরোধ": "Loan Requests",
        "আজকের কাজ": "Today's Work", "নতুন গ্রাহক": "New Customer",
        "লগইন করা নেই": "Not Logged In",
        "স্বাগতম": "Welcome", "মাইক্রোফাইন্যান্স": "Microfinance",
        "ফোন নম্বর": "Phone Number", "পাসওয়ার্ড": "Password",
        "পাসওয়ার্ড ভুলে গেছেন?": "Forgot password?",
        "লগইন করুন": "Log In", "পাসওয়ার্ড বদলান": "Change Password",
        "প্রথমবার ঢুকছেন — নিজের পাসওয়ার্ড বসান": "First time login — set your own password",
        "এখনকার পাসওয়ার্ড": "Current Password", "নতুন পাসওয়ার্ড": "New Password",
        "নতুন পাসওয়ার্ড আবার": "New Password Again"
    };

    function getLang() {
        try { return localStorage.getItem(LANG_KEY) || "bn"; } catch (e) { return "bn"; }
    }
    function setLang(l) {
        try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    }

    /** JS থেকে সরাসরি ব্যবহারের জন্য — NK.tr("গ্রাহক") */
    function tr(bn) {
        if (getLang() !== "en") return bn;
        return DICT[bn] || bn;
    }

    /** পাতার স্থায়ী (মেনু/বাটন/হেডিং) লেখা বাংলা/ইংরেজি করে —
        পাতা লোড হওয়ার সময় একবার চলে, JS দিয়ে পরে বসানো লেখা ধরে না */
    function applyLang() {
        var lang = getLang();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);

        nodes.forEach(function (node) {
            var el = node.parentNode;
            if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE") return;

            var full = node.nodeValue;
            var trimmed = full.trim();
            if (!trimmed) return;

            var bn = el.getAttribute("data-i18n-bn");
            if (!bn) {
                if (!DICT.hasOwnProperty(trimmed)) return;
                bn = trimmed;
                el.setAttribute("data-i18n-bn", bn);
            }

            var target = lang === "en" ? (DICT[bn] || bn) : bn;
            var i = full.indexOf(trimmed);
            node.nodeValue = full.slice(0, i) + target + full.slice(i + trimmed.length);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLang);
    } else {
        applyLang();
    }
    /* ফোনের ব্যাক বাটনে পুরনো (cache করা) পাতা ফিরে এলেও যেন
       ভাষা ঠিক থাকে */
    window.addEventListener("pageshow", applyLang);

    /* ---------------- বাইরে যা দেব ---------------- */

    window.NK = {
        API: API,

        tr: tr,
        getLang: getLang,
        setLang: function (l) { setLang(l); window.location.reload(); },

        login: login,
        logout: logout,
        boot: boot,

        GET:    function (p)        { return request("GET", p); },
        POST:   function (p, b)     { return request("POST", p, b === undefined ? {} : b); },
        PUT:    function (p, b)     { return request("PUT", p, b === undefined ? {} : b); },
        PATCH:  function (p, b)     { return request("PATCH", p, b === undefined ? {} : b); },
        DELETE: function (p)        { return request("DELETE", p); },
        UPLOAD: function (p, fd)    { return request("POST", p, fd, true); },

        me: loadMe,
        homeFor: homeFor,

        loadPerms: loadPerms,
        can: can,

        esc: esc,
        inr: inr,
        inrShort: inrShort,
        dt: dt,
        dtTime: dtTime,
        rows: rows
    };

})(window);