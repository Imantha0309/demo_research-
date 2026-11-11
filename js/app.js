/* ==========================================================================
   Space Monitoring System — application shell, router, UI helpers
   ========================================================================== */

(function (HSM) {
  "use strict";

  HSM.pages = {};
  HSM.pendingOpen = null;
  HSM.registerPage = function (route, page) { HSM.pages[route] = page; };

  /* -------------------------------- Event bus ----------------------------- */

  var listeners = {};
  HSM.bus = {
    on: function (event, handler) {
      (listeners[event] = listeners[event] || []).push(handler);
    },
    off: function (event, handler) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(function (h) { return h !== handler; });
    },
    emit: function (event, payload) {
      (listeners[event] || []).forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error("[HSM bus]", err); }
      });
    }
  };

  /* --------------------------------- Charts ------------------------------- */

  HSM.charts = {
    instances: {},
    theme: function () {
      var css = getComputedStyle(document.documentElement);
      function v(name) { return css.getPropertyValue(name).trim(); }
      return {
        text: v("--muted"),
        textStrong: v("--text"),
        grid: v("--line"),
        card: v("--card"),
        bg: v("--bg"),
        green: v("--green"),
        red: v("--red"),
        orange: v("--orange"),
        blue: v("--blue"),
        grey: v("--grey"),
        accent: v("--accent"),
        navy: v("--navy"),
        darkRed: v("--dark-red")
      };
    },
    create: function (id, config) {
      if (typeof window.Chart === "undefined") return null;
      this.destroy(id);
      var canvas = document.getElementById(id);
      if (!canvas) return null;
      var chart = new window.Chart(canvas.getContext("2d"), config);
      this.instances[id] = chart;
      return chart;
    },
    get: function (id) { return this.instances[id] || null; },
    destroy: function (id) {
      if (this.instances[id]) {
        try { this.instances[id].destroy(); } catch (err) { /* noop */ }
        delete this.instances[id];
      }
    },
    destroyAll: function () {
      var self = this;
      Object.keys(this.instances).forEach(function (id) { self.destroy(id); });
    },
    refreshTheme: function () {
      var t = this.theme();
      if (typeof window.Chart !== "undefined") window.Chart.defaults.color = t.text;
      var self = this;
      Object.keys(this.instances).forEach(function (id) {
        var chart = self.instances[id];
        if (!chart) return;
        var opts = chart.options || {};
        var plugins = opts.plugins || {};
        if (plugins.legend && plugins.legend.labels) plugins.legend.labels.color = t.text;
        if (plugins.centerText) {
          plugins.centerText.color = t.textStrong;
          plugins.centerText.subColor = t.text;
        }
        Object.keys(opts.scales || {}).forEach(function (key) {
          var scale = opts.scales[key];
          if (scale.ticks) scale.ticks.color = t.text;
          if (scale.grid && scale.grid.display !== false) scale.grid.color = t.grid;
          if (scale.pointLabels) scale.pointLabels.color = t.text;
          if (scale.angleLines) scale.angleLines.color = t.grid;
        });
        chart.update("none");
      });
    },
    axis: function (opts) {
      opts = opts || {};
      var t = this.theme();
      return {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: t.text, font: { size: 9.5 }, maxRotation: 0, autoSkip: true, maxTicksLimit: opts.xTicks || 12 },
          border: { display: false }
        },
        y: {
          beginAtZero: opts.beginAtZero !== false,
          max: opts.max,
          grid: { color: t.grid, drawBorder: false },
          border: { display: false },
          ticks: {
            color: t.text,
            font: { size: 9.5 },
            precision: 0,
            callback: opts.callback || function (value) { return value; }
          }
        }
      };
    }
  };

  /* --------------------------------- UI ----------------------------------- */

  var TONE_COLORS = {
    green: "var(--green)", red: "var(--red)", orange: "var(--orange)",
    blue: "var(--blue)", grey: "var(--grey)", yellow: "var(--accent)", "dark-red": "var(--dark-red)"
  };

  var ui = {
    esc: HSM.util.escapeHtml,

    modal: function (opts) {
      if (typeof window.bootstrap === "undefined") return null;
      var el = document.createElement("div");
      el.className = "modal fade hsm-modal";
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      var footer = opts.footer
        ? '<div class="modal-footer">' + opts.footer + "</div>"
        : "";
      el.innerHTML =
        '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ' + (opts.size || "modal-lg") + '">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<div><h2 class="modal-title">' + opts.title + "</h2>" +
              (opts.subtitle ? '<div class="modal-sub">' + opts.subtitle + "</div>" : "") + "</div>" +
              '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
            "</div>" +
            '<div class="modal-body">' + opts.body + "</div>" +
            footer +
          "</div>" +
        "</div>";
      document.body.appendChild(el);
      var instance = new window.bootstrap.Modal(el, { backdrop: true, keyboard: true });
      el.addEventListener("hidden.bs.modal", function () {
        try { instance.dispose(); } catch (err) { /* noop */ }
        el.remove();
      });
      if (opts.onShown) {
        el.addEventListener("shown.bs.modal", function () { opts.onShown(el); }, { once: true });
      }
      instance.show();
      return {
        el: el,
        modal: instance,
        hide: function () { instance.hide(); }
      };
    },

    confirm: function (opts) {
      var controller;
      var tone = opts.tone === "danger" ? "btn-danger-soft" : "btn-navy";
      controller = ui.modal({
        title: opts.title || "Please confirm",
        size: "modal-md",
        body: '<div class="d-flex gap-3 align-items-start">' +
          '<div class="detail-hero" style="margin:0;padding:0;border:0;background:transparent;flex:0 0 auto">' +
          '<div class="dh-icon tone-' + (opts.tone === "danger" ? "red" : "orange") + '"><i class="bi ' +
          (opts.tone === "danger" ? "bi-exclamation-triangle" : "bi-question-circle") + '"></i></div></div>' +
          '<p style="margin:0;font-size:12px;line-height:1.6">' + opts.message + "</p></div>",
        footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Cancel</button>' +
          '<button type="button" class="btn ' + tone + '" id="hsmConfirmAction">' + (opts.confirmLabel || "Confirm") + "</button>",
        onShown: function (el) {
          el.querySelector("#hsmConfirmAction").addEventListener("click", function () {
            controller.hide();
            if (typeof opts.onConfirm === "function") opts.onConfirm();
          });
        }
      });
      return controller;
    },

    toast: function (opts) {
      if (typeof opts === "string") opts = { title: opts };
      opts = opts || {};
      var container = document.getElementById("toastContainer");
      if (!container) return;
      var tone = opts.tone || "green";
      var icons = {
        green: "bi-check-circle-fill", red: "bi-exclamation-octagon-fill",
        orange: "bi-exclamation-triangle-fill", blue: "bi-info-circle-fill",
        yellow: "bi-bell-fill", grey: "bi-activity"
      };
      var el = document.createElement("div");
      el.className = "hsm-toast";
      el.style.setProperty("--toast-tone", TONE_COLORS[tone] || "var(--green)");
      el.innerHTML =
        '<div class="toast-ic"><i class="bi ' + (opts.icon || icons[tone] || icons.green) + '"></i></div>' +
        '<div class="toast-copy"><strong>' + (opts.title || "Update") + "</strong>" +
        (opts.message ? "<p>" + opts.message + "</p>" : "") + "</div>" +
        '<button type="button" class="toast-close" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>';
      container.appendChild(el);
      var dismiss = function () {
        if (el.classList.contains("is-out")) return;
        el.classList.add("is-out");
        setTimeout(function () { el.remove(); }, 240);
      };
      el.querySelector(".toast-close").addEventListener("click", dismiss);
      var timer = setTimeout(dismiss, 5000);
      el.addEventListener("mouseenter", function () { clearTimeout(timer); });
      el.addEventListener("mouseleave", function () { timer = setTimeout(dismiss, 2200); });
    },

    beep: function () {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        var ctx = new Ctx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.035, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        osc.onended = function () { ctx.close().catch(function () {}); };
      } catch (err) { /* audio is optional */ }
    },

    downloadCSV: function (filename, csv) {
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
    },

    csvCell: function (value) {
      var str = String(value == null ? "" : value);
      if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    },

    badge: HSM.statusBadge,

    toneColor: function (tone) {
      var t = HSM.charts.theme();
      return t[tone] || t.grey;
    },

    statIcon: function (icon, tone) {
      return '<div class="kpi-icon tone-' + tone + '"><i class="bi ' + icon + '"></i></div>';
    }
  };
  HSM.ui = ui;

  /* ------------------------------- After data ----------------------------- */

  HSM.afterData = function (areas) {
    HSM.store.save();
    HSM.refreshNotifications();
    HSM.bus.emit("data:changed", { areas: areas || [] });
  };

  HSM.raiseAlert = function (payload) {
    var result = HSM.store.addAlert(payload);
    if (!result.created) return result.alert;
    HSM.store.addActivity("alert", payload.title, "Priority: " + payload.priority + " · " + (payload.facility || "General"), "bi-bell-fill");
    HSM.store.save();
    HSM.refreshNotifications();
    if (HSM.settings.notifications.alerts) {
      ui.toast({
        title: payload.title,
        message: payload.description,
        tone: payload.priority === "critical" ? "red" : payload.priority === "warning" ? "orange" : "blue",
        icon: "bi-bell-fill"
      });
    }
    if (HSM.settings.notifications.sound) ui.beep();
    if (HSM.router.current && HSM.router.current.onData) {
      try { HSM.router.current.onData(["alerts"]); } catch (err) { console.error(err); }
    }
    return result.alert;
  };

  HSM.resolveAlert = function (id, silent) {
    var alert = HSM.store.getAlert(id);
    if (!alert || alert.status === "resolved") return;
    alert.status = "resolved";
    alert.resolvedAt = new Date().toISOString();
    alert.unread = false;
    HSM.store.addActivity("alert", "Alert resolved: " + alert.title, "Marked resolved by the demo operator", "bi-check2-circle");
    HSM.store.save();
    HSM.refreshNotifications();
    if (!silent) {
      ui.toast({ title: "Alert resolved", message: alert.title, tone: "green", icon: "bi-check2-circle" });
    }
    if (HSM.router.current && HSM.router.current.onData) {
      try { HSM.router.current.onData(["alerts"]); } catch (err) { console.error(err); }
    }
  };

  HSM.markAlertRead = function (id) {
    var alert = HSM.store.getAlert(id);
    if (alert) {
      alert.unread = false;
      HSM.store.save();
      HSM.refreshNotifications();
    }
  };

  HSM.markAllAlertsRead = function () {
    HSM.db.alerts.forEach(function (a) { a.unread = false; });
    HSM.store.save();
    HSM.refreshNotifications();
    ui.toast({ title: "All notifications marked as read", tone: "blue", icon: "bi-check2-all" });
  };

  /* ------------------------------ Notifications --------------------------- */

  HSM.refreshNotifications = function () {
    var counts = HSM.stats.alertCounts();
    var bell = document.getElementById("bellCount");
    var navCount = document.querySelector(".js-nav-alerts");
    if (bell) {
      bell.textContent = counts.unread > 9 ? "9+" : String(counts.unread);
      bell.classList.toggle("is-zero", counts.unread === 0);
    }
    if (navCount) {
      navCount.textContent = counts.open;
      navCount.classList.toggle("is-zero", counts.open === 0);
    }
    var list = document.getElementById("notificationList");
    if (!list) return;
    var open = HSM.db.alerts.filter(function (a) { return a.status === "open"; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
      .slice(0, 6);
    if (!open.length) {
      list.innerHTML = '<div class="notification-empty"><i class="bi bi-bell-slash d-block mb-2" style="font-size:20px"></i>You are all caught up.</div>';
      return;
    }
    list.innerHTML = open.map(function (a) {
      var meta = HSM.meta(a.priority);
      return '<button type="button" class="notification-item ' + (a.unread ? "" : "is-read") + '" data-notify-id="' + a.id + '">' +
        '<span class="ni-icon tone-' + meta.tone + '" style="background:var(--' + (meta.tone === "dark-red" ? "dark-red-soft" : meta.tone + "-soft") + ')"><i class="bi ' + meta.icon + '"></i></span>' +
        '<span class="ni-main"><strong>' + ui.esc(a.title) + '</strong><small>' + ui.esc(a.facility) + " · " + HSM.util.timeAgo(a.createdAt) + "</small></span>" +
        (a.unread ? '<span class="ni-dot"></span>' : "") +
        "</button>";
    }).join("");
  };

  /* --------------------------------- Router ------------------------------- */

  HSM.router = {
    current: null,
    currentRoute: null,
    routeName: function () {
      var hash = window.location.hash.replace(/^#\/?/, "");
      return (hash.split("?")[0] || "dashboard").toLowerCase();
    },
    init: function () {
      var self = this;
      if (!window.location.hash) {
        try { history.replaceState(null, "", "#/dashboard"); } catch (err) { /* noop */ }
      }
      window.addEventListener("hashchange", function () { self.render(); });
      this.render();
    },
    render: function () {
      var route = this.routeName();
      var page = HSM.pages[route];
      if (!page) {
        try { history.replaceState(null, "", "#/dashboard"); } catch (err) { /* noop */ }
        route = "dashboard";
        page = HSM.pages.dashboard;
      }
      if (this.current && typeof this.current.destroy === "function") {
        try { this.current.destroy(); } catch (err) { console.error("[destroy]", err); }
      }
      HSM.charts.destroyAll();
      this.current = page;
      this.currentRoute = route;

      document.querySelectorAll(".sidebar-nav .nav-link").forEach(function (link) {
        link.classList.toggle("active", link.getAttribute("data-route") === route);
      });
      document.title = (page.title ? page.title + " · " : "") + HSM.settings.hotelName + " · Space Monitoring System";

      var root = document.getElementById("view-root");
      root.innerHTML = "";
      try {
        page.render(root);
      } catch (err) {
        console.error("[render " + route + "]", err);
        root.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>' +
          "<h3>This page could not be rendered</h3><p>Check the browser console for details. You can reset the demo data from Settings.</p></div>";
      }
      window.scrollTo({ top: 0, behavior: "auto" });
      document.body.classList.remove("sidebar-open");

      if (HSM.pendingOpen) {
        var pending = HSM.pendingOpen;
        HSM.pendingOpen = null;
        setTimeout(function () {
          if (HSM.pages[route] && typeof HSM.pages[route].openPending === "function") {
            HSM.pages[route].openPending(pending);
          }
        }, 90);
      }
      HSM.initReveal(root);
    },
    go: function (route) {
      if (this.routeName() === route) this.render();
      else window.location.hash = "#/" + route;
    },
    reload: function () { this.render(); }
  };

  /* ------------------------------- Reveal --------------------------------- */

  var revealObserver = null;
  HSM.initReveal = function (scope) {
    if (!("IntersectionObserver" in window)) return;
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });
    }
    (scope || document).querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
      revealObserver.observe(el);
    });
  };

  /* ------------------------------- Settings ------------------------------- */

  HSM.applySettings = function () {
    document.documentElement.dataset.theme = HSM.settings.theme === "dark" ? "dark" : "light";
    document.querySelectorAll(".js-hotel-name").forEach(function (el) {
      el.textContent = HSM.settings.hotelName;
    });
    var icon = document.querySelector("#themeToggle i");
    if (icon) icon.className = HSM.settings.theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
  };

  HSM.setTheme = function (theme, opts) {
    opts = opts || {};
    HSM.settings.theme = theme === "dark" ? "dark" : "light";
    HSM.store.saveSettings();
    HSM.applySettings();
    if (opts.reload !== false) HSM.router.reload();
    else HSM.charts.refreshTheme();
  };

  /* --------------------------------- Clock -------------------------------- */

  function updateClock() {
    var now = new Date();
    var timeEl = document.getElementById("clockTime");
    var dateEl = document.getElementById("clockDate");
    if (timeEl) timeEl.textContent = now.toLocaleTimeString("en-GB", { hour12: false });
    if (dateEl) dateEl.textContent = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  }

  /* --------------------------------- Search ------------------------------- */

  var searchIndex = [];

  function buildSearchIndex() {
    var items = [];
    HSM.db.rooms.forEach(function (r) {
      var meta = HSM.meta(r.status);
      items.push({ type: "room", id: r.id, route: "rooms", label: "Room " + r.number, sub: r.type + " · Floor " + r.floor + " · " + meta.label, icon: "bi-door-open", tone: meta.tone });
    });
    HSM.db.tables.forEach(function (t) {
      var meta = HSM.meta(t.status);
      items.push({ type: "table", id: t.id, route: "restaurant", label: "Table " + t.number, sub: t.zone + " · " + meta.label, icon: "bi-cup-hot", tone: meta.tone });
    });
    HSM.db.parking.forEach(function (p) {
      var meta = HSM.meta(p.status);
      items.push({ type: "parking", id: p.id, route: "parking", label: "Parking " + p.id, sub: "Zone " + p.zone + " · " + meta.label, icon: "bi-p-square", tone: meta.tone });
    });
    HSM.db.facilities.forEach(function (f) {
      var status = HSM.facilityStatus(f);
      items.push({ type: "facility", id: f.id, route: "facilities", label: f.name, sub: Math.round(status.pct) + "% utilized · " + f.location, icon: f.icon, tone: status.tone });
    });
    HSM.db.cameras.forEach(function (c) {
      items.push({ type: "camera", id: c.id, route: "cameras", label: c.id + " · " + c.name, sub: c.online ? "Online · " + c.location : "Offline · " + c.location, icon: "bi-camera-video", tone: c.online ? "green" : "red" });
    });
    HSM.db.alerts.filter(function (a) { return a.status === "open"; }).forEach(function (a) {
      var meta = HSM.meta(a.priority);
      items.push({ type: "alert", id: a.id, route: "alerts", label: a.title, sub: a.facility + " · " + meta.label, icon: meta.icon, tone: meta.tone });
    });
    return items;
  }

  function renderSearchResults(query) {
    var box = document.getElementById("searchResults");
    if (!box) return;
    var q = query.trim().toLowerCase();
    if (q.length < 2) {
      box.classList.add("d-none");
      box.innerHTML = "";
      return;
    }
    var matches = searchIndex.filter(function (item) {
      return (item.label + " " + item.sub).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 18);

    if (!matches.length) {
      box.innerHTML = '<div class="search-empty"><i class="bi bi-search d-block mb-2" style="font-size:18px"></i>No rooms, tables, spaces or alerts match “' + ui.esc(query) + '”.</div>';
      box.classList.remove("d-none");
      return;
    }

    var groups = {};
    matches.forEach(function (m) { (groups[m.route] = groups[m.route] || []).push(m); });
    var names = { rooms: "Rooms", restaurant: "Restaurant", parking: "Parking", facilities: "Facilities", cameras: "Cameras", alerts: "Alerts" };
    var html = "";
    Object.keys(groups).forEach(function (route) {
      html += '<div class="search-group-label">' + names[route] + "</div>";
      groups[route].forEach(function (m) {
        html += '<button type="button" class="search-result" data-route="' + m.route + '" data-type="' + m.type + '" data-id="' + m.id + '">' +
          '<span class="sr-icon tone-' + m.tone + '"><i class="bi ' + m.icon + '"></i></span>' +
          '<span class="sr-main"><strong>' + ui.esc(m.label) + "</strong><small>" + ui.esc(m.sub) + "</small></span>" +
          '<i class="bi bi-arrow-right" style="font-size:11px;color:var(--muted-2)"></i></button>';
      });
    });
    box.innerHTML = html;
    box.classList.remove("d-none");
  }

  function initSearch() {
    var input = document.getElementById("globalSearch");
    var wrap = document.getElementById("globalSearchWrap");
    var box = document.getElementById("searchResults");
    if (!input || !box) return;

    function rebuild() { searchIndex = buildSearchIndex(); }
    rebuild();

    input.addEventListener("input", function () {
      rebuild();
      renderSearchResults(input.value);
    });
    input.addEventListener("focus", function () {
      if (input.value.trim().length >= 2) renderSearchResults(input.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        box.classList.add("d-none");
        input.blur();
      }
      if (event.key === "Enter") {
        var first = box.querySelector(".search-result");
        if (first && !box.classList.contains("d-none")) first.click();
      }
    });

    box.addEventListener("click", function (event) {
      var btn = event.target.closest(".search-result");
      if (!btn) return;
      var route = btn.getAttribute("data-route");
      var type = btn.getAttribute("data-type");
      var id = btn.getAttribute("data-id");
      input.value = "";
      box.classList.add("d-none");
      input.blur();
      HSM.pendingOpen = { type: type, id: id };
      if (HSM.router.routeName() === route) HSM.router.reload();
      else window.location.hash = "#/" + route;
    });

    document.addEventListener("click", function (event) {
      if (wrap && !wrap.contains(event.target)) box.classList.add("d-none");
    });

    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ------------------------------- Demo strip ----------------------------- */

  HSM.updateSimUI = function () {
    var running = HSM.sim ? HSM.sim.isRunning() : false;
    var btn = document.getElementById("simToggle");
    var stateEl = document.getElementById("sidebarSimState");
    var metaEl = document.getElementById("sidebarSimMeta");
    var speedEl = document.getElementById("simSpeedLabel");
    if (btn) {
      btn.innerHTML = running
        ? '<i class="bi bi-pause-fill"></i> Pause'
        : '<i class="bi bi-play-fill"></i> Start';
      btn.setAttribute("aria-pressed", String(running));
    }
    if (stateEl) stateEl.textContent = running ? "Simulation running" : "Simulation paused";
    if (metaEl) metaEl.textContent = "Demo data · " + HSM.settings.simSpeed + "s cycle";
    if (speedEl) speedEl.textContent = HSM.settings.simSpeed + "s cycle";
    if (HSM.sim) HSM.sim.updateIndicator(running);
  };

  function initDemoControls() {
    var toggle = document.getElementById("simToggle");
    var reset = document.getElementById("simReset");
    var profileReset = document.getElementById("profileReset");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (!HSM.sim) return;
        if (HSM.sim.isRunning()) {
          HSM.sim.pause();
          HSM.ui.toast({ title: "Simulation paused", message: "Live demo data will not change until you resume.", tone: "grey", icon: "bi-pause-fill" });
        } else {
          HSM.sim.start();
          HSM.ui.toast({ title: "Simulation resumed", message: "New simulated events will arrive every " + HSM.settings.simSpeed + " seconds.", tone: "green", icon: "bi-play-fill" });
        }
      });
    }
    function askReset() {
      HSM.ui.confirm({
        title: "Reset demo data?",
        tone: "danger",
        message: "This regenerates all simulated rooms, tables, parking spaces, facilities, cameras and alerts, and clears your saved preferences. This cannot be undone.",
        confirmLabel: "Reset demo",
        onConfirm: function () {
          if (HSM.sim) HSM.sim.resetDemo();
        }
      });
    }
    if (reset) reset.addEventListener("click", askReset);
    if (profileReset) profileReset.addEventListener("click", askReset);
  }

  /* -------------------------------- Topbar -------------------------------- */

  function initTopbar() {
    updateClock();
    setInterval(updateClock, 1000);

    var themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        HSM.setTheme(HSM.settings.theme === "dark" ? "light" : "dark");
        HSM.ui.toast({
          title: "Theme updated",
          message: HSM.settings.theme === "dark" ? "Dark mode is now active." : "Light mode is now active.",
          tone: "blue", icon: "bi-palette"
        });
      });
    }

    var markAll = document.getElementById("markAllRead");
    if (markAll) {
      markAll.addEventListener("click", function (event) {
        event.stopPropagation();
        HSM.markAllAlertsRead();
      });
    }

    var list = document.getElementById("notificationList");
    if (list) {
      list.addEventListener("click", function (event) {
        var item = event.target.closest("[data-notify-id]");
        if (!item) return;
        var id = item.getAttribute("data-notify-id");
        HSM.markAlertRead(id);
        var btn = document.getElementById("bellBtn");
        if (btn && window.bootstrap) {
          var dd = window.bootstrap.Dropdown.getInstance(btn);
          if (dd) dd.hide();
        }
        HSM.pendingOpen = { type: "alert", id: id };
        if (HSM.router.routeName() === "alerts") HSM.router.reload();
        else window.location.hash = "#/alerts";
      });
    }

    var sys = document.getElementById("sysStatus");
    if (sys) {
      sys.addEventListener("click", function () {
        var online = HSM.db.cameras.filter(function (c) { return c.online; }).length;
        var sim = HSM.sim && HSM.sim.isRunning();
        HSM.ui.modal({
          title: "Simulated system status",
          subtitle: "Demo health monitor · not connected to production infrastructure",
          size: "modal-md",
          body:
            '<div class="info-note mb-3"><i class="bi bi-info-circle-fill"></i><div><strong>Research prototype.</strong> These statuses describe the browser demo only. No real CCTV, IoT sensors or backend services are involved.</div></div>' +
            '<div class="setting-row"><div class="setting-copy"><strong>Dashboard interface</strong><span>All nine monitoring views are responsive.</span></div><span class="status-badge tone-green"><span class="status-dot"></span>Operational</span></div>' +
            '<div class="setting-row"><div class="setting-copy"><strong>Simulation engine</strong><span>Generates a new event every ' + HSM.settings.simSpeed + ' seconds.</span></div><span class="status-badge tone-' + (sim ? "green" : "orange") + '"><span class="status-dot"></span>' + (sim ? "Running" : "Paused") + "</span></div>" +
            '<div class="setting-row"><div class="setting-copy"><strong>Demo camera gateway</strong><span>' + online + " of " + HSM.db.cameras.length + ' simulated camera feeds online.</span></div><span class="status-badge tone-blue"><span class="status-dot"></span>Demo feed</span></div>' +
            '<div class="setting-row"><div class="setting-copy"><strong>Local persistence</strong><span>Preferences and demo state are stored in this browser.</span></div><span class="status-badge tone-green"><span class="status-dot"></span>Enabled</span></div>' +
            '<div class="setting-row"><div class="setting-copy"><strong>Real sensor / CCTV connection</strong><span>Intentionally unavailable in this frontend-only demo.</span></div><span class="status-badge tone-grey"><span class="status-dot"></span>Not connected</span></div>',
          footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>'
        });
      });
    }
  }

  /* -------------------------------- Sidebar ------------------------------- */

  function closeSidebar() { document.body.classList.remove("sidebar-open"); }

  function initSidebar() {
    var toggle = document.getElementById("sidebarToggle");
    var close = document.getElementById("sidebarClose");
    var backdrop = document.getElementById("sidebarBackdrop");
    if (toggle) {
      toggle.addEventListener("click", function () {
        document.body.classList.toggle("sidebar-open");
      });
    }
    if (close) close.addEventListener("click", closeSidebar);
    if (backdrop) backdrop.addEventListener("click", closeSidebar);
    document.querySelectorAll(".sidebar-nav .nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 992) closeSidebar();
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSidebar();
    });
  }

  /* --------------------------------- Boot --------------------------------- */

  function boot() {
    HSM.store.init();
    HSM.applySettings();
    if (typeof window.Chart !== "undefined") {
      window.Chart.defaults.font.family = "'Inter', sans-serif";
      window.Chart.defaults.font.size = 10;
      window.Chart.defaults.color = HSM.charts.theme().text;
      window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
      window.Chart.defaults.plugins.legend.labels.boxWidth = 7;
      window.Chart.defaults.plugins.legend.labels.boxHeight = 7;
      window.Chart.defaults.plugins.legend.labels.padding = 12;
      window.Chart.defaults.animation.duration = 500;
    }
    initSidebar();
    initTopbar();
    initSearch();
    initDemoControls();
    HSM.refreshNotifications();
    if (HSM.sim) HSM.sim.init();
    HSM.updateSimUI();
    HSM.router.init();
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window.HSM);
