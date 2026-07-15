/* =========================================================================
   NEELKUND — Service Worker
   অ্যাপের ফাইল ফোনে জমা থাকে (অফলাইনে চলে), কিন্তু অনলাইনে থাকলে
   সবসময় টাটকা ফাইল আসে — তাই নতুন আপডেট সঙ্গে সঙ্গে দেখা যায়।

   ⚠️ API-র উত্তর কখনও জমা রাখা হয় না — টাকার হিসাব সবসময় তাজা।
   ========================================================================= */

var VER = "nk-v2";

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
            return c.addAll(SHELL).catch(function () {});
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
    if (url.pathname.indexOf("/api/") === 0 ||
        url.hostname.indexOf("onrender.com") !== -1) {
        return;
    }

    /* অন্য সাইটের জিনিস (ফন্ট ইত্যাদি) — হাত দেব না */
    if (url.origin !== self.location.origin) {
        return;
    }

    /* নিজেদের ফাইল — নেট আগে, নেট না থাকলে জমানোটা।
       এতে অনলাইনে সবসময় টাটকা ফাইল আসে, নতুন আপডেট আটকায় না। */
    e.respondWith(
        fetch(req).then(function (res) {
            if (res && res.ok) {
                var copy = res.clone();
                caches.open(VER).then(function (c) { c.put(req, copy); });
            }
            return res;
        }).catch(function () {
            return caches.match(req).then(function (hit) {
                return hit || caches.match("/login.html");
            });
        })
    );
});