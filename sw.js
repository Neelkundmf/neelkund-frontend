/* =========================================================================
   NEELKUND — Service Worker
   অ্যাপের ফাইলগুলো ফোনে জমা রাখে, তাই দ্রুত খোলে ও অফলাইনে চলে।

   ⚠️ API-র উত্তর কখনও জমা রাখা হয় না — টাকার হিসাব সবসময় তাজা থাকবে।
   ========================================================================= */

var VER = "nk-v1";

var SHELL = [
    "/login.html",
    "/admin.html",
    "/partner.html",
    "/manager.html",
    "/agent.html",
    "/change-password.html",
    "/assets/css/nk.css",
    "/assets/css/app.css",
    "/assets/js/nk.js",
    "/assets/logo.png",
    "/manifest.json"
];

/* ---- বসানোর সময় ---- */
self.addEventListener("install", function (e) {
    e.waitUntil(
        caches.open(VER).then(function (c) {
            return c.addAll(SHELL).catch(function () {
                /* কোনো ফাইল না পেলেও আটকাবে না */
            });
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

/* ---- চালু হওয়ার সময় — পুরনো ক্যাশ মুছি ---- */
self.addEventListener("activate", function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== VER; })
                    .map(function (k) { return caches.delete(k); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

/* ---- অনুরোধ আটকানো ---- */
self.addEventListener("fetch", function (e) {
    var req = e.request;

    if (req.method !== "GET") return;

    var url = new URL(req.url);

    /* ⚠️ ব্যাকএন্ডের ডাটা কখনও ক্যাশ করব না */
    if (url.hostname.indexOf("onrender.com") !== -1 &&
        url.pathname.indexOf("/api/") === 0) {
        return;
    }
    if (url.pathname.indexOf("/api/") === 0) {
        return;
    }

    /* অন্য সাইটের জিনিস (ফন্ট ইত্যাদি) — নেটওয়ার্ক আগে */
    if (url.origin !== self.location.origin) {
        return;
    }

    /* নিজেদের ফাইল — ক্যাশ আগে, তারপর নেট */
    e.respondWith(
        caches.match(req).then(function (hit) {
            if (hit) {
                /* পিছনে নতুন করে নামিয়ে রাখি */
                fetch(req).then(function (res) {
                    if (res && res.ok) {
                        caches.open(VER).then(function (c) { c.put(req, res); });
                    }
                }).catch(function () {});

                return hit;
            }

            return fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(VER).then(function (c) { c.put(req, copy); });
                }
                return res;
            }).catch(function () {
                /* নেট নেই, ক্যাশেও নেই */
                return caches.match("/login.html");
            });
        })
    );
});