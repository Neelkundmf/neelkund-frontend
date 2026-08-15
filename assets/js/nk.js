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

    // localhost এ টেস্ট করলে লোকাল ব্যাকএন্ড, নাহলে লাইভ সার্ভার —
    // আগে সবসময় লাইভ URL হার্ডকোড ছিল, তাই লোকাল ব্যাকএন্ড দিয়ে টেস্ট করা যেত না
    var _host = (window.location && window.location.hostname) || "";
    var _isLocal = _host === "localhost" || _host === "127.0.0.1" || _host === "";
    var API = _isLocal ? "http://localhost:8080" : "https://neelkund-backend.onrender.com";

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

        var en = (function () {
            try { return localStorage.getItem("nk_lang") === "en"; } catch (e) { return false; }
        })();

        if (status === 400) return en ? "The information given wasn't correct." : "তথ্য ঠিকমতো দেওয়া হয়নি।";
        if (status === 401) return en ? "Login session expired. Please log in again." : "লগইনের মেয়াদ শেষ। আবার লগইন করুন।";
        if (status === 403) return en ? "You don't have permission for this." : "এই কাজের অনুমতি নেই।";
        if (status === 404) return en ? "Not found." : "খুঁজে পাওয়া গেল না।";
        if (status === 409) return en ? "This already exists." : "এই তথ্য আগে থেকেই আছে।";
        if (status === 413) return en ? "The file is too large." : "ফাইলটা খুব বড়।";
        if (status === 429) return en ? "Too many attempts. Please try again shortly." : "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার করুন।";
        if (status >= 500)  return en ? "Server error. Please try again shortly." : "সার্ভারে সমস্যা হয়েছে। একটু পরে আবার করুন।";
        return en ? "Could not complete the action." : "কাজটি করা গেল না।";
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
        // Capture field-level errors from API response
        if (body && body.errors && typeof body.errors === 'object') {
            e.fieldErrors = body.errors;
        }
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

    /** ছোট করে — ₹১.২ ল (ইংরেজিতে ₹1.2 L) */
    function inrShort(n) {
        var v = Number(n || 0);
        var en = getLang() === "en";
        if (Math.abs(v) >= 10000000) return "₹" + (v / 10000000).toFixed(2) + (en ? " Cr" : " কো");
        if (Math.abs(v) >= 100000)   return "₹" + (v / 100000).toFixed(2) + (en ? " L" : " ল");
        if (Math.abs(v) >= 1000)     return "₹" + (v / 1000).toFixed(1) + (en ? " K" : " হা");
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

    /* ---------------- ফিল্ড এরর হাইলাইট করা ---------------- */

    /**
     * API field name থেকে HTML input id বের করা
     * fullName -> n_name, phone -> n_phone, aadhaar -> n_aad ইত্যাদি
     */
    function getFieldIdForError(apiFieldName) {
        var mapping = {
            // গ্রাহক সৃষ্টি (agent.html)
            'fullName': 'n_name',
            'phone': 'n_phone',
            'aadhaar': 'n_aad',
            'pan': 'n_pan',
            'voterId': 'n_voter_id',
            'address': 'n_addr',
            'fatherOrHusband': 'n_fh',
            'dateOfBirth': 'n_dob',
            'gender': 'n_gen',
            'permanentAddress': 'n_perm',
            'businessAddress': 'n_bad',
            'businessType': 'n_btype',
            'guarantorName': 'n_guar',
            'guarantorPhone': 'n_gph',
            'guarantorAddress': 'n_gad',
            'customerCode': 'n_code',
            'principal': 'n_amt',
            // কর্মী সৃষ্টি (admin.html)
            'password': 'tm_pass',
            'role': 'tm_role',
            'branchId': 'tm_br',
            'area': 'tm_area',
            'marketId': 'tm_mk',
            'monthlySalary': 'tm_sal',
            'joinedDate': 'tm_join',
            'currentAddress': 'tm_curr',
            'emergencyName': 'tm_en',
            'emergencyPhone': 'tm_ep',
            'bloodGroup': 'tm_bg',
            // লোন রিকোয়েস্ট ফিল্ড
            'customerId': 'l_cust',
            // ইউজার ফিল্ড
            'newPassword': 'pwd_new',
            'passwordRepeat': 'pwd_repeat',
            'currentPassword': 'pwd_curr'
        };
        return mapping[apiFieldName] || null;
    }

    /**
     * ফর্মের ফিল্ডগুলো হাইলাইট করা — যেখানে এরর আছে
     * @param {Object} error - API থেকে আসা error অবজেক্ট
     * @param {string} containerId - যে container-এ খুঁজব (optional)
     */
    function highlightFieldErrors(error, containerId) {
        if (!error || !error.fieldErrors) return;

        var container = document;
        if (containerId) {
            var el = document.getElementById(containerId);
            if (el) container = el;
        }

        var fieldErrors = error.fieldErrors;

        // সব input/select/textarea থেকে লাল রঙ মোছা
        Array.prototype.forEach.call(document.querySelectorAll('input, select, textarea'), function (el) {
            el.style.borderColor = '';
            el.style.backgroundColor = '';
        });

        // যেখানে এরর আছে, সেখানে লাল করা
        Object.keys(fieldErrors).forEach(function (apiField) {
            var fieldId = getFieldIdForError(apiField);
            if (fieldId) {
                var el = document.getElementById(fieldId);
                if (el) {
                    el.style.borderColor = '#ef4444';
                    el.style.borderWidth = '2px';
                    el.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                }
            }
        });
    }

    /**
     * ফিল্ড এরর ম্যাসেজ বাংলায় ফরম্যাট করা
     * @param {Object} fieldErrors - API থেকে আসা field errors অবজেক্ট
     * @returns {string} HTML string
     */
    function formatFieldErrors(fieldErrors) {
        if (!fieldErrors || typeof fieldErrors !== 'object') return '';

        var errors = [];
        Object.keys(fieldErrors).forEach(function (field) {
            var msg = fieldErrors[field];
            errors.push(msg);
        });

        if (errors.length === 0) return '';

        var html = '<ul style="margin:8px 0;padding-left:20px;">';
        errors.forEach(function (err) {
            html += '<li style="color:#ef4444;margin:4px 0;font-size:13px;">' + esc(err) + '</li>';
        });
        html += '</ul>';
        return html;
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
        "ফোন নম্বর আর পাসওয়ার্ড দিয়ে ঢুকুন": "Log in with your phone number and password",
        "১০ সংখ্যার নম্বর": "10-digit number",
        "ফোন নম্বর": "Phone Number", "পাসওয়ার্ড": "Password",
        "পাসওয়ার্ড ভুলে গেছেন?": "Forgot password?",
        "লগইন করুন": "Log In", "পাসওয়ার্ড বদলান": "Change Password",
        "প্রথমবার ঢুকছেন — নিজের পাসওয়ার্ড বসান": "First time login — set your own password",
        "এখনকার পাসওয়ার্ড": "Current Password", "নতুন পাসওয়ার্ড": "New Password",
        "নতুন পাসওয়ার্ড আবার": "New Password Again",

        "লোড হচ্ছে...": "Loading...", "সব": "All",
        "যাতায়াত": "Transport", "বিদ্যুৎ / জল": "Utilities", "বিদ্যুৎ/জল": "Utilities",
        "অফিস সামগ্রী": "Office Supplies", "অফিস": "Office",
        "বিজ্ঞাপন": "Marketing", "ইনসেনটিভ": "Incentive", "বিবিধ": "Miscellaneous",
        "সব ব্রাঞ্চ": "All Branches", "সব মার্কেট": "All Markets",
        "গ্রাহকের ধাপ": "Customer Stages", "এখনই সব হিসাব করুন": "Recalculate All Now",
        "কোনো পার্টনার": "No Partner", "পুরুষ": "Male", "মহিলা": "Female", "অন্য": "Other",
        "রক্তের গ্রুপ": "Blood Group", "যেমন": "e.g.",
        "মার্কেট বাছুন": "Select Market", "ব্রাঞ্চ বাছুন": "Select Branch",
        "কর্মী বাছুন": "Select Staff", "এজেন্ট বাছুন": "Select Agent",
        "কোন পার্টনার": "Which Partner", "বিনিয়োগকারীর নাম": "Investor Name",
        "নোট": "Note", "খাত": "Category", "রেন্ট": "Rent", "ভাড়া": "Rent",
        "— নেই —": "— None —", "— বাছুন —": "— Select —",
        "এই পাতা দেখতে হলে আগে লগইন করতে হবে।": "You need to log in to view this page.",
        "লগইন পাতায় যান": "Go to Login Page"
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

        /* placeholder-এর লেখাও (এটা টেক্সট নোড না, তাই আলাদাভাবে) */
        Array.prototype.forEach.call(document.querySelectorAll("[placeholder]"), function (el) {
            var bn = el.getAttribute("data-i18n-ph-bn");
            if (!bn) {
                var t = el.getAttribute("placeholder");
                if (!t || !DICT.hasOwnProperty(t)) return;
                bn = t;
                el.setAttribute("data-i18n-ph-bn", bn);
            }
            el.setAttribute("placeholder", lang === "en" ? (DICT[bn] || bn) : bn);
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

    /* ================== Navigation History (Back Button) ================== */

    var navStack = [];  // স্ট্যাক: [{ view, panel, panelId, ... }]
    var NAV_STACK_MAX = 50; // অনেকক্ষণ ধরে ব্যবহার করলে যেন মেমরিতে অসীম জমে না যায়

    function pushNavState(state) {
        navStack.push(state);
        if (navStack.length > NAV_STACK_MAX) {
            navStack = navStack.slice(navStack.length - NAV_STACK_MAX);
        }
        history.pushState(state, null, window.location.pathname);
    }

    function replaceNavState(state) {
        navStack[navStack.length - 1] = state;
        history.replaceState(state, null, window.location.pathname);
    }

    function getNavStack() {
        return navStack.slice();  // কপি রিটার্ন করি
    }

    function setNavStack(stack) {
        navStack = stack.slice();
    }

    function clearNavStack() {
        navStack = [];
    }

    /* ================ (End Navigation History) ================== */

    /* ---------------- বাইরে যা দেব ---------------- */

    window.NK = {
        API: API,

        tr: tr,
        getLang: getLang,
        setLang: function (l) { setLang(l); window.location.reload(); },

        login: login,
        logout: logout,
        boot: boot,
        getToken: function () { return accessToken; },

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
        rows: rows,

        pushNavState: pushNavState,
        replaceNavState: replaceNavState,
        getNavStack: getNavStack,
        setNavStack: setNavStack,
        clearNavStack: clearNavStack,

        // ফিল্ড এরর হ্যান্ডলিং
        highlightFieldErrors: highlightFieldErrors,
        formatFieldErrors: formatFieldErrors,

        /* ================== Validation Framework (Part 1/2) ==================
           CSS স্টাইলিং (কোডে যোগ করবেন):
           - Red border: border: 2px solid #ff4444
           - Error text: color: #ff4444, font-size: 12px, margin-top: 4px
           ================================================================== */

        validate: {
            /**
             * একটা form-এর সব ফিল্ড যাচাই করা
             * @param {string} formId - form element-এর ID
             * @returns {boolean} - সব ফিল্ড valid হলে true
             */
            validateForm: function(formId) {
                var form = document.getElementById(formId);
                if (!form) return false;

                var isValid = true;
                var requiredFields = form.querySelectorAll('[data-required="true"]');

                requiredFields.forEach(function(field) {
                    var fieldId = field.id;
                    var value = field.value ? field.value.trim() : '';
                    var rules = {
                        required: true,
                        type: field.getAttribute('data-validate-type') || 'text',
                        minLength: field.getAttribute('data-min-length'),
                        maxLength: field.getAttribute('data-max-length'),
                        pattern: field.getAttribute('data-validate-pattern')
                    };

                    if (!NK.validate.validateField(fieldId, value, rules)) {
                        isValid = false;
                    }
                });

                return isValid;
            },

            /**
             * একটা ফিল্ড যাচাই করা
             * @param {string} fieldId - input element-এর ID
             * @param {string} value - ফিল্ডের value
             * @param {Object} rules - validation rules
             *        rules.required: boolean
             *        rules.type: 'text'|'email'|'phone'|'number'|'aadhar'|'pan'|'date'
             *        rules.minLength: number
             *        rules.maxLength: number
             *        rules.pattern: regex pattern string
             * @returns {boolean} - valid হলে true, invalid হলে false
             */
            validateField: function(fieldId, value, rules) {
                rules = rules || {};
                var isValid = true;
                var errorMsg = '';

                // required চেক
                if (rules.required && (!value || value === '')) {
                    isValid = false;
                    errorMsg = 'এই ফিল্ড বাধ্যতামূলক।';
                    NK.validate.showError(fieldId, errorMsg);
                    return false;
                }

                if (!value) {
                    NK.validate.clearError(fieldId);
                    return true;
                }

                // type অনুযায়ী যাচাই
                if (rules.type) {
                    switch (rules.type) {
                        case 'email':
                            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(value)) {
                                isValid = false;
                                errorMsg = 'বৈধ ইমেল দিন। (অর্থ: name@example.com)';
                            }
                            break;
                        case 'phone':
                            var phoneRegex = /^[0-9]{10}$/;
                            if (!phoneRegex.test(value)) {
                                isValid = false;
                                errorMsg = '১০ সংখ্যার ফোন নম্বর দিন।';
                            }
                            break;
                        case 'number':
                            if (isNaN(value) || value === '') {
                                isValid = false;
                                errorMsg = 'সংখ্যা দিন।';
                            }
                            break;
                        case 'aadhar':
                            var aadharRegex = /^[0-9]{12}$/;
                            if (!aadharRegex.test(value)) {
                                isValid = false;
                                errorMsg = '১২ সংখ্যার আধার নম্বর দিন।';
                            }
                            break;
                        case 'pan':
                            var panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                            if (!panRegex.test(value)) {
                                isValid = false;
                                errorMsg = 'বৈধ PAN দিন। (উদা: AAAAA1234A)';
                            }
                            break;
                        case 'date':
                            var d = new Date(value);
                            if (isNaN(d.getTime())) {
                                isValid = false;
                                errorMsg = 'বৈধ তারিখ দিন।';
                            }
                            break;
                    }
                }

                // minLength/maxLength চেক
                if (isValid && rules.minLength && value.length < parseInt(rules.minLength)) {
                    isValid = false;
                    errorMsg = 'কমপক্ষে ' + rules.minLength + ' অক্ষর দিন।';
                }

                if (isValid && rules.maxLength && value.length > parseInt(rules.maxLength)) {
                    isValid = false;
                    errorMsg = 'সর্বোচ্চ ' + rules.maxLength + ' অক্ষর দিন।';
                }

                // custom pattern চেক
                if (isValid && rules.pattern) {
                    try {
                        var regex = new RegExp(rules.pattern);
                        if (!regex.test(value)) {
                            isValid = false;
                            errorMsg = 'ফর্ম্যাট ঠিক নয়।';
                        }
                    } catch (e) {
                        // ignore invalid regex
                    }
                }

                if (!isValid) {
                    NK.validate.showError(fieldId, errorMsg);
                } else {
                    NK.validate.clearError(fieldId);
                }

                return isValid;
            },

            /**
             * ফিল্ডে error দেখানো (লাল বর্ডার + error ম্যাসেজ)
             * CSS: border: 2px solid #ff4444; error-text color: #ff4444, font-size: 12px, margin-top: 4px
             * @param {string} fieldId - input element-এর ID
             * @param {string} msg - error ম্যাসেজ
             */
            showError: function(fieldId, msg) {
                var el = document.getElementById(fieldId);
                if (!el) return;

                // input/select/textarea-এ লাল বর্ডার
                el.style.borderColor = '#ff4444';
                el.style.borderWidth = '2px';
                el.style.backgroundColor = 'rgba(255, 68, 68, 0.05)';

                // error ম্যাসেজ দেখানো (যদি container থাকে)
                var container = el.parentElement;
                if (container) {
                    var existingError = container.querySelector('[data-error-for="' + fieldId + '"]');
                    if (existingError) {
                        existingError.textContent = msg;
                    } else {
                        var errorDiv = document.createElement('div');
                        errorDiv.setAttribute('data-error-for', fieldId);
                        errorDiv.style.cssText = 'color: #ff4444; font-size: 12px; margin-top: 4px; margin-left: 0;';
                        errorDiv.textContent = msg;
                        container.appendChild(errorDiv);
                    }
                }
            },

            /**
             * ফিল্ড থেকে error সরানো
             * @param {string} fieldId - input element-এর ID
             */
            clearError: function(fieldId) {
                var el = document.getElementById(fieldId);
                if (!el) return;

                // লাল স্টাইল মোছা
                el.style.borderColor = '';
                el.style.borderWidth = '';
                el.style.backgroundColor = '';

                // error ম্যাসেজ মোছা
                var container = el.parentElement;
                if (container) {
                    var errorDiv = container.querySelector('[data-error-for="' + fieldId + '"]');
                    if (errorDiv) {
                        errorDiv.remove();
                    }
                }
            },

            /**
             * একটা form-এর সব ফিল্ড valid কিনা চেক করা
             * @param {string} formId - form element-এর ID
             * @returns {boolean} - সব ফিল্ড valid হলে true
             */
            isFormValid: function(formIdOrFieldArray) {
                var requiredFields = [];

                if (Array.isArray(formIdOrFieldArray)) {
                    requiredFields = formIdOrFieldArray.map(function(fieldId) {
                        return document.getElementById(fieldId);
                    }).filter(function(el) { return el !== null; });
                } else {
                    var form = document.getElementById(formIdOrFieldArray);
                    if (!form) return false;
                    requiredFields = Array.from(form.querySelectorAll('[data-required="true"]'));
                }

                var isValid = true;
                requiredFields.forEach(function(field) {
                    if (!field) return;
                    var errorDiv = field.parentElement.querySelector('[data-error-for="' + field.id + '"]');
                    if (errorDiv || field.style.borderColor === '#ff4444') {
                        isValid = false;
                    }
                });

                return isValid;
            },

            /**
             * পূর্বনির্ধারিত validation rules (Part 2/2)
             */
            rules: {
                required: function(value) { return value.trim() !== ''; },
                phone: function(value) { return /^\d{10}$/.test(value); },
                name: function(value) { return value.trim().length >= 2 && !/\s{2,}/.test(value); },
                email: function(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); },
                number: function(value) { return !isNaN(value) && value !== ''; },
                code: function(value) { return /^[A-Z0-9]{2,10}$/.test(value); }
            },

            /**
             * Validation ম্যাসেজ বাংলায় (Part 2/2)
             */
            messages: {
                required: "এটা অবশ্যই দিতে হবে।",
                phone: "১০ সংখ্যার ফোন নাম্বার দিন।",
                name: "নাম কমপক্ষে ২ অক্ষর, কোনো অতিরিক্ত স্পেস নয়।",
                email: "সঠিক ইমেইল ঠিকানা দিন।",
                number: "শুধু সংখ্যা দিন।",
                code: "কোড: ২-১০ বড়হাতের অক্ষর/সংখ্যা।"
            },

            /**
             * সব ফিল্ডের validation rules এর mapping
             * ফরম্যাট: fieldId: ["required", "name", "phone", "email", "number", "code", "aadhar", "pan", "date"]
             * এই rules array থেকে validateField-এর rules object তৈরি করা যায়
             */
            fieldRules: {
                /* ===================== ব্রাঞ্চ ফর্ম ===================== */
                "br_name": ["required", "name"],
                "br_code": ["required", "code"],
                "br_digits": ["required", "number"],
                "br_start": ["required", "number"],
                "br_pattern": [],
                "br_addr": [],

                /* ===================== মার্কেট ফর্ম ===================== */
                "mk_name": ["required", "name"],
                "mk_code": ["code"],
                "mk_br": ["required"],
                "mk_mg": [],

                /* ===================== কর্মী / টিম সদস্য ফর্ম ===================== */
                "tm_name": ["required", "name"],
                "tm_phone": ["required", "phone"],
                "tm_pass": ["required"],
                "tm_role": ["required"],
                "tm_br": [],
                "tm_area": [],
                "tm_mk": [],
                "tm_sal": [],
                "tm_code": [],
                "tm_aad": ["aadhar"],
                "tm_pan": ["pan"],
                "tm_join": [],
                "tm_fh": [],
                "tm_dob": [],
                "tm_gen": [],
                "tm_bg": [],
                "tm_perm": [],
                "tm_curr": [],
                "tm_en": [],
                "tm_ep": ["phone"],

                /* ===================== তহবিল জমা (Fund Deposit) ===================== */
                "fd_type": ["required"],
                "fd_src": ["required"],
                "fd_p": [],
                "fd_iname": [],
                "fd_br": [],
                "fd_amt": ["required", "number"],
                "fd_date": ["required"],
                "fd_note": [],

                /* ===================== খরচ (Expense) ===================== */
                "ex_cat": ["required"],
                "ex_br": [],
                "ex_amt": ["required", "number"],
                "ex_date": ["required"],
                "ex_desc": [],

                /* ===================== অনুমতি (Permission) ===================== */
                "pm_role": ["required"],

                /* ===================== বেতন (Salary) ===================== */
                "sl_u": ["required"],
                "sl_m": ["required"],
                "sl_base": ["required", "number"],
                "sl_com": ["number"],
                "sl_f": [],

                /* ===================== প্রোফাইল / সদস্য সম্পাদনা ===================== */
                "pf_name": [],
                "pf_area": [],
                "pf_aad": ["aadhar"],
                "pf_pan": ["pan"],
                "pf_join": [],
                "pf_sal": [],
                "pf_code": [],
                "pf_np": [],

                /* ===================== অ্যাক্সেস নিয়ন্ত্রণ (Access Control) ===================== */
                "ac_role": ["required"],
                "ac_s": ["required", "number"],
                "ac_e": ["required", "number"],

                /* ===================== ছুটি (Holiday) ===================== */
                "ho_d": ["required"],
                "ho_n": [],

                /* ===================== খোঁজ / ফিল্টার ===================== */
                "cq": [],
                "lq": [],
                "cd": [],
                "kq": [],
                "rp_m": [],
                "br": [],
                "ag": [],
                "pf_u": [],
                "im_f": [],

                /* ===================== ডাইনামিক ফিল্ড ===================== */
                "durationHours": [],
                "pf_file": [],
                "sigFileInput": []
            }
        }
    };

})(window);