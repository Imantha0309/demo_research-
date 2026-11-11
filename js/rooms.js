/* ==========================================================================
   Space Monitoring System — room monitoring
   ========================================================================== */

(function (HSM) {
  "use strict";

  var filters = { floor: "all", status: "all", q: "" };
  var ROOM_STATUSES = ["available", "occupied", "cleaning", "reserved", "maintenance"];

  function roomTile(room) {
    var meta = HSM.meta(room.status);
    return '<button type="button" class="room-tile accent-' + meta.tone + '" data-room="' + room.id + '">' +
      '<div class="room-tile-top"><span class="room-number">' + room.number + "</span>" +
        '<span class="status-dot tone-' + meta.tone + '"></span></div>' +
      '<div class="room-type">' + room.type + " · Floor " + room.floor + "</div>" +
      '<div class="room-status-row">' + HSM.statusBadge(room.status) + "</div>" +
      '<div class="room-updated"><i class="bi bi-clock"></i> ' + HSM.util.timeAgo(room.lastUpdated) + "</div>" +
      "</button>";
  }

  function legendMarkup() {
    var counts = HSM.stats.roomCounts();
    var values = {
      available: counts.available, occupied: counts.occupied, cleaning: counts.cleaning,
      reserved: counts.reserved, maintenance: counts.maintenance
    };
    return ROOM_STATUSES.map(function (status) {
      var meta = HSM.meta(status);
      return '<button type="button" class="status-chip tone-' + meta.tone +
        (filters.status === status ? " is-active" : "") + '" data-status="' + status + '">' +
        '<span class="status-dot"></span>' + meta.label + " <strong>" + values[status] + "</strong></button>";
    }).join("");
  }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    return HSM.db.rooms.filter(function (room) {
      if (filters.floor !== "all" && String(room.floor) !== filters.floor) return false;
      if (filters.status !== "all" && room.status !== filters.status) return false;
      if (q) {
        var haystack = (room.number + " " + room.type + " " + room.floor + " " + (room.guest || "")).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function applyFilters() {
    var visible = 0;
    HSM.db.rooms.forEach(function (room) {
      var tile = document.querySelector('.room-tile[data-room="' + room.id + '"]');
      if (!tile) return;
      var show = true;
      if (filters.floor !== "all" && String(room.floor) !== filters.floor) show = false;
      if (filters.status !== "all" && room.status !== filters.status) show = false;
      if (filters.q.trim()) {
        var q = filters.q.trim().toLowerCase();
        var haystack = (room.number + " " + room.type + " " + room.floor + " " + (room.guest || "")).toLowerCase();
        if (haystack.indexOf(q) === -1) show = false;
      }
      tile.classList.toggle("d-none", !show);
      if (show) visible++;
    });
    var summary = document.getElementById("roomSummary");
    if (summary) summary.innerHTML = "Showing <strong>" + visible + "</strong> of <strong>" + HSM.db.rooms.length + "</strong> rooms";
    var empty = document.getElementById("roomsEmpty");
    if (empty) empty.classList.toggle("d-none", visible !== 0);
    var legend = document.getElementById("roomLegend");
    if (legend) legend.innerHTML = legendMarkup();
  }

  function refresh() {
    HSM.db.rooms.forEach(function (room) {
      var tile = document.querySelector('.room-tile[data-room="' + room.id + '"]');
      if (!tile) return;
      var meta = HSM.meta(room.status);
      tile.className = "room-tile accent-" + meta.tone + (tile.classList.contains("d-none") ? " d-none" : "");
      tile.querySelector(".room-type").textContent = room.type + " · Floor " + room.floor;
      tile.querySelector(".room-status-row").innerHTML = HSM.statusBadge(room.status);
      tile.querySelector(".room-updated").innerHTML = '<i class="bi bi-clock"></i> ' + HSM.util.timeAgo(room.lastUpdated);
    });
    applyFilters();
  }

  function openRoom(id) {
    var room = HSM.store.getRoom(id);
    if (!room) return;
    var meta = HSM.meta(room.status);
    var history = room.history.slice(0, 5).map(function (h) {
      var m = HSM.meta(h.status);
      return '<li class="tone-' + m.tone + '"><div class="h-title">' + HSM.statusBadge(h.status) + "</div>" +
        '<span class="h-time">' + HSM.util.fmtDateTime(h.at) + "</span></li>";
    }).join("");

    var actions = ROOM_STATUSES.map(function (status) {
      var m = HSM.meta(status);
      return '<button type="button" class="status-action tone-' + m.tone +
        (status === room.status ? " is-current" : "") + '" data-new-status="' + status + '">' +
        '<span class="status-dot"></span>' + m.label + "</button>";
    }).join("");

    var controller = HSM.ui.modal({
      title: "Room " + room.number,
      subtitle: room.type + " · Floor " + room.floor + " · Simulated room sensor",
      body:
        '<div class="detail-hero accent-' + meta.tone + '">' +
          '<div class="dh-icon"><i class="bi bi-door-open"></i></div>' +
          '<div class="dh-main"><h3>Room ' + room.number + "</h3><p>" + room.type + " · Floor " + room.floor + "</p></div>" +
          HSM.statusBadge(room.status, "lg") +
        "</div>" +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><span>Guest</span><strong>' + HSM.ui.esc(room.guest || "—") + "</strong></div>" +
          '<div class="detail-cell"><span>Nightly rate</span><strong class="mono">$' + room.rate + "</strong></div>" +
          '<div class="detail-cell"><span>Last updated</span><strong>' + HSM.util.fmtDateTime(room.lastUpdated) + "</strong></div>" +
          '<div class="detail-cell"><span>Status source</span><strong>Demo sensor</strong></div>' +
        "</div>" +
        '<div class="row g-4"><div class="col-md-6">' +
          '<h4 class="detail-section-title">Status history</h4>' +
          '<ul class="history-list">' + history + "</ul>" +
        "</div><div class=\"col-md-6\">" +
          '<h4 class="detail-section-title">Update status (demo)</h4>' +
          '<div class="status-actions">' + actions + "</div>" +
          '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div>Manual changes are saved to LocalStorage and appear in the activity feed. No real room system is connected.</div></div>' +
        "</div></div>",
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>',
      onShown: function (el) {
        el.querySelectorAll("[data-new-status]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var next = btn.getAttribute("data-new-status");
            if (next === room.status) return;
            var m = HSM.meta(next);
            room.status = next;
            room.lastUpdated = new Date().toISOString();
            if (next === "occupied") room.guest = room.guest || "Demo guest";
            else if (next === "reserved") room.guest = "Demo reservation";
            else room.guest = null;
            room.history.unshift({ status: next, at: room.lastUpdated });
            if (room.history.length > 8) room.history.length = 8;
            HSM.store.addActivity("room", "Room " + room.number + " changed to " + m.label,
              "Manual update · Room Monitoring demo", "bi-door-open");
            HSM.afterData(["rooms", "dashboard"]);
            refresh();
            if (controller) controller.hide();
            HSM.ui.toast({
              title: "Room " + room.number + " updated",
              message: "Status changed to " + m.label + " (simulated).",
              tone: m.tone, icon: "bi-check2-circle"
            });
          });
        });
      }
    });
  }

  function template() {
    var floors = "";
    for (var f = 1; f <= 6; f++) floors += '<option value="' + f + '">Floor ' + f + "</option>";
    var statusOptions = ROOM_STATUSES.map(function (s) {
      var m = HSM.meta(s);
      return '<option value="' + s + '">' + m.label + "</option>";
    }).join("");

    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-door-open"></i> Live monitoring</div>' +
          "<h1>Room monitoring</h1><p>All 120 guest rooms across six floors. Click any room to inspect its simulated status, history and guest context. <span class=\"demo-inline\">Simulated data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
        '<a class="btn btn-navy" href="#/restaurant"><i class="bi bi-cup-hot"></i> Restaurant view</a></div>' +
      "</div>" +
      '<div class="filter-bar reveal">' +
        '<div class="filter-search"><i class="bi bi-search"></i><input id="roomSearch" type="search" placeholder="Search room number, type or guest…" aria-label="Search rooms"></div>' +
        '<select class="form-select" id="floorFilter" aria-label="Filter by floor"><option value="all">All floors</option>' + floors + "</select>" +
        '<select class="form-select" id="statusFilter" aria-label="Filter by status"><option value="all">All statuses</option>' + statusOptions + "</select>" +
        '<button type="button" class="filter-clear" id="roomFilterClear" title="Reset filters" aria-label="Reset filters"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        '<span class="filter-summary" id="roomSummary"></span>' +
      "</div>" +
      '<div class="status-legend reveal mb-3" id="roomLegend">' + legendMarkup() + "</div>" +
      '<div class="rooms-grid reveal" id="roomsGrid">' + HSM.db.rooms.map(roomTile).join("") + "</div>" +
      '<div class="empty-state d-none" id="roomsEmpty"><div class="empty-icon"><i class="bi bi-search"></i></div>' +
        "<h3>No rooms match those filters</h3><p>Try a different room number, floor or status. All 120 rooms are still being monitored.</p>" +
        '<button type="button" class="btn btn-outline-soft" id="roomsEmptyReset"><i class="bi bi-arrow-counterclockwise"></i> Reset filters</button></div>';
  }

  HSM.registerPage("rooms", {
    title: "Room Monitoring",
    render: function (root) {
      filters = { floor: "all", status: "all", q: "" };
      root.innerHTML = template();
      applyFilters();

      var search = document.getElementById("roomSearch");
      var floor = document.getElementById("floorFilter");
      var status = document.getElementById("statusFilter");
      function read() {
        filters.q = search ? search.value : "";
        filters.floor = floor ? floor.value : "all";
        filters.status = status ? status.value : "all";
        applyFilters();
      }
      if (search) search.addEventListener("input", read);
      if (floor) floor.addEventListener("change", read);
      if (status) status.addEventListener("change", read);

      function reset() {
        filters = { floor: "all", status: "all", q: "" };
        if (search) search.value = "";
        if (floor) floor.value = "all";
        if (status) status.value = "all";
        applyFilters();
      }
      var clear = document.getElementById("roomFilterClear");
      if (clear) clear.addEventListener("click", reset);
      var reset2 = document.getElementById("roomsEmptyReset");
      if (reset2) reset2.addEventListener("click", reset);

      root.addEventListener("click", function (event) {
        var chip = event.target.closest(".status-chip[data-status]");
        if (chip) {
          var value = chip.getAttribute("data-status");
          filters.status = filters.status === value ? "all" : value;
          if (status) status.value = filters.status;
          applyFilters();
          return;
        }
        var tile = event.target.closest(".room-tile");
        if (tile) openRoom(tile.getAttribute("data-room"));
      });
    },
    onData: function () { refresh(); },
    openPending: function (pending) {
      if (pending && pending.type === "room") openRoom(pending.id);
    }
  });
})(window.HSM);
