/*
 * SOLVY Diagnostic Helper — widget logic
 * Mounts into every element with the attribute  data-solvy-diagnostic
 * Optional data-appliance="fridge" opens the widget on that appliance.
 * No dependencies. Reads SOLVY_CONFIG + SOLVY_DATA (generated.js) and SOLVY_UI (ui.js).
 */
(function () {
  "use strict";

  var CFG = window.SOLVY_CONFIG;
  var UI = window.SOLVY_UI;
  var DATA = window.SOLVY_DATA;
  var PRICE_SCALE_MAX = 500; // right edge of the price bar, in USD

  var ICONS = {
    fridge:
      '<rect x="12" y="4" width="24" height="40" rx="3"/><line x1="12" y1="18" x2="36" y2="18"/><line x1="17" y1="9" x2="17" y2="14"/><line x1="17" y1="23" x2="17" y2="31"/>',
    washer:
      '<rect x="8" y="4" width="32" height="40" rx="3"/><line x1="8" y1="12" x2="40" y2="12"/><circle cx="24" cy="28" r="10"/><path d="M17 29c3 3 11 3 14-1"/><circle cx="14" cy="8" r="1.2"/><circle cx="19" cy="8" r="1.2"/>',
    dryer:
      '<rect x="8" y="4" width="32" height="40" rx="3"/><line x1="8" y1="12" x2="40" y2="12"/><circle cx="24" cy="28" r="10"/><path d="M20 24c2 2 2 6 0 8M26 24c2 2 2 6 0 8"/><line x1="30" y1="8" x2="35" y2="8"/>',
    dishwasher:
      '<rect x="8" y="4" width="32" height="40" rx="3"/><line x1="8" y1="11" x2="40" y2="11"/><line x1="18" y1="7.5" x2="30" y2="7.5"/><path d="M14 30h20M17 30v-8M24 30v-11M31 30v-8"/><line x1="12" y1="38" x2="36" y2="38"/>',
    stove:
      '<rect x="8" y="14" width="32" height="30" rx="3"/><line x1="8" y1="22" x2="40" y2="22"/><rect x="14" y="27" width="20" height="12" rx="1.5"/><path d="M15 10c0-3 3-3 3-6M24 10c0-3 3-3 3-6M33 10c0-3 3-3 3-6" /><circle cx="14" cy="18" r="1.2"/><circle cx="34" cy="18" r="1.2"/>'
  };

  function bookHref(a, sym) {
    if (!CFG.bookingPage) return CFG.bookingUrl;
    var q = [];
    if (a) q.push("a=" + encodeURIComponent(a));
    if (sym) q.push("s=" + encodeURIComponent(sym));
    return CFG.bookingPage + (q.length ? "?" + q.join("&") : "");
  }
  function bookAttr() { return CFG.bookingPage ? "" : ' target="_blank" rel="noopener"'; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function icon(name) {
    return '<svg class="sdx-icon" viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  function pickLang() {
    if (CFG.defaultLang === "en" || CFG.defaultLang === "es") return CFG.defaultLang;
    var nav = (navigator.language || "en").toLowerCase();
    return nav.indexOf("es") === 0 ? "es" : "en";
  }

  // Optional analytics hook: works automatically if Google Tag Manager / GA4 is on the site
  function track(event, params) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: "solvy_dx_" + event }, params || {}));
    } catch (e) { /* ignore */ }
  }

  function Widget(root) {
    this.root = root;
    var pre = root.getAttribute("data-appliance");
    var known = pre && DATA.some(function (a) { return a.id === pre; });
    this.state = { lang: pickLang(), appliance: known ? pre : null, symptom: null };
    var self = this;
    root.addEventListener("click", function (e) { self.onClick(e); });
    this.render();
  }

  Widget.prototype.t = function (key) {
    return UI[this.state.lang][key];
  };

  Widget.prototype.step = function () {
    if (!this.state.appliance) return 1;
    if (!this.state.symptom) return 2;
    return 3;
  };

  Widget.prototype.onClick = function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || !this.root.contains(el)) return;
    var act = el.getAttribute("data-act");
    var val = el.getAttribute("data-val");
    var s = this.state;

    if (act === "lang") { s.lang = s.lang === "en" ? "es" : "en"; this.render(true); return; }
    if (act === "appliance") { s.appliance = val; s.symptom = null; track("appliance", { appliance: val }); }
    if (act === "symptom") { s.symptom = val; track("symptom", { appliance: s.appliance, symptom: val }); }
    if (act === "back") { if (s.symptom) { s.symptom = null; } else { s.appliance = null; } }
    if (act === "restart") { s.appliance = null; s.symptom = null; }
    if (act === "book") { track("book_click", { appliance: s.appliance, symptom: s.symptom }); return; }
    if (act === "call") { track("call_click", { appliance: s.appliance, symptom: s.symptom }); return; }
    if (act === "text") { track("text_click", { appliance: s.appliance, symptom: s.symptom }); return; }
    if (act === "copy") { this.copy(el); return; }
    this.render(true);
  };

  Widget.prototype.copy = function (btn) {
    var text = btn.getAttribute("data-text");
    var label = this.t("copied");
    var done = function () { btn.textContent = label; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); done();
    }
  };

  Widget.prototype.current = function () {
    var s = this.state;
    var a = DATA.find(function (x) { return x.id === s.appliance; });
    var sym = a && a.symptoms.find(function (x) { return x.id === s.symptom; });
    return { a: a, sym: sym };
  };

  Widget.prototype.render = function (focus) {
    var L = this.state.lang;
    var step = this.step();
    var body = step === 1 ? this.viewAppliances() : step === 2 ? this.viewSymptoms() : this.viewResult();

    var steps = [this.t("step1"), this.t("step2"), this.t("step3")].map(function (label, i) {
      var n = i + 1;
      var cls = n < step ? "is-done" : n === step ? "is-current" : "";
      return '<li class="' + cls + '"' + (n === step ? ' aria-current="step"' : "") + '><span class="sdx-step-n">' + n + "</span><span class=\"sdx-step-l\">" + esc(label) + "</span></li>";
    }).join("");

    this.root.setAttribute("lang", L);
    this.root.innerHTML =
      '<div class="sdx">' +
        '<header class="sdx-head">' +
          '<div><h2 class="sdx-title">' + esc(this.t("title")) + "</h2>" +
          (step === 1 ? '<p class="sdx-intro">' + esc(this.t("intro")) + "</p>" : "") + "</div>" +
          '<button type="button" class="sdx-lang" data-act="lang">' + esc(this.t("lang")) + "</button>" +
        "</header>" +
        '<ol class="sdx-steps">' + steps + "</ol>" +
        '<div class="sdx-body" tabindex="-1">' + body + "</div>" +
      "</div>";

    if (focus) {
      var b = this.root.querySelector(".sdx-body");
      b.focus({ preventScroll: true });
      var top = this.root.getBoundingClientRect().top;
      if (top < 0) this.root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  Widget.prototype.viewAppliances = function () {
    var L = this.state.lang;
    return '<div class="sdx-grid">' + DATA.map(function (a) {
      return '<button type="button" class="sdx-tile" data-act="appliance" data-val="' + esc(a.id) + '">' +
        icon(a.icon) + '<span>' + esc(a.name[L]) + "</span></button>";
    }).join("") + "</div>" +
      '<p class="sdx-skip"><a data-act="book" href="' + esc(bookHref()) + '"' + bookAttr() + '>' + esc(this.t("skip")) + "</a></p>";
  };

  Widget.prototype.viewSymptoms = function () {
    var L = this.state.lang;
    var a = this.current().a;
    return '<div class="sdx-picked">' + icon(a.icon) + "<strong>" + esc(a.name[L]) + "</strong></div>" +
      '<div class="sdx-list">' + a.symptoms.map(function (s) {
        return '<button type="button" class="sdx-option' + (s.emergency ? " is-emergency" : "") + '" data-act="symptom" data-val="' + esc(s.id) + '">' +
          esc(s.label[L]) + "</button>";
      }).join("") + "</div>" +
      this.nav(false);
  };

  Widget.prototype.viewResult = function () {
    var L = this.state.lang;
    var c = this.current();
    var a = c.a, s = c.sym;
    var summary = a.name.en + " — " + s.label.en; // technicians read English

    if (s.emergency) {
      return '<div class="sdx-emergency" role="alert"><h3>' + esc(this.t("emergencyTitle")) + "</h3><ol>" +
        s.steps[L].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
        "</ol></div>" + this.nav(true);
    }

    var html = '<div class="sdx-picked">' + icon(a.icon) + "<strong>" + esc(a.name[L]) + "</strong><span>" + esc(s.label[L]) + "</span></div>";
    if (s.urgent) html += '<p class="sdx-urgent">' + esc(typeof s.urgent === "object" ? s.urgent[L] : this.t("urgent")) + "</p>";

    // 1. Booking first
    html += '<section class="sdx-cta"><h3>' + esc(this.t("ctaTitle")) + "</h3>" +
      '<p class="sdx-sameday">' + esc(this.t("sameDay")) + "</p>" +
      this.buttons(summary, true) +
      '<p class="sdx-tell">' + esc(this.t("tellTech")) + " <code>" + esc(summary) + "</code> " +
      '<button type="button" class="sdx-copy" data-act="copy" data-text="' + esc(summary) + '">' + esc(this.t("copy")) + "</button></p>" +
      "</section>";

    // 2. Price
    html += this.priceBlock(s.price);

    // 3. What the technician checks — shows expertise, gives no DIY instructions
    html += '<section class="sdx-block"><h3>' + esc(this.t("techChecks")) + '</h3><ul class="sdx-causes">' +
      s.checks[L].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";

    // 4. Why a professional
    html += '<section class="sdx-block"><h3>' + esc(this.t("whyPro")) + "</h3><p>" + esc(this.t("whyProText")) + "</p>" +
      '<ul class="sdx-perks">' + this.t("perks").map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";

    // 5. Repeat the buttons at the end of the scroll
    html += '<div class="sdx-bottom">' + this.buttons(summary, false) + "</div>";

    return html + this.nav(true);
  };

  Widget.prototype.buttons = function (summary, withText) {
    var sms = "";
    if (withText && CFG.smsNumber) {
      var body = encodeURIComponent(this.t("smsBody")(summary));
      sms = '<a class="sdx-btn sdx-btn-ghost" data-act="text" href="sms:' + esc(CFG.smsNumber) + "?&body=" + body + '">' + esc(this.t("text")) + "</a>";
    }
    return '<div class="sdx-row">' +
      '<a class="sdx-btn sdx-btn-main" data-act="book" href="' + esc(bookHref(this.state.appliance, this.state.symptom)) + '"' + bookAttr() + '>' + esc(this.t("book")) + "</a>" +
      '<a class="sdx-btn sdx-btn-ghost" data-act="call" href="' + esc(CFG.phoneHref) + '">' + esc(this.t("call")) + " " + esc(CFG.phoneDisplay) + "</a>" +
      sms + "</div>";
  };

  Widget.prototype.priceBlock = function (p) {
    var left = Math.min(100, (p[0] / PRICE_SCALE_MAX) * 100);
    var width = Math.min(100 - left, ((p[1] - p[0]) / PRICE_SCALE_MAX) * 100);
    var fee = CFG.diagnosticFee != null ? '<p class="sdx-fee">' + esc(this.t("fee")(CFG.diagnosticFee, CFG.feeWaivedWithRepair)) + "</p>" : "";
    return '<section class="sdx-block"><h3>' + esc(this.t("priceRange")) + "</h3>" +
      '<p class="sdx-price">$' + p[0] + "–$" + p[1] + "</p>" +
      '<div class="sdx-bar" aria-hidden="true"><span style="left:' + left + "%;width:" + width + '%"></span></div>' +
      '<div class="sdx-scale" aria-hidden="true"><span>$0</span><span>$' + PRICE_SCALE_MAX + "+</span></div>" +
      '<p class="sdx-note">' + esc(this.t("priceNote")) + "</p>" + fee + "</section>";
  };

  Widget.prototype.nav = function (withRestart) {
    return '<div class="sdx-nav"><button type="button" class="sdx-link" data-act="back">← ' + esc(this.t("back")) + "</button>" +
      (withRestart ? '<button type="button" class="sdx-link" data-act="restart">' + esc(this.t("startOver")) + "</button>" : "") + "</div>";
  };

  Widget.prototype.select = function (applianceId) {
    if (!DATA.some(function (a) { return a.id === applianceId; })) return;
    this.state.appliance = applianceId; this.state.symptom = null;
    track("appliance", { appliance: applianceId, source: "external" });
    this.render(false);
    this.root.scrollIntoView({ behavior: "smooth", block: "start" });
    var b = this.root.querySelector(".sdx-body"); if (b) b.focus({ preventScroll: true });
  };

  var instances = [];
  function mountAll() {
    var nodes = document.querySelectorAll("[data-solvy-diagnostic]");
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__sdx) { nodes[i].__sdx = new Widget(nodes[i]); instances.push(nodes[i].__sdx); }
    }
  }

  window.SOLVY_ICON = icon;

  // Public API: SOLVY_DX.select("washer") opens the widget on that appliance
  window.SOLVY_DX = { select: function (id) { if (instances[0]) instances[0].select(id); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
