/* ==========================================================================
   Space Monitoring System — alerts and notification management
   ========================================================================== */

(function (HSM) {
  "use strict";

  var filters = { priority: "all", facility: "all", status: "all", q: "" };

  function statsMarkup() {
    var c = HSM.stats.alertCounts();
    var items = [
      { label: "Critical", value: c.critical, icon: "bi-exclamation-octagon-fill", tone: "dark-red" },
      { label: "Warning", value: c.warning, icon: "bi-exclamation-triangle-fill", tone: "orange" },
      { label: "Information", value: c.info, icon: "bi-info-circle-fill", tone: "blue" },
      { label: "Resolved", value: c.resolved, icon: "bi-check2-circle", tone: "green" }
    ];
    return items.map(function (i) {
      return '<div class="alert-stat accent-' + i.tone + '"><div class="as-icon"><i class="bi ' + i.icon + '"></i></div>' +
        '<div class="as-copy"><strong>' + i.value + "</strong><span>" + i.label + "</span></div></div>";
    }).join("");
  }

  function facilityOptions() {
    var facilities = HSM.db.alerts.map(function (a) { return a.facility; })
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; })
      .sort();
    return facilities.map(function (f) {
      return '<option value="' + HSM.ui.esc(f) + '"' + (filters.facility === f ? " selected" : "") + ">" + HSM.ui.esc(f) + "</option>";
    }).join("");
  }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    return HSM.db.alerts.filter(function (a) {
      if (filters.priority !== "all" && a.priority !== filters.priority) return false;
      if (filters.facility !== "all" && a.facility !== filters.facility) return false;
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (q) {
        var haystack = (a.title + " " + a.description + " " + a.facility + " " + a.source).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function cardMarkup(alert) {
    var meta = HSM.meta(alert.priority);
    var resolved = alert.status === "resolved";
    return '<article class="alert-card accent-' + meta.tone + (resolved ? " is-resolved" : "") + '" data-alert-card="' + alert.id + '">' +
      '<div class="alert-card-icon"><i class="bi ' + meta.icon + '"></i></div>' +
      '<div class="alert-main">' +
        '<div class="alert-top"><span class="priority-pill tone-' + meta.tone + '">' + meta.label + "</span>" +
          '<span class="alert-facility"><i class="bi bi-building"></i> ' + HSM.ui.esc(alert.facility) + "</span>" +
          '<span class="alert-time">' + HSM.util.timeAgo(alert.createdAt) + "</span></div>" +
        "<h3>" + HSM.ui.esc(alert.title) + "</h3>" +
        "<p>" + HSM.ui.esc(alert.description) + "</p>" +
        '<div class="alert-meta"><span><i class="bi bi-broadcast"></i> ' + HSM.ui.esc(alert.source) + "</span>" +
          (resolved
            ? '<span class="tone-green"><i class="bi bi-check2-circle"></i> Resolved ' + HSM.util.timeAgo(alert.resolvedAt) + "</span>"
            : '<span><i class="bi bi-clock"></i> Raised ' + HSM.util.fmtTime(alert.createdAt) + "</span>") +
        "</div>" +
      "</div>" +
      '<div class="alert-actions">' +
        '<button type="button" class="btn btn-sm btn-outline-soft" data-alert-view="' + alert.id + '"><i class="bi bi-eye"></i> Details</button>' +
        (resolved
          ? '<span class="status-badge tone-green"><span class="status-dot"></span>Resolved</span>'
          : '<button type="button" class="btn btn-sm btn-success-soft" data-alert-resolve="' + alert.id + '"><i class="bi bi-check2"></i> Resolve</button>') +
      "</div>" +
    "</article>";
  }

  function renderList() {
    var items = filtered();
    var list = document.getElementById("alertList");
    if (!list) return;
    list.innerHTML = items.length
      ? items.map(cardMarkup).join("")
      : '<div class="empty-state"><div class="empty-icon"><i class="bi bi-check2-all"></i></div>' +
        "<h3>No alerts match</h3><p>There are no alerts for this combination of filters. Try resetting them or resolving conditions in the other monitoring pages.</p>" +
        '<button type="button" class="btn btn-outline-soft" id="alertEmptyReset"><i class="bi bi-arrow-counterclockwise"></i> Reset filters</button></div>';
    var emptyReset = document.getElementById("alertEmptyReset");
    if (emptyReset) {
      emptyReset.addEventListener("click", resetFilters);
    }
    var summary = document.getElementById("alertSummary");
    if (summary) summary.innerHTML = "Showing <strong>" + items.length + "</strong> of <strong>" + HSM.db.alerts.length + "</strong> alerts";
    var stats = document.getElementById("alertStats");
    if (stats) stats.innerHTML = statsMarkup();
    var resolveAll = document.getElementById("resolveAllAlerts");
    if (resolveAll) {
      var open = HSM.stats.alertCounts().open;
      resolveAll.disabled = open === 0;
    }
    var openCount = document.getElementById("alertOpenCount");
    if (openCount) openCount.textContent = HSM.stats.alertCounts().open;
  }

  function resetFilters() {
    filters = { priority: "all", facility: "all", status: "all", q: "" };
    var search = document.getElementById("alertSearch");
    var priority = document.getElementById("alertPriority");
    var facility = document.getElementById("alertFacility");
    var status = document.getElementById("alertStatus");
    if (search) search.value = "";
    if (priority) priority.value = "all";
    if (facility) facility.value = "all";
    if (status) status.value = "all";
    renderList();
  }

  function openDetails(id) {
    var alert = HSM.store.getAlert(id);
    if (!alert) return;
    if (alert.unread) {
      alert.unread = false;
      HSM.store.save();
      HSM.refreshNotifications();
    }
    var meta = HSM.meta(alert.priority);
    var controller = HSM.ui.modal({
      title: alert.title,
      subtitle: alert.facility + " · " + alert.source,
      body:
        '<div class="detail-hero accent-' + meta.tone + '">' +
          '<div class="dh-icon"><i class="bi ' + meta.icon + '"></i></div>' +
          '<div class="dh-main"><h3>' + HSM.ui.esc(alert.title) + "</h3><p>" + HSM.ui.esc(alert.source) + "</p></div>" +
          '<span class="priority-pill tone-' + meta.tone + '">' + meta.label + "</span>" +
        "</div>" +
        '<p style="font-size:12px;line-height:1.6">' + HSM.ui.esc(alert.description) + "</p>" +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><span>Priority</span><strong>' + meta.label + "</strong></div>" +
          '<div class="detail-cell"><span>Status</span><strong>' + (alert.status === "open" ? "Open" : "Resolved") + "</strong></div>" +
          '<div class="detail-cell"><span>Facility</span><strong>' + HSM.ui.esc(alert.facility) + "</strong></div>" +
          '<div class="detail-cell"><span>Source</span><strong>' + HSM.ui.esc(alert.source) + "</strong></div>" +
          '<div class="detail-cell"><span>Raised</span><strong>' + HSM.util.fmtDateTime(alert.createdAt) + "</strong></div>" +
          '<div class="detail-cell"><span>Resolved</span><strong>' + (alert.resolvedAt ? HSM.util.fmtDateTime(alert.resolvedAt) : "—") + "</strong></div>" +
        "</div>" +
        '<h4 class="detail-section-title">Alert timeline</h4>' +
        '<ul class="history-list tone-' + meta.tone + '">' +
          '<li><div class="h-title">Alert raised by simulated rule engine</div><span class="h-time">' + HSM.util.fmtDateTime(alert.createdAt) + "</span></li>" +
          (alert.resolvedAt ? '<li class="tone-green"><div class="h-title">Marked resolved by demo operator</div><span class="h-time">' + HSM.util.fmtDateTime(alert.resolvedAt) + "</span></li>" : "") +
        "</ul>" +
        '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div>This alert is generated from simulated monitoring data. No real hotel system is connected.</div></div>',
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>' +
        (alert.status === "open"
          ? '<button type="button" class="btn btn-success-soft" id="alertModalResolve"><i class="bi bi-check2"></i> Mark resolved</button>'
          : ""),
      onShown: function (el) {
        var resolve = el.querySelector("#alertModalResolve");
        if (resolve) {
          resolve.addEventListener("click", function () {
            HSM.resolveAlert(alert.id);
            if (controller) controller.hide();
            renderList();
          });
        }
      }
    });
  }

  function resolveAll() {
    var open = HSM.db.alerts.filter(function (a) { return a.status === "open"; });
    if (!open.length) return;
    HSM.ui.confirm({
      title: "Resolve all alerts?",
      message: "This marks all " + open.length + " open simulated alerts as resolved. New alerts can still be generated by the monitoring engine.",
      confirmLabel: "Resolve all",
      onConfirm: function () {
        open.forEach(function (a) {
          a.status = "resolved";
          a.resolvedAt = new Date().toISOString();
          a.unread = false;
        });
        HSM.store.addActivity("alert", "All open alerts resolved", open.length + " simulated alerts marked resolved", "bi-check2-all");
        HSM.store.save();
        HSM.refreshNotifications();
        renderList();
        HSM.ui.toast({ title: "Alerts resolved", message: open.length + " alerts have been marked as resolved.", tone: "green", icon: "bi-check2-all" });
      }
    });
  }

  function template() {
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-bell"></i> Operations</div>' +
          "<h1>Alerts &amp; notifications</h1><p><strong id=\"alertOpenCount\">3</strong> open alerts generated by the demo rule engine. Resolve alerts, filter by priority, or search the log. <span class=\"demo-inline\">Simulated data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> Rule engine</a>' +
        '<button type="button" class="btn btn-navy" id="resolveAllAlerts"><i class="bi bi-check2-all"></i> Resolve all</button></div>' +
      "</div>" +
      '<div class="alert-stats reveal" id="alertStats">' + statsMarkup() + "</div>" +
      '<div class="filter-bar reveal">' +
        '<div class="filter-search"><i class="bi bi-search"></i><input id="alertSearch" type="search" placeholder="Search alerts, facilities or sources…" aria-label="Search alerts"></div>' +
        '<select class="form-select" id="alertPriority" aria-label="Filter by priority"><option value="all">All priorities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Information</option></select>' +
        '<select class="form-select" id="alertFacility" aria-label="Filter by facility"><option value="all">All facilities</option>' + facilityOptions() + "</select>" +
        '<select class="form-select" id="alertStatus" aria-label="Filter by status"><option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option></select>' +
        '<button type="button" class="filter-clear" id="alertFilterClear" title="Reset filters" aria-label="Reset filters"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        '<span class="filter-summary" id="alertSummary"></span>' +
      "</div>" +
      '<div class="alert-list reveal" id="alertList"></div>';
  }

  HSM.registerPage("alerts", {
    title: "Alerts & Notifications",
    render: function (root) {
      filters = { priority: "all", facility: "all", status: "all", q: "" };
      root.innerHTML = template();
      renderList();

      var search = document.getElementById("alertSearch");
      var priority = document.getElementById("alertPriority");
      var facility = document.getElementById("alertFacility");
      var status = document.getElementById("alertStatus");
      function read() {
        filters.q = search ? search.value : "";
        filters.priority = priority ? priority.value : "all";
        filters.facility = facility ? facility.value : "all";
        filters.status = status ? status.value : "all";
        renderList();
      }
      if (search) search.addEventListener("input", read);
      if (priority) priority.addEventListener("change", read);
      if (facility) facility.addEventListener("change", read);
      if (status) status.addEventListener("change", read);
      var clear = document.getElementById("alertFilterClear");
      if (clear) clear.addEventListener("click", resetFilters);

      var resolveAllBtn = document.getElementById("resolveAllAlerts");
      if (resolveAllBtn) resolveAllBtn.addEventListener("click", resolveAll);

      root.addEventListener("click", function (event) {
        var view = event.target.closest("[data-alert-view]");
        if (view) { openDetails(view.getAttribute("data-alert-view")); return; }
        var resolve = event.target.closest("[data-alert-resolve]");
        if (resolve) {
          var id = resolve.getAttribute("data-alert-resolve");
          HSM.resolveAlert(id);
          renderList();
        }
      });
    },
    onData: function () { renderList(); },
    openPending: function (pending) {
      if (pending && pending.type === "alert") openDetails(pending.id);
    }
  });
})(window.HSM);
