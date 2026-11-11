/* ==========================================================================
   Space Monitoring System — parking monitoring
   ========================================================================== */

(function (HSM) {
  "use strict";

  var filters = { status: "all", zone: "all", q: "" };
  var PARKING_STATUSES = ["occupied", "available", "reserved", "maintenance"];

  function spotIcon(status) {
    if (status === "occupied") return "bi-car-front-fill";
    if (status === "reserved") return "bi-bookmark-fill";
    if (status === "maintenance") return "bi-cone-striped";
    return "bi-p-square";
  }

  function spotMarkup(spot) {
    var meta = HSM.meta(spot.status);
    return '<button type="button" class="parking-spot accent-' + meta.tone + '" data-spot="' + spot.id + '">' +
      '<div class="ps-top"><span class="ps-id"><i class="bi ' + spotIcon(spot.status) + '"></i>' + spot.id + "</span>" +
        '<span class="ps-dot"></span></div>' +
      '<span class="ps-type">' + spot.type + "</span>" +
      '<span class="ps-vehicle">' + (spot.vehicle ? spot.vehicle + " · " + spot.plate : meta.label) + "</span>" +
      "</button>";
  }

  function statMarkup() {
    var c = HSM.stats.parkingCounts();
    var items = [
      { label: "Occupied", value: c.occupied, icon: "bi-car-front-fill", tone: "red" },
      { label: "Available", value: c.available, icon: "bi-check-circle-fill", tone: "green" },
      { label: "Reserved", value: c.reserved, icon: "bi-bookmark-fill", tone: "blue" },
      { label: "Maintenance", value: c.maintenance, icon: "bi-cone-striped", tone: "grey" }
    ];
    return items.map(function (i) {
      return '<div class="page-stat accent-' + i.tone + '"><div class="ps-icon tone-' + i.tone + '"><i class="bi ' + i.icon + '"></i></div>' +
        '<div class="ps-copy"><strong>' + i.value + "</strong><span>" + i.label + "</span></div></div>";
    }).join("");
  }

  function zoneMarkup(zone, start, end) {
    var spots = HSM.db.parking.filter(function (spot) {
      var n = parseInt(spot.id.slice(1), 10);
      return n >= start && n <= end;
    });
    var available = spots.filter(function (s) { return s.status === "available"; }).length;
    return '<div class="parking-zone">' +
      '<div class="parking-zone-title"><span>Zone ' + zone + "</span><span>" + available + " available</span></div>" +
      '<div class="parking-grid">' + spots.map(spotMarkup).join("") + "</div></div>";
  }

  function applyFilters() {
    var visible = 0;
    HSM.db.parking.forEach(function (spot) {
      var node = document.querySelector('.parking-spot[data-spot="' + spot.id + '"]');
      if (!node) return;
      var show = true;
      if (filters.status !== "all" && spot.status !== filters.status) show = false;
      if (filters.zone !== "all" && spot.zone !== filters.zone) show = false;
      if (filters.q.trim() && spot.id.toLowerCase().indexOf(filters.q.trim().toLowerCase()) === -1) show = false;
      node.classList.toggle("d-none", !show);
      if (show) visible++;
    });
    var c = HSM.stats.parkingCounts();
    var summary = document.getElementById("parkingSummary");
    if (summary) summary.innerHTML = "Showing <strong>" + visible + "</strong> of <strong>40</strong> spaces · <strong>" + c.utilizationPct + "%</strong> utilized";
    var empty = document.getElementById("parkingEmpty");
    if (empty) empty.classList.toggle("d-none", visible !== 0);
  }

  function refresh() {
    HSM.db.parking.forEach(function (spot) {
      var node = document.querySelector('.parking-spot[data-spot="' + spot.id + '"]');
      if (!node) return;
      var meta = HSM.meta(spot.status);
      node.className = "parking-spot accent-" + meta.tone + (node.classList.contains("d-none") ? " d-none" : "");
      node.querySelector(".ps-id").innerHTML = '<i class="bi ' + spotIcon(spot.status) + '"></i>' + spot.id;
      node.querySelector(".ps-vehicle").textContent = spot.vehicle ? spot.vehicle + " · " + spot.plate : meta.label;
    });
    var stats = document.getElementById("parkingStats");
    if (stats) stats.innerHTML = statMarkup();
    applyFilters();
  }

  function openSpot(id) {
    var spot = HSM.store.getParking(id);
    if (!spot) return;
    var meta = HSM.meta(spot.status);
    var actions = PARKING_STATUSES.map(function (status) {
      var m = HSM.meta(status);
      return '<button type="button" class="status-action tone-' + m.tone +
        (status === spot.status ? " is-current" : "") + '" data-new-status="' + status + '">' +
        '<span class="status-dot"></span>' + m.label + "</button>";
    }).join("");

    var controller = HSM.ui.modal({
      title: "Parking space " + spot.id,
      subtitle: "Zone " + spot.zone + " · " + spot.type + " · Simulated parking sensor",
      body:
        '<div class="detail-hero accent-' + meta.tone + '">' +
          '<div class="dh-icon"><i class="bi ' + spotIcon(spot.status) + '"></i></div>' +
          '<div class="dh-main"><h3>Space ' + spot.id + "</h3><p>Zone " + spot.zone + " · " + spot.type + "</p></div>" +
          HSM.statusBadge(spot.status, "lg") +
        "</div>" +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><span>Vehicle</span><strong>' + HSM.ui.esc(spot.vehicle || "—") + "</strong></div>" +
          '<div class="detail-cell"><span>Plate</span><strong class="mono">' + HSM.ui.esc(spot.plate || "—") + "</strong></div>" +
          '<div class="detail-cell"><span>Space type</span><strong>' + spot.type + "</strong></div>" +
          '<div class="detail-cell"><span>Last updated</span><strong>' + HSM.util.fmtDateTime(spot.lastUpdated) + "</strong></div>" +
        "</div>" +
        '<h4 class="detail-section-title">Update parking status (demo)</h4>' +
        '<div class="status-actions" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + actions + "</div>" +
        '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div>Vehicle details and sensor readings are generated for this demonstration. Changing a status updates the dashboard immediately.</div></div>',
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>',
      onShown: function (el) {
        el.querySelectorAll("[data-new-status]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var next = btn.getAttribute("data-new-status");
            if (next === spot.status) return;
            var m = HSM.meta(next);
            spot.status = next;
            spot.lastUpdated = new Date().toISOString();
            if (next === "occupied") {
              spot.vehicle = spot.type === "EV charging" ? "Electric" : HSM.util.pick(["Sedan", "SUV", "Van", "Compact"]);
              spot.plate = "GH-" + (1000 + Math.floor(Math.random() * 8999));
            } else {
              spot.vehicle = null;
              spot.plate = null;
            }
            HSM.store.addActivity("parking", "Parking " + spot.id + " became " + m.label,
              "Manual update · Parking Monitoring demo", "bi-car-front");
            HSM.afterData(["parking", "dashboard"]);
            refresh();
            if (controller) controller.hide();
            HSM.ui.toast({
              title: "Parking " + spot.id + " updated",
              message: "Status changed to " + m.label + " (simulated).",
              tone: m.tone, icon: "bi-check2-circle"
            });
          });
        });
      }
    });
  }

  function template() {
    var statusOptions = PARKING_STATUSES.map(function (s) {
      return '<option value="' + s + '">' + HSM.meta(s).label + "</option>";
    }).join("");

    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-p-square"></i> Live monitoring</div>' +
          "<h1>Parking monitoring</h1><p>40 parking spaces across zones A and B, including EV, accessible and VIP bays. <span class=\"demo-inline\">Simulated data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
        '<a class="btn btn-navy" href="#/facilities"><i class="bi bi-building"></i> Facilities</a></div>' +
      "</div>" +
      '<div class="page-stat-strip reveal" id="parkingStats">' + statMarkup() + "</div>" +
      '<div class="filter-bar reveal">' +
        '<div class="filter-search"><i class="bi bi-search"></i><input id="parkingSearch" type="search" placeholder="Search space ID (e.g. P12)…" aria-label="Search parking spaces"></div>' +
        '<select class="form-select" id="parkingStatusFilter" aria-label="Filter parking by status"><option value="all">All statuses</option>' + statusOptions + "</select>" +
        '<select class="form-select" id="parkingZoneFilter" aria-label="Filter parking by zone"><option value="all">All zones</option><option value="A">Zone A</option><option value="B">Zone B</option></select>' +
        '<button type="button" class="filter-clear" id="parkingFilterClear" title="Reset filters" aria-label="Reset filters"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        '<span class="filter-summary" id="parkingSummary"></span>' +
      "</div>" +
      '<div class="parking-lot reveal">' +
        zoneMarkup("A", 1, 20) +
        '<div class="parking-aisle">Drive lane</div>' +
        zoneMarkup("B", 21, 40) +
      "</div>" +
      '<div class="empty-state d-none mt-3" id="parkingEmpty"><div class="empty-icon"><i class="bi bi-search"></i></div>' +
        "<h3>No parking spaces match</h3><p>Try another status, zone or space ID.</p></div>";
  }

  HSM.registerPage("parking", {
    title: "Parking Monitoring",
    render: function (root) {
      filters = { status: "all", zone: "all", q: "" };
      root.innerHTML = template();
      applyFilters();

      var search = document.getElementById("parkingSearch");
      var status = document.getElementById("parkingStatusFilter");
      var zone = document.getElementById("parkingZoneFilter");
      function read() {
        filters.q = search ? search.value : "";
        filters.status = status ? status.value : "all";
        filters.zone = zone ? zone.value : "all";
        applyFilters();
      }
      if (search) search.addEventListener("input", read);
      if (status) status.addEventListener("change", read);
      if (zone) zone.addEventListener("change", read);

      var clear = document.getElementById("parkingFilterClear");
      if (clear) {
        clear.addEventListener("click", function () {
          filters = { status: "all", zone: "all", q: "" };
          if (search) search.value = "";
          if (status) status.value = "all";
          if (zone) zone.value = "all";
          applyFilters();
        });
      }

      root.addEventListener("click", function (event) {
        var node = event.target.closest(".parking-spot");
        if (node) openSpot(node.getAttribute("data-spot"));
      });
    },
    onData: function () { refresh(); },
    openPending: function (pending) {
      if (pending && pending.type === "parking") openSpot(pending.id);
    }
  });
})(window.HSM);
