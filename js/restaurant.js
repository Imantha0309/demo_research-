/* ==========================================================================
   Space Monitoring System — restaurant table monitoring
   ========================================================================== */

(function (HSM) {
  "use strict";

  var filters = { status: "all", zone: "all", q: "" };
  var timer = null;
  var TABLE_STATUSES = ["occupied", "available", "cleaning", "service"];

  function tableMeta(table) {
    if (table.status === "occupied") return table.guests + " guests";
    if (table.status === "cleaning") return "Cleaning";
    if (table.status === "service") return "Service";
    return table.seats + " seats";
  }

  function timerText(table) {
    if (table.status === "occupied" && table.seatedAt) return HSM.util.durationLabel(HSM.util.minsSince(table.seatedAt));
    if ((table.status === "cleaning" || table.status === "service") && table.waitingSince) {
      return "Wait " + Math.floor(HSM.util.minsSince(table.waitingSince)) + "m";
    }
    return "Ready";
  }

  function tableNode(table) {
    var meta = HSM.meta(table.status);
    var chairs = '<span class="chair c1"></span><span class="chair c2"></span><span class="chair c3"></span><span class="chair c4"></span>';
    return '<button type="button" class="table-node accent-' + meta.tone + ' seats-' + table.seats + '" data-table="' + table.id + '" title="' + table.id + " · " + meta.label + '">' +
      chairs +
      '<span class="table-id">' + table.number + "</span>" +
      '<span class="table-meta">' + tableMeta(table) + "</span>" +
      '<span class="table-timer">' + timerText(table) + "</span>" +
      "</button>";
  }

  function statMarkup() {
    var c = HSM.stats.tableCounts();
    var items = [
      { label: "Occupied", value: c.occupied, icon: "bi-person-fill", tone: "red" },
      { label: "Available", value: c.available, icon: "bi-check-circle-fill", tone: "green" },
      { label: "Cleaning", value: c.cleaning, icon: "bi-stars", tone: "orange" },
      { label: "Waiting service", value: c.service, icon: "bi-bell-fill", tone: "yellow" }
    ];
    return items.map(function (i) {
      return '<div class="page-stat accent-' + i.tone + '"><div class="ps-icon tone-' + i.tone + '"><i class="bi ' + i.icon + '"></i></div>' +
        '<div class="ps-copy"><strong>' + i.value + "</strong><span>" + i.label + "</span></div></div>";
    }).join("");
  }

  function zoneMarkup(name, start, end) {
    var tables = HSM.db.tables.filter(function (t) {
      var n = parseInt(t.id.slice(1), 10);
      return n >= start && n <= end;
    });
    return '<span class="zone-label">' + name + "</span>" +
      '<div class="plan-grid">' + tables.map(tableNode).join("") + "</div>";
  }

  function applyFilters() {
    var visible = 0;
    HSM.db.tables.forEach(function (table) {
      var node = document.querySelector('.table-node[data-table="' + table.id + '"]');
      if (!node) return;
      var show = true;
      if (filters.status !== "all" && table.status !== filters.status) show = false;
      if (filters.zone !== "all" && table.zone !== filters.zone) show = false;
      if (filters.q.trim() && table.id.toLowerCase().indexOf(filters.q.trim().toLowerCase()) === -1) show = false;
      node.classList.toggle("d-none", !show);
      if (show) visible++;
    });
    var summary = document.getElementById("tableSummary");
    if (summary) summary.innerHTML = "Showing <strong>" + visible + "</strong> of <strong>24</strong> tables";
    var empty = document.getElementById("tablesEmpty");
    if (empty) empty.classList.toggle("d-none", visible !== 0);
  }

  function updateTimers() {
    HSM.db.tables.forEach(function (table) {
      var node = document.querySelector('.table-node[data-table="' + table.id + '"]');
      if (!node) return;
      var wait = table.waitingSince ? HSM.util.minsSince(table.waitingSince) : 0;
      var overdue = (table.status === "cleaning" || table.status === "service") && wait >= 10;
      var timerEl = node.querySelector(".table-timer");
      if (timerEl) timerEl.textContent = timerText(table);
      node.classList.toggle("overdue", overdue);
      if (overdue && !node.dataset.alerted) {
        node.dataset.alerted = "1";
        HSM.raiseAlert({
          priority: "warning",
          title: "Table " + table.number + (table.status === "cleaning" ? " waiting for cleaning" : " waiting for service"),
          description: "Table " + table.number + " has been waiting for " + Math.floor(wait) + " minutes. The demonstration threshold is 10 minutes.",
          facility: "Restaurant",
          source: "Table " + table.number,
          ruleKey: "table-wait-" + table.number
        });
      }
      if (!overdue) delete node.dataset.alerted;
    });
  }

  function refresh() {
    HSM.db.tables.forEach(function (table) {
      var node = document.querySelector('.table-node[data-table="' + table.id + '"]');
      if (!node) return;
      var meta = HSM.meta(table.status);
      node.className = "table-node accent-" + meta.tone + " seats-" + table.seats + (node.classList.contains("d-none") ? " d-none" : "");
      node.querySelector(".table-meta").textContent = tableMeta(table);
      node.querySelector(".table-timer").textContent = timerText(table);
    });
    var stats = document.getElementById("tableStats");
    if (stats) stats.innerHTML = statMarkup();
    applyFilters();
    updateTimers();
  }

  function openTable(id) {
    var table = HSM.store.getTable(id);
    if (!table) return;
    var meta = HSM.meta(table.status);
    var seated = table.seatedAt ? HSM.util.durationLabel(HSM.util.minsSince(table.seatedAt)) : "—";
    var waiting = table.waitingSince ? HSM.util.durationLabel(HSM.util.minsSince(table.waitingSince)) : "—";

    var actions = TABLE_STATUSES.map(function (status) {
      var m = HSM.meta(status);
      return '<button type="button" class="status-action tone-' + m.tone +
        (status === table.status ? " is-current" : "") + '" data-new-status="' + status + '">' +
        '<span class="status-dot"></span>' + m.label + "</button>";
    }).join("");

    var controller = HSM.ui.modal({
      title: "Table " + table.number,
      subtitle: table.zone + " · " + table.seats + " seats · Simulated table sensor",
      body:
        '<div class="detail-hero accent-' + meta.tone + '">' +
          '<div class="dh-icon"><i class="bi bi-cup-hot"></i></div>' +
          '<div class="dh-main"><h3>Table ' + table.number + "</h3><p>" + table.zone + " · " + table.seats + " seats</p></div>" +
          HSM.statusBadge(table.status, "lg") +
        "</div>" +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><span>Guests</span><strong>' + (table.guests || "—") + "</strong></div>" +
          '<div class="detail-cell"><span>Occupied duration</span><strong>' + seated + "</strong></div>" +
          '<div class="detail-cell"><span>Waiting duration</span><strong>' + waiting + "</strong></div>" +
          '<div class="detail-cell"><span>Last updated</span><strong>' + HSM.util.fmtDateTime(table.lastUpdated) + "</strong></div>" +
        "</div>" +
        '<h4 class="detail-section-title">Update table status (demo)</h4>' +
        '<div class="status-actions">' + actions + "</div>" +
        '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div>Waiting tables over 10 minutes raise a simulated warning alert. ' +
          "All durations and guests are generated for this research demo.</div></div>",
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>',
      onShown: function (el) {
        el.querySelectorAll("[data-new-status]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var next = btn.getAttribute("data-new-status");
            if (next === table.status) return;
            var m = HSM.meta(next);
            table.status = next;
            table.lastUpdated = new Date().toISOString();
            if (next === "occupied") {
              table.guests = Math.max(1, table.guests || 2);
              table.seatedAt = table.lastUpdated;
              table.waitingSince = null;
            } else if (next === "cleaning") {
              table.guests = 0;
              table.seatedAt = null;
              table.waitingSince = table.lastUpdated;
            } else if (next === "service") {
              table.seatedAt = null;
              table.waitingSince = table.lastUpdated;
            } else {
              table.guests = 0;
              table.seatedAt = null;
              table.waitingSince = null;
            }
            HSM.store.addActivity("table", "Table " + table.number + " changed to " + m.label,
              "Manual update · Restaurant Monitoring demo", "bi-cup-hot");
            HSM.afterData(["restaurant", "dashboard"]);
            refresh();
            if (controller) controller.hide();
            HSM.ui.toast({
              title: "Table " + table.number + " updated",
              message: "Status changed to " + m.label + " (simulated).",
              tone: m.tone, icon: "bi-check2-circle"
            });
          });
        });
      }
    });
  }

  function template() {
    var statusOptions = TABLE_STATUSES.map(function (s) {
      return '<option value="' + s + '">' + HSM.meta(s).label + "</option>";
    }).join("");

    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-cup-hot"></i> Live monitoring</div>' +
          "<h1>Restaurant monitoring</h1><p>24 tables across three floor-plan zones. Durations update every second and waiting times over 10 minutes trigger a warning. <span class=\"demo-inline\">Simulated data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
        '<a class="btn btn-navy" href="#/alerts"><i class="bi bi-bell"></i> Active alerts</a></div>' +
      "</div>" +
      '<div class="page-stat-strip reveal" id="tableStats">' + statMarkup() + "</div>" +
      '<div class="filter-bar reveal">' +
        '<div class="filter-search"><i class="bi bi-search"></i><input id="tableSearch" type="search" placeholder="Search table number…" aria-label="Search tables"></div>' +
        '<select class="form-select" id="tableStatusFilter" aria-label="Filter tables by status"><option value="all">All statuses</option>' + statusOptions + "</select>" +
        '<select class="form-select" id="zoneFilter" aria-label="Filter by zone"><option value="all">All zones</option><option>Window side</option><option>Main dining</option><option>Terrace</option></select>' +
        '<button type="button" class="filter-clear" id="tableFilterClear" title="Reset filters" aria-label="Reset filters"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        '<span class="filter-summary" id="tableSummary"></span>' +
      "</div>" +
      '<div class="restaurant-plan reveal">' +
        '<span class="plan-label kitchen"><i class="bi bi-fire"></i> Kitchen</span>' +
        '<div class="plan-zone zone-window">' + zoneMarkup("Window side", 1, 6) + "</div>" +
        '<div class="zone-aisle"></div>' +
        '<div class="plan-zone zone-main">' + zoneMarkup("Main dining", 7, 18) + "</div>" +
        '<div class="zone-aisle"></div>' +
        '<div class="plan-zone zone-terrace">' + zoneMarkup("Terrace", 19, 24) + "</div>" +
        '<span class="plan-label entrance"><i class="bi bi-door-open"></i> Entrance</span>' +
      "</div>" +
      '<div class="empty-state d-none mt-3" id="tablesEmpty"><div class="empty-icon"><i class="bi bi-search"></i></div>' +
        "<h3>No tables match those filters</h3><p>Try another zone or status. Restaurant tables keep updating even while filtered.</p></div>";
  }

  HSM.registerPage("restaurant", {
    title: "Restaurant Monitoring",
    render: function (root) {
      filters = { status: "all", zone: "all", q: "" };
      root.innerHTML = template();
      applyFilters();
      updateTimers();

      var search = document.getElementById("tableSearch");
      var status = document.getElementById("tableStatusFilter");
      var zone = document.getElementById("zoneFilter");
      function read() {
        filters.q = search ? search.value : "";
        filters.status = status ? status.value : "all";
        filters.zone = zone ? zone.value : "all";
        applyFilters();
      }
      if (search) search.addEventListener("input", read);
      if (status) status.addEventListener("change", read);
      if (zone) zone.addEventListener("change", read);

      function reset() {
        filters = { status: "all", zone: "all", q: "" };
        if (search) search.value = "";
        if (status) status.value = "all";
        if (zone) zone.value = "all";
        applyFilters();
      }
      var clear = document.getElementById("tableFilterClear");
      if (clear) clear.addEventListener("click", reset);

      root.addEventListener("click", function (event) {
        var node = event.target.closest(".table-node");
        if (node) openTable(node.getAttribute("data-table"));
      });

      timer = setInterval(updateTimers, 1000);
    },
    onData: function () { refresh(); },
    openPending: function (pending) {
      if (pending && pending.type === "table") openTable(pending.id);
    },
    destroy: function () {
      if (timer) clearInterval(timer);
      timer = null;
    }
  });
})(window.HSM);
