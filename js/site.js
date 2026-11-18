/*
 * SOLVY site — small interactive pieces (no dependencies)
 * Settings come from content/site.json via js/generated.js (run build.py).
 */
(function () {
  "use strict";

  var SITE_CONFIG = window.SITE_CONFIG; // generated from content/site.json
  if (!SITE_CONFIG) return;
  var BOOK = SITE_CONFIG.bookHref, TEL = "tel:" + SITE_CONFIG.phoneE164, PHONE = SITE_CONFIG.phoneDisplay;

  /* ---------- Open now / closed indicator ---------- */
  function nowInTZ() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: SITE_CONFIG.timeZone, weekday: "short", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(new Date());
    var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[get("weekday")], hour: (+get("hour")) % 24 + (+get("minute")) / 60 };
  }
  function fmt(h) { var ap = h >= 12 ? "pm" : "am"; var x = h % 12 || 12; return x + " " + ap; }
  function dayName(d) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]; }

  function updateStatus() {
    var el = document.querySelector("[data-open-status]");
    if (!el) return;
    var n = nowInTZ(), h = SITE_CONFIG.hours[String(n.day)];
    if (h && n.hour >= h[0] && n.hour < h[1]) {
      el.className = "status is-open";
      el.textContent = "Open now · until " + fmt(h[1]) + (n.hour < 12 ? " · same-day slots still available" : "");
      return;
    }
    // find next opening
    for (var i = 0; i < 7; i++) {
      var d = (n.day + i) % 7, hh = SITE_CONFIG.hours[String(d)];
      if (!hh) continue;
      if (i === 0 && n.hour >= hh[0]) continue;
      el.className = "status is-closed";
      el.textContent = "Closed now · opens " + (i === 0 ? "today" : i === 1 ? "tomorrow" : dayName(d)) + " at " + fmt(hh[0]) + " · book online anytime";
      return;
    }
  }

  /* ---------- ZIP checker ---------- */
  function initZip() {
    var form = document.querySelector("[data-zip]");
    if (!form) return;
    var input = form.querySelector("input"), out = form.querySelector("[data-zip-out]");
    input.addEventListener("input", function () { input.value = input.value.replace(/\D/g, "").slice(0, 5); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var z = input.value;
      if (!/^\d{5}$/.test(z)) {
        out.className = "zip-out is-err";
        out.textContent = "Enter a 5-digit ZIP code.";
        input.focus();
        return;
      }
      var ok = SITE_CONFIG.zipPrefixes.some(function (p) { return z.indexOf(p) === 0; }) && SITE_CONFIG.zipExclude.indexOf(z) < 0;
      if (ok) {
        out.className = "zip-out is-ok";
        out.innerHTML = "Yes, we come to " + z + ". <a href=\"" + BOOK + "\">Book a time</a>";
      } else {
        out.className = "zip-out is-maybe";
        out.innerHTML = z + " may be outside our usual area. <a href=\"" + TEL + "\">Call " + PHONE + "</a> and we’ll confirm.";
      }
      try { (window.dataLayer = window.dataLayer || []).push({ event: "solvy_zip_check", zip_ok: ok }); } catch (err) { /* ignore */ }
    });
  }

  /* ---------- Header shadow + mobile bar after hero ---------- */
  function initScroll() {
    var head = document.querySelector("[data-head]");
    var bar = document.querySelector("[data-mbar]");
    var hero = document.querySelector(".hero");
    function on() {
      var y = window.scrollY;
      if (head) head.classList.toggle("is-scrolled", y > 8);
      if (bar) bar.classList.toggle("is-shown", y > (hero ? hero.offsetHeight * 0.6 : 240));
    }
    window.addEventListener("scroll", on, { passive: true });
    on();
  }

  /* ---------- Mobile menu + Services submenu ---------- */
  function initMenu() {
    var btn = document.querySelector("[data-menu-btn]"), nav = document.querySelector("[data-nav]");
    if (btn && nav) btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
    });
    document.querySelectorAll("[data-sub-btn]").forEach(function (b) {
      b.addEventListener("click", function () {
        var open = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", String(open));
        b.parentNode.classList.toggle("is-open", open);
      });
    });
    document.addEventListener("click", function (e) {
      document.querySelectorAll(".nav-group.is-open").forEach(function (g) {
        if (!g.contains(e.target) && window.matchMedia("(min-width: 981px)").matches) {
          g.classList.remove("is-open"); g.querySelector("[data-sub-btn]").setAttribute("aria-expanded", "false");
        }
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".nav-group.is-open").forEach(function (g) { g.classList.remove("is-open"); g.querySelector("[data-sub-btn]").setAttribute("aria-expanded", "false"); });
      if (btn && nav && nav.classList.contains("is-open")) { btn.click(); btn.focus(); }
    });
  }

  function init() {
    updateStatus(); setInterval(updateStatus, 60000);
    initZip(); initScroll(); initMenu();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
