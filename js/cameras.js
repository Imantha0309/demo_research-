/* ==========================================================================
   Space Monitoring System — simulated CCTV demonstration
   No real camera feeds, computer vision or video streams are connected.
   ========================================================================== */

(function (HSM) {
  "use strict";

  var clockTimer = null;

  function detectionsFor(camera) {
    var labels = [];
    if (!camera.online) return labels;
    var count = Math.min(5, Math.max(3, Math.round(camera.detections / 4)));
    for (var i = 0; i < count; i++) {
      var waiter = camera.kind === "restaurant" && i === 1;
      var top = 16 + ((i * 17 + 9) % 46);
      var left = 8 + ((i * 23 + 11) % 72);
      var width = 9 + (i % 3) * 2.6;
      var height = 17 + (i % 2) * 5;
      var conf = 0.86 + ((i * 7 + camera.detections) % 12) / 100;
      labels.push('<span class="det-box' + (waiter ? " waiter" : "") + '" style="left:' + left + "%;top:" + top + "%;width:" + width + "%;height:" + height + '%">' +
        '<span class="det-label">' + (waiter ? "Waiter" : camera.kind === "parking" ? "Vehicle" : "Person") + " " + conf.toFixed(2) + "</span></span>");
    }
    return labels;
  }

  function cameraMarkup(camera) {
    var detections = camera.detections;
    var meta = HSM.meta(camera.online ? "online" : "offline");
    return '<article class="camera-card' + (camera.online ? "" : " is-offline") + '" data-camera-card="' + camera.id + '">' +
      '<div class="camera-feed">' +
        "<!-- Replace with an authorized hotel CCTV snapshot or video stream -->" +
        '<img src="' + camera.image + '" alt="Simulated ' + HSM.ui.esc(camera.name) + ' camera preview"' +
          ' loading="lazy" onerror="this.onerror=null;this.src=\'assets/images/camera-fallback.svg\';">' +
        '<div class="feed-tint"></div><div class="feed-scanlines"></div><div class="feed-grain"></div>' +
        '<div class="cam-topline"><span class="cam-id"><i class="bi bi-camera-video"></i> ' + camera.id + " · " + camera.name + "</span>" +
          (camera.online ? '<span class="rec">REC</span>' : '<span class="rec" style="color:#ffb3ad">NO SIGNAL</span>') + "</div>" +
        (camera.online ? '<span class="cam-live">LIVE · DEMO</span>' : "") +
        '<div class="detection-layer">' + detectionsFor(camera).join("") + "</div>" +
        '<span class="cam-demo-watermark">SIMULATED</span>' +
        '<span class="cam-timestamp js-cam-time">' + new Date().toLocaleTimeString("en-GB", { hour12: false }) + "</span>" +
        '<div class="offline-overlay' + (camera.online ? " d-none" : "") + '">' +
          '<i class="bi bi-wifi-off"></i><strong>SIGNAL LOST</strong><span>' + camera.id + " · simulated feed unavailable</span></div>" +
      "</div>" +
      '<div class="camera-body">' +
        '<div class="camera-body-top"><div><h3>' + camera.name + "</h3><p>" + camera.location + "</p></div>" +
          HSM.statusBadge(camera.online ? "online" : "offline") + "</div>" +
        '<div class="camera-stats">' +
          '<div class="camera-stat"><strong data-cam-detected>' + detections + '</strong><span>Detected</span></div>' +
          '<div class="camera-stat"><strong data-cam-last>' + HSM.util.timeAgo(camera.lastDetection) + '</strong><span>Last detection</span></div>' +
          '<div class="camera-stat"><strong>' + camera.resolution + '</strong><span>Resolution</span></div>' +
          '<div class="camera-stat"><strong>' + (camera.online ? camera.fps + " fps" : "—") + "</strong><span>Frame rate</span></div>" +
        "</div>" +
        '<div class="camera-actions">' +
          (camera.online
            ? '<button type="button" class="btn btn-sm btn-navy" data-sim-camera="' + camera.id + '"><i class="bi bi-radar"></i> Simulate detection</button>'
            : '<button type="button" class="btn btn-sm btn-orange-soft" data-restore-camera="' + camera.id + '"><i class="bi bi-arrow-clockwise"></i> Restore demo feed</button>') +
          '<button type="button" class="btn btn-sm btn-outline-soft" data-cam-details="' + camera.id + '"><i class="bi bi-info-circle"></i> Details</button>' +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function refresh() {
    HSM.db.cameras.forEach(function (camera) {
      var card = document.querySelector('[data-camera-card="' + camera.id + '"]');
      if (!card) return;
      var offline = !camera.online;
      card.classList.toggle("is-offline", offline);
      var overlay = card.querySelector(".offline-overlay");
      if (overlay) overlay.classList.toggle("d-none", !offline);
      var layer = card.querySelector(".detection-layer");
      if (layer) layer.innerHTML = detectionsFor(camera).join("");
      var detected = card.querySelector("[data-cam-detected]");
      if (detected) detected.textContent = camera.detections;
      var last = card.querySelector("[data-cam-last]");
      if (last) last.textContent = HSM.util.timeAgo(camera.lastDetection);
      var badge = card.querySelector(".camera-body-top .status-badge");
      if (badge) badge.outerHTML = HSM.statusBadge(camera.online ? "online" : "offline");
      var rec = card.querySelector(".rec");
      if (rec) {
        rec.textContent = offline ? "NO SIGNAL" : "REC";
        rec.style.color = offline ? "#ffb3ad" : "";
      }
      var live = card.querySelector(".cam-live");
      if (live) live.style.display = offline ? "none" : "";
      var actions = card.querySelector(".camera-actions");
      if (actions) {
        actions.innerHTML = camera.online
          ? '<button type="button" class="btn btn-sm btn-navy" data-sim-camera="' + camera.id + '"><i class="bi bi-radar"></i> Simulate detection</button>' +
            '<button type="button" class="btn btn-sm btn-outline-soft" data-cam-details="' + camera.id + '"><i class="bi bi-info-circle"></i> Details</button>'
          : '<button type="button" class="btn btn-sm btn-orange-soft" data-restore-camera="' + camera.id + '"><i class="bi bi-arrow-clockwise"></i> Restore demo feed</button>' +
            '<button type="button" class="btn btn-sm btn-outline-soft" data-cam-details="' + camera.id + '"><i class="bi bi-info-circle"></i> Details</button>';
      }
      var stats = card.querySelectorAll(".camera-stat strong");
      if (stats.length >= 4) stats[3].textContent = camera.online ? camera.fps + " fps" : "—";
    });
    var onlineCount = document.getElementById("cameraOnlineCount");
    if (onlineCount) {
      var online = HSM.db.cameras.filter(function (c) { return c.online; }).length;
      onlineCount.textContent = online + " of " + HSM.db.cameras.length;
    }
  }

  function simulateDetection(cameraId) {
    var camera = cameraId ? HSM.store.getCamera(cameraId) : HSM.db.cameras.find(function (c) { return c.online; });
    if (!camera || !camera.online) {
      HSM.ui.toast({ title: "Camera offline", message: "Restore the simulated feed before running detections.", tone: "orange", icon: "bi-wifi-off" });
      return;
    }
    var facility = HSM.util.pick(HSM.db.facilities);
    var delta = 3 + Math.floor(Math.random() * 5);
    facility.occupancy = HSM.util.clamp(facility.occupancy + delta, 0, facility.capacity);
    facility.lastUpdated = new Date().toISOString();
    facility.history = facility.history || [];
    facility.history.push({ occupancy: facility.occupancy, at: facility.lastUpdated });
    if (facility.history.length > 12) facility.history.shift();

    camera.lastDetection = new Date().toISOString();
    camera.detections = 7 + Math.floor(Math.random() * 15);

    var converted = false;
    if (Math.random() < 0.35) {
      var available = HSM.db.tables.filter(function (t) { return t.status === "available"; });
      if (available.length) {
        var table = HSM.util.pick(available);
        table.status = "occupied";
        table.guests = Math.max(1, Math.min(table.seats, 2 + Math.floor(Math.random() * 3)));
        table.seatedAt = new Date().toISOString();
        table.lastUpdated = table.seatedAt;
        converted = true;
      }
    }

    var facilityStatus = HSM.facilityStatus(facility);
    HSM.store.addActivity("camera", "Simulated detection at " + camera.id,
      HSM.util.pick(["restaurant", "pool", "lobby"].indexOf(camera.kind) >= 0 ? "Anonymised figures tracked · average confidence 94%" : "Vehicle movement tracked · average confidence 93%"),
      "bi-camera-video");
    if (converted) {
      HSM.store.addActivity("table", "Table occupancy updated by camera detection",
        "Simulated camera feed triggered a table state change", "bi-cup-hot");
    }
    if (facilityStatus.pct >= 90) {
      HSM.raiseAlert({
        priority: facilityStatus.pct >= 97 ? "critical" : "warning",
        title: facility.name + " at " + Math.round(facilityStatus.pct) + "% capacity",
        description: "Camera-assisted simulation detected a capacity increase at " + facility.name + ".",
        facility: "Facilities",
        source: camera.id,
        ruleKey: "facility-high-" + facility.id
      });
    }
    HSM.afterData(["cameras", "facilities", "dashboard", "restaurant", "alerts"]);
    refresh();
    var card = document.querySelector('[data-camera-card="' + camera.id + '"]');
    if (card) {
      card.classList.add("flash");
      setTimeout(function () { card.classList.remove("flash"); }, 900);
    }
    HSM.ui.toast({
      title: "Detection simulated",
      message: camera.id + " tracked " + camera.detections + " figures and updated " + facility.name + " (demo only).",
      tone: "blue", icon: "bi-radar"
    });
  }

  function restoreCamera(cameraId) {
    var camera = HSM.store.getCamera(cameraId);
    if (!camera) return;
    camera.online = true;
    camera.fps = 24;
    camera.lastDetection = new Date().toISOString();
    camera.detections = 6 + Math.floor(Math.random() * 14);
    var openAlert = HSM.db.alerts.find(function (a) {
      return a.status === "open" && a.ruleKey === "camera-offline-" + camera.id;
    });
    if (openAlert) HSM.resolveAlert(openAlert.id, true);
    HSM.store.addActivity("camera", camera.id + " reconnected", "Simulated feed restored · " + camera.name, "bi-camera-video");
    HSM.afterData(["cameras", "dashboard", "alerts"]);
    refresh();
    HSM.ui.toast({ title: "Demo feed restored", message: camera.id + " is online again (simulated).", tone: "green", icon: "bi-wifi" });
  }

  function openDetails(id) {
    var camera = HSM.store.getCamera(id);
    if (!camera) return;
    var rows = [
      { label: "Camera ID", value: camera.id },
      { label: "Location", value: camera.location },
      { label: "Resolution", value: camera.resolution },
      { label: "Frame rate", value: camera.online ? camera.fps + " fps" : "—" },
      { label: "Status", value: camera.online ? "Online · simulated" : "Offline · simulated" },
      { label: "Last detection", value: HSM.util.fmtDateTime(camera.lastDetection) }
    ];
    var detections = camera.online
      ? Array.from({ length: 5 }).map(function (_, i) {
        var kind = camera.kind === "parking" ? "Vehicle" : camera.kind === "restaurant" && i === 1 ? "Waiter" : "Person";
        return '<li class="tone-' + (kind === "Waiter" ? "yellow" : "green") + '"><div class="h-title">' + kind + " #" + (i + 1) +
          " · confidence " + (0.88 + i * 0.02).toFixed(2) + "</div><span class=\"h-time\">Tracked for " + (12 + i * 7) + "s · simulated</span></li>";
      }).join("")
      : "<li><div class=\"h-title\">No detections available</div><span class=\"h-time\">Camera is offline</span></li>";

    HSM.ui.modal({
      title: camera.name,
      subtitle: camera.id + " · Demo camera metadata",
      body:
        '<div class="detail-hero accent-' + (camera.online ? "green" : "red") + '">' +
          '<div class="dh-icon"><i class="bi bi-camera-video"></i></div>' +
          '<div class="dh-main"><h3>' + camera.name + "</h3><p>" + camera.location + "</p></div>" +
          HSM.statusBadge(camera.online ? "online" : "offline", "lg") +
        "</div>" +
        '<img src="' + camera.image + '" alt="Simulated camera snapshot" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;border:1px solid var(--line);margin-bottom:15px;filter:saturate(.75)" ' +
          'onerror="this.onerror=null;this.src=\'assets/images/camera-fallback.svg\';">' +
        '<div class="detail-grid">' + rows.map(function (r) {
          return '<div class="detail-cell"><span>' + r.label + "</span><strong>" + r.value + "</strong></div>";
        }).join("") + "</div>" +
        '<h4 class="detail-section-title">Simulated detections</h4>' +
        '<ul class="history-list">' + detections + "</ul>" +
        '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div><strong>Stock imagery only.</strong> ' +
          "This photograph is not a real hotel feed. Bounding boxes, confidence scores and tracking IDs are generated in the browser for demonstration.</div></div>",
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>'
    });
  }

  function template() {
    var online = HSM.db.cameras.filter(function (c) { return c.online; }).length;
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-camera-video"></i> Live camera view</div>' +
          "<h1>Camera monitoring</h1><p><strong id=\"cameraOnlineCount\">" + online + " of " + HSM.db.cameras.length + "</strong> simulated camera feeds online. All imagery is stock photography with browser-generated detection overlays. <span class=\"demo-inline\">Not real CCTV</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How detection works</a>' +
        '<button type="button" class="btn btn-navy" id="simulateDetection"><i class="bi bi-radar"></i> Simulate new detection</button></div>' +
      "</div>" +
      '<div class="info-note mb-3 reveal"><i class="bi bi-shield-exclamation"></i><div><strong>Demonstration only.</strong> ' +
        "No CCTV, video analytics, facial recognition or personal data processing is connected. " +
        "Stock photos are used to illustrate what an operator console could look like; boxes and timestamps are simulated.</div></div>" +
      '<div class="camera-grid reveal">' + HSM.db.cameras.map(cameraMarkup).join("") + "</div>";
  }

  HSM.registerPage("cameras", {
    title: "Live Camera View",
    render: function (root) {
      root.innerHTML = template();

      var globalBtn = document.getElementById("simulateDetection");
      if (globalBtn) {
        globalBtn.addEventListener("click", function () { simulateDetection(null); });
      }
      root.addEventListener("click", function (event) {
        var sim = event.target.closest("[data-sim-camera]");
        if (sim) { simulateDetection(sim.getAttribute("data-sim-camera")); return; }
        var restore = event.target.closest("[data-restore-camera]");
        if (restore) { restoreCamera(restore.getAttribute("data-restore-camera")); return; }
        var details = event.target.closest("[data-cam-details]");
        if (details) openDetails(details.getAttribute("data-cam-details"));
      });

      clockTimer = setInterval(function () {
        var time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        document.querySelectorAll(".js-cam-time").forEach(function (el) { el.textContent = time; });
        document.querySelectorAll("[data-camera-card]").forEach(function (card) {
          var camera = HSM.store.getCamera(card.getAttribute("data-camera-card"));
          var last = card.querySelector("[data-cam-last]");
          if (camera && last) last.textContent = HSM.util.timeAgo(camera.lastDetection);
        });
      }, 1000);
    },
    onData: function () { refresh(); },
    openPending: function (pending) {
      if (pending && pending.type === "camera") openDetails(pending.id);
    },
    destroy: function () {
      if (clockTimer) clearInterval(clockTimer);
      clockTimer = null;
    }
  });
})(window.HSM);
