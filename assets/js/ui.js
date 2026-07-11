/* =========================================================================
 * NEELKUND MICROFINANCE — ui.js
 * সহায়ক ফাইল  |  NK.ui (theme.js-এর সরঞ্জামের শর্টকাট)
 *
 * কিছু পাতা NK.ui.* ব্যবহার করে। সেগুলো যাতে না ভাঙে, তাই এই ফাইল
 * theme.js-এর NK.utils / NK.theme-এর উপর একটা মোড়ক বসায়।
 *
 * Load order: config.js → theme.js → api.js → auth.js → ui.js
 * ========================================================================= */

(function () {
  "use strict";

  if (!window.NK) throw new Error("[NK] ui.js: config.js আগে লোড করতে হবে।");
  var NK = window.NK;

  if (!NK.utils || !NK.theme) {
    throw new Error("[NK] ui.js: theme.js আগে লোড করতে হবে।");
  }

  var U = NK.utils;
  var T = NK.theme;

  NK.ui = {
    /* সরঞ্জাম */
    qs: U.qs,
    qsa: U.qsa,
    on: U.on,
    setText: U.setText,
    setHtml: U.setHtml,
    escape: U.escape,
    money: U.money,
    date: U.date,
    dateTime: U.dateTime,
    today: U.today,
    initials: U.initials,
    isPhone: U.isPhone,
    isEmail: U.isEmail,
    badge: U.badge,
    debounce: U.debounce,

    /* বার্তা / লোডিং / মডাল */
    toast: T.toast,
    loading: T.loading,
    btnLoading: T.btnLoading,
    confirm: T.confirm,

    /* খেলাপি পতাকার রঙিন বিন্দু */
    flagDot: function (flag) {
      var map = { GREEN: "green", YELLOW: "amber", RED: "red" };
      var tone = map[String(flag || "").toUpperCase()] || "grey";
      var label = NK.FLAG[String(flag || "").toUpperCase()] || "—";
      return U.badge(label, tone);
    },

    /* ফাঁকা টেবিলের জন্য */
    emptyRow: function (colspan, message) {
      return (
        '<tr><td colspan="' +
        (colspan || 1) +
        '" style="text-align:center;padding:26px;color:#5E6B78;">' +
        U.escape(message || "কোনো তথ্য নেই।") +
        "</td></tr>"
      );
    },
  };

  if (NK.DEBUG) console.log("[NK] ui loaded");
})();
