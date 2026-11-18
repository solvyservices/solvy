/*
 * SOLVY booking request — multi-step form (idea taken from Home Alliance's on-site booking)
 * Mounts into [data-booking]. Prefill with book.html?a=washer&s=drain
 *
 * Sending:
 *  - If SITE_CONFIG.leadEndpoint is set (Google Apps Script web app), the request is POSTed there
 *    (saved to a Google Sheet + email to the owner — see tools/google-apps-script.gs).
 *  - Otherwise the last step offers "Send by text" / "Send by email" with everything filled in.
 */
(function () {
  "use strict";
  var root = document.querySelector("[data-booking]");
  var SITE = window.SITE_CONFIG, DATA = window.SOLVY_DATA, icon = window.SOLVY_ICON;
  if (!root || !SITE || !DATA) return;

  var STEPS = ["Appliance", "Problem", "Brand", "Time", "Your details"];
  var WINDOWS = SITE.arrivalWindows || ["Morning", "Midday", "Afternoon"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var params = new URLSearchParams(location.search);
  var st = {
    step: 0, appliance: null, symptom: null, other: "", brand: null,
    day: null, window: null, name: "", phone: "", zip: "", address: "", notes: "",
    sent: false, error: ""
  };
  var pre = DATA.find(function (a) { return a.id === params.get("a"); });
  if (pre) {
    st.appliance = pre.id; st.step = 1;
    if (pre.symptoms.some(function (s) { return s.id === params.get("s") && !s.emergency; })) { st.symptom = params.get("s"); st.step = 2; }
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function track(ev, p) { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: "solvy_book_" + ev }, p || {})); } catch (e) { /* ignore */ } }
  function appliance() { return DATA.find(function (a) { return a.id === st.appliance; }); }
  function symptom() { var a = appliance(); return a && a.symptoms.find(function (s) { return s.id === st.symptom; }); }
  function digits(s) { return String(s).replace(/\D/g, ""); }
  function fmtPhone(s) { var d = digits(s).slice(-10); return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : s; }

  /* ---------- days the business is open, next 7 ---------- */
  function nowLocal() {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hour12: false }).formatToParts(new Date());
    var g = function (t) { return +(p.find(function (x) { return x.type === t; }) || {}).value; };
    return { date: new Date(g("year"), g("month") - 1, g("day")), hour: g("hour") % 24 };
  }
  function dayOptions() {
    var n = nowLocal(), out = [];
    for (var i = 0; out.length < 6 && i < 14; i++) {
      var d = new Date(n.date); d.setDate(d.getDate() + i);
      var h = SITE.hours[String(d.getDay())];
      if (!h) continue;
      if (i === 0 && n.hour >= h[1] - 2) continue; // too late for today
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAYS[d.getDay()];
      out.push({ iso: iso, label: label, sub: MONTHS[d.getMonth()] + " " + d.getDate(), today: i === 0 });
    }
    return out;
  }
  function dayLabel(iso) { var o = dayOptions().find(function (x) { return x.iso === iso; }); return o ? o.label + ", " + o.sub : iso; }

  /* ---------- summary ---------- */
  function summaryLines() {
    var a = appliance(), s = symptom();
    return [
      "Appliance: " + (a ? a.name.en : ""),
      "Problem: " + (s ? s.label.en : "Other — " + st.other),
      "Brand: " + (st.brand || "Not sure"),
      "Preferred time: " + dayLabel(st.day) + ", " + st.window,
      "Name: " + st.name,
      "Phone: " + fmtPhone(st.phone),
      "Address: " + [st.address, st.zip].filter(Boolean).join(", "),
      st.notes ? "Notes: " + st.notes : ""
    ].filter(Boolean);
  }

  /* ---------- views ---------- */
  function chips(list, current, act) {
    return '<div class="bk-chips">' + list.map(function (x) {
      var val = typeof x === "string" ? x : x.value, lab = typeof x === "string" ? x : x.label;
      return '<button type="button" class="bk-chip' + (current === val ? " is-on" : "") + '" aria-pressed="' + (current === val) + '" data-act="' + act + '" data-val="' + esc(val) + '">' + lab + "</button>";
    }).join("") + "</div>";
  }

  function vAppliance() {
    return '<h2 class="bk-q">What needs fixing?</h2><div class="sdx-grid">' + DATA.map(function (a) {
      return '<button type="button" class="sdx-tile' + (st.appliance === a.id ? " is-on" : "") + '" data-act="appliance" data-val="' + a.id + '">' + icon(a.icon) + "<span>" + esc(a.name.en) + "</span></button>";
    }).join("") + "</div>";
  }

  function vProblem() {
    var a = appliance();
    var s = symptom();
    if (s && s.emergency) {
      return '<div class="sdx-emergency" role="alert"><h3>Stop. Do this now:</h3><ol>' +
        s.steps.en.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>" + nav(false);
    }
    return '<h2 class="bk-q">What’s happening with the ' + esc(a.name.en.toLowerCase()) + '?</h2><div class="sdx-list">' +
      a.symptoms.map(function (x) {
        return '<button type="button" class="sdx-option' + (x.emergency ? " is-emergency" : "") + (st.symptom === x.id ? " is-on" : "") + '" data-act="symptom" data-val="' + x.id + '">' + esc(x.label.en) + "</button>";
      }).join("") +
      '<button type="button" class="sdx-option' + (st.symptom === "other" ? " is-on" : "") + '" data-act="symptom" data-val="other">Something else</button></div>' +
      (st.symptom === "other" ? '<label class="bk-label" for="bk-other">Describe the problem</label><textarea id="bk-other" class="bk-input" rows="3" data-field="other" placeholder="e.g. shows error code F21">' + esc(st.other) + "</textarea>" : "") +
      nav(st.symptom === "other");
  }

  function vBrand() {
    return '<h2 class="bk-q">Which brand is it?</h2><p class="bk-hint">Helps the technician bring the right parts.</p>' +
      chips((SITE.brands || []).concat(["Other", "Not sure"]), st.brand, "brand") + nav(!!st.brand);
  }

  function vTime() {
    var days = dayOptions();
    var html = '<h2 class="bk-q">When works for you?</h2><p class="bk-label">Day</p><div class="bk-chips">' + days.map(function (d) {
      return '<button type="button" class="bk-chip bk-day' + (st.day === d.iso ? " is-on" : "") + '" aria-pressed="' + (st.day === d.iso) + '" data-act="day" data-val="' + d.iso + '"><strong>' + d.label + "</strong><span>" + d.sub + "</span></button>";
    }).join("") + "</div>";
    var today = days.find(function (d) { return d.iso === st.day && d.today; });
    if (today) html += '<p class="bk-hint">Same-day slots depend on availability. We’ll confirm by phone.</p>';
    html += '<p class="bk-label">Arrival window</p>' + chips(WINDOWS, st.window, "window");
    return html + nav(!!(st.day && st.window));
  }

  function vContact() {
    return '<h2 class="bk-q">Where should we come?</h2>' +
      '<div class="bk-grid">' +
      field("name", "Your name", "text", "name", "Full name") +
      field("phone", "Phone", "tel", "tel", "(407) 555-0123") +
      field("address", "Street address", "text", "street-address", "123 Main St, Apt 4", true) +
      field("zip", "ZIP code", "text", "postal-code", "32801") +
      "</div>" +
      '<label class="bk-label" for="bk-notes">Anything else? <span>(optional)</span></label>' +
      '<textarea id="bk-notes" class="bk-input" rows="2" data-field="notes" placeholder="Gate code, model number, best time to call">' + esc(st.notes) + "</textarea>" +
      (st.error ? '<p class="bk-error" role="alert">' + esc(st.error) + "</p>" : "") +
      '<p class="bk-consent">By sending, you agree that SOLVY may call or text you about this request.</p>' +
      '<div class="sdx-nav"><button type="button" class="sdx-link" data-act="back">← Back</button>' +
      '<button type="button" class="sdx-btn sdx-btn-main" data-act="submit">' + (SITE.leadEndpoint ? "Send request" : "Review and send") + "</button></div>";
  }

  function field(name, label, type, ac, ph, wide) {
    var extra = name === "zip" ? ' inputmode="numeric" maxlength="5"' : name === "phone" ? ' inputmode="tel"' : "";
    return '<div class="bk-field' + (wide ? " is-wide" : "") + '"><label class="bk-label" for="bk-' + name + '">' + label + "</label>" +
      '<input id="bk-' + name + '" class="bk-input" type="' + type + '" autocomplete="' + ac + '"' + extra + ' data-field="' + name + '" value="' + esc(st[name]) + '" placeholder="' + esc(ph) + '"></div>';
  }

  function vDone() {
    var lines = summaryLines();
    var text = "New repair request\n" + lines.join("\n");
    var summary = '<ul class="bk-summary">' + lines.map(function (l) { var i = l.indexOf(": "); return "<li><span>" + esc(l.slice(0, i)) + "</span>" + esc(l.slice(i + 2)) + "</li>"; }).join("") + "</ul>";
    if (st.sent) {
      return '<div class="bk-done"><h2 class="bk-q">Request received.</h2><p>' + esc(SITE.replyPromise || "We’ll call you to confirm the time.") + "</p>" + summary +
        '<p class="bk-hint">Need it sooner? <a href="tel:' + esc(SITE.phoneE164) + '">Call ' + esc(SITE.phoneDisplay) + "</a></p></div>";
    }
    var sms = "sms:" + SITE.phoneE164 + "?&body=" + encodeURIComponent(text);
    var mail = "mailto:" + SITE.email + "?subject=" + encodeURIComponent("Repair request — " + (appliance() ? appliance().name.en : "")) + "&body=" + encodeURIComponent(text);
    return '<div class="bk-done"><h2 class="bk-q">Almost done — send your request</h2>' +
      "<p>Check the details and send them to us in one tap. We’ll confirm the time.</p>" + summary +
      '<div class="sdx-row">' +
      '<a class="sdx-btn sdx-btn-main" data-act="sent" href="' + esc(sms) + '">Send by text</a>' +
      '<a class="sdx-btn sdx-btn-ghost" data-act="sent" href="' + esc(mail) + '">Send by email</a>' +
      "</div>" +
      (SITE.bookingUrl ? '<p class="bk-hint">Prefer to pick an exact time yourself? <a href="' + esc(SITE.bookingUrl) + '" target="_blank" rel="noopener">Use our online scheduler</a></p>' : "") +
      '<div class="sdx-nav"><button type="button" class="sdx-link" data-act="back">← Edit details</button></div></div>';
  }

  function nav(canNext) {
    return '<div class="sdx-nav">' + (st.step > 0 ? '<button type="button" class="sdx-link" data-act="back">← Back</button>' : "<span></span>") +
      (canNext ? '<button type="button" class="sdx-btn sdx-btn-main" data-act="next">Continue</button>' : "") + "</div>";
  }

  function render(focus) {
    var views = [vAppliance, vProblem, vBrand, vTime, vContact, vDone];
    var cur = Math.min(st.step, 4);
    var steps = STEPS.map(function (l, i) {
      var cls = st.step > i ? "is-done" : i === cur ? "is-current" : "";
      return '<li class="' + cls + '"' + (i === cur ? ' aria-current="step"' : "") + '><span class="sdx-step-n">' + (i + 1) + '</span><span class="sdx-step-l">' + l + "</span></li>";
    }).join("");
    root.innerHTML = '<div class="sdx bk">' + (st.step < 5 ? '<ol class="sdx-steps bk-steps">' + steps + "</ol>" : "") +
      '<div class="sdx-body" tabindex="-1">' + views[st.step]() + "</div></div>";
    if (focus) {
      root.querySelector(".sdx-body").focus({ preventScroll: true });
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function go(step) { st.step = step; st.error = ""; track("step", { step: STEPS[step] || "review" }); render(true); }

  function validate() {
    if (st.name.trim().length < 2) return "Enter your name.";
    if (digits(st.phone).length < 10) return "Enter a 10-digit phone number so we can confirm the time.";
    if (!/^\d{5}$/.test(st.zip)) return "Enter a 5-digit ZIP code.";
    if (st.address.trim().length < 4) return "Enter the street address.";
    return "";
  }

  function submit() {
    st.error = validate();
    if (st.error) { render(false); var b = root.querySelector(".bk-error"); if (b) b.scrollIntoView({ block: "center" }); return; }
    var inArea = (SITE.zipPrefixes || []).some(function (p) { return st.zip.indexOf(p) === 0; });
    track("submit", { appliance: st.appliance, symptom: st.symptom, in_area: inArea });
    if (!SITE.leadEndpoint) { go(5); return; }
    var payload = {
      createdAt: new Date().toISOString(), appliance: appliance().name.en,
      problem: symptom() ? symptom().label.en : "Other: " + st.other, brand: st.brand, day: st.day, window: st.window,
      name: st.name, phone: fmtPhone(st.phone), address: st.address, zip: st.zip, inArea: inArea, notes: st.notes,
      page: location.href
    };
    var btn = root.querySelector('[data-act="submit"]'); if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    fetch(SITE.leadEndpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function () { st.sent = true; go(5); })
      .catch(function () { st.sent = false; go(5); }); // network failure → fall back to text/email
  }

  root.addEventListener("input", function (e) {
    var f = e.target.getAttribute("data-field"); if (!f) return;
    if (f === "zip") e.target.value = digits(e.target.value).slice(0, 5);
    st[f] = e.target.value;
  });

  root.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    var act = el.getAttribute("data-act"), val = el.getAttribute("data-val");
    if (act === "appliance") { if (st.appliance !== val) st.symptom = null; st.appliance = val; go(1); }
    else if (act === "symptom") {
      st.symptom = val;
      var s = symptom();
      if (val === "other" || (s && s.emergency)) { render(false); var t = root.querySelector("#bk-other"); if (t) t.focus(); }
      else go(2);
    }
    else if (act === "brand") { st.brand = val; go(3); }
    else if (act === "day") { st.day = val; render(false); }
    else if (act === "window") { st.window = val; if (st.day) go(4); else render(false); }
    else if (act === "next") { if (st.step === 1 && st.symptom === "other" && !st.other.trim()) return; go(st.step + 1); }
    else if (act === "back") { go(Math.max(0, (st.step === 5 ? 4 : st.step - 1))); }
    else if (act === "submit") { submit(); }
    else if (act === "sent") { track("sent_manual", { via: el.href.indexOf("sms:") === 0 ? "sms" : "email" }); }
  });

  render(false);
})();
