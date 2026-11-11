/* ==========================================================================
   Space Monitoring System — simulated live monitoring engine
   One weighted event per cycle. No real sensors, CCTV or IoT are involved.
   ========================================================================== */

(function (HSM) {
  "use strict";

  var timer = null;
  var running = false;
  var util = HSM.util;

  var SIM_GUESTS = [
    "E. Fischer", "R. Costa", "M. Silva", "T. Berg", "A. Moreau", "S. Patel",
    "K. Tanaka", "L. Jensen", "N. Rossi", "D. Brown", "H. Yilmaz", "P. Silva"
  ];

  function nowISO() { return new Date().toISOString(); }

  function weighted(options) {
    var total = options.reduce(function (sum, o) { return sum + o[1]; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < options.length; i++) {
      r -= options[i][1];
      if (r <= 0) return options[i][0];
    }
    return options[options.length - 1][0];
  }

  function logSim(type, title, detail, icon) {
    if (HSM.settings.notifications.activity === false) return;
    HSM.store.addActivity(type, title, detail, icon);
  }

  /* ------------------------------ Event: rooms ---------------------------- */

  function roomEvent() {
    var room = util.pick(HSM.db.rooms);
    var next;
    switch (room.status) {
      case "occupied":
        next = weighted([["cleaning", 65], ["available", 35]]);
        break;
      case "available":
        next = weighted([["occupied", 42], ["reserved", 25], ["cleaning", 21], ["maintenance", 12]]);
        break;
      case "cleaning":
        next = weighted([["available", 82], ["maintenance", 18]]);
        break;
      case "reserved":
        next = weighted([["occupied", 72], ["available", 28]]);
        break;
      default:
        next = weighted([["available", 62], ["cleaning", 38]]);
    }

    room.status = next;
    room.lastUpdated = nowISO();
    if (next === "occupied") {
      room.guest = util.pick(SIM_GUESTS);
    } else if (next !== "reserved") {
      room.guest = null;
    }
    room.history.unshift({ status: next, at: room.lastUpdated });
    if (room.history.length > 8) room.history.length = 8;

    var meta = HSM.meta(next);
    logSim("room", "Room " + room.number + " changed to " + meta.label,
      "Simulated housekeeping event · Floor " + room.floor, "bi-door-open");
    return ["rooms", "dashboard"];
  }

  /* ------------------------------ Event: tables --------------------------- */

  function tableEvent() {
    var table = util.pick(HSM.db.tables);
    var next;
    switch (table.status) {
      case "available":
        next = weighted([["occupied", 80], ["cleaning", 20]]);
        break;
      case "occupied":
        next = weighted([["cleaning", 55], ["service", 25], ["available", 20]]);
        break;
      case "cleaning":
        next = weighted([["available", 85], ["occupied", 15]]);
        break;
      default:
        next = weighted([["occupied", 50], ["cleaning", 50]]);
    }

    table.status = next;
    table.lastUpdated = nowISO();
    if (next === "occupied") {
      table.guests = 1 + Math.floor(Math.random() * table.seats);
      table.seatedAt = nowISO();
      table.waitingSince = null;
    } else if (next === "cleaning") {
      table.guests = 0;
      table.seatedAt = null;
      table.waitingSince = nowISO();
    } else if (next === "service") {
      table.seatedAt = null;
      table.waitingSince = nowISO();
    } else {
      table.guests = 0;
      table.seatedAt = null;
      table.waitingSince = null;
    }

    var meta = HSM.meta(next);
    logSim("table", "Table " + table.number + " changed to " + meta.label,
      table.zone + " · Simulated table sensor", "bi-cup-hot");
    return ["restaurant", "dashboard"];
  }

  /* ------------------------------ Event: parking -------------------------- */

  function parkingEvent() {
    var spot = util.pick(HSM.db.parking);
    var next;
    switch (spot.status) {
      case "available":
        next = weighted([["occupied", 72], ["reserved", 18], ["maintenance", 10]]);
        break;
      case "occupied":
        next = weighted([["available", 92], ["reserved", 8]]);
        break;
      case "reserved":
        next = weighted([["occupied", 70], ["available", 30]]);
        break;
      default:
        next = weighted([["available", 80], ["occupied", 20]]);
    }

    spot.status = next;
    spot.lastUpdated = nowISO();
    if (next === "occupied") {
      spot.vehicle = spot.type === "EV charging" ? "Electric" : util.pick(["Sedan", "SUV", "Van", "Compact"]);
      spot.plate = "GH-" + (1000 + Math.floor(Math.random() * 8999));
    } else {
      spot.vehicle = null;
      spot.plate = null;
    }

    var meta = HSM.meta(next);
    logSim("parking", "Parking " + spot.id + " became " + meta.label,
      "Zone " + spot.zone + " · Simulated parking sensor", "bi-car-front");
    return ["parking", "dashboard"];
  }

  /* ----------------------------- Event: facilities ------------------------ */

  function facilityEvent() {
    var facility = util.pick(HSM.db.facilities);
    var delta = Math.floor(Math.random() * 11) - 5;
    if (delta === 0) delta = Math.random() > 0.5 ? 2 : -2;
    facility.occupancy = util.clamp(facility.occupancy + delta, 0, facility.capacity);
    facility.lastUpdated = nowISO();
    facility.history = facility.history || [];
    facility.history.push({ occupancy: facility.occupancy, at: facility.lastUpdated });
    if (facility.history.length > 12) facility.history.shift();

    var status = HSM.facilityStatus(facility);
    logSim("facility", facility.name + " updated to " + Math.round(status.pct) + "% utilization",
      facility.occupancy + " of " + facility.capacity + " spaces in use", facility.icon);
    return ["facilities", "dashboard"];
  }

  /* ------------------------------ Event: cameras -------------------------- */

  function cameraEvent() {
    var camera = util.pick(HSM.db.cameras);
    camera.online = !camera.online;
    if (camera.online) {
      camera.lastDetection = nowISO();
      camera.detections = 6 + Math.floor(Math.random() * 16);
      camera.fps = 24;
      logSim("camera", camera.id + " reconnected", "Simulated feed restored · " + camera.name, "bi-camera-video");
      HSM.db.alerts.forEach(function (a) {
        if (a.status === "open" && a.ruleKey === "camera-offline-" + camera.id) {
          HSM.resolveAlert(a.id, true);
        }
      });
    } else {
      camera.fps = 0;
      logSim("camera", camera.id + " went offline", "Simulated signal lost · " + camera.name, "bi-wifi-off");
      HSM.raiseAlert({
        priority: "critical",
        title: camera.name + " camera offline",
        description: camera.id + " (" + camera.name + ") stopped sending a simulated heartbeat. Monitoring is unavailable for this view.",
        facility: "Cameras",
        source: "Camera " + camera.id,
        ruleKey: "camera-offline-" + camera.id
      });
    }
    return ["cameras", "dashboard", "alerts"];
  }

  /* ---------------------------- Event: heartbeat -------------------------- */

  function heartbeatEvent() {
    var room = util.pick(HSM.db.rooms);
    room.lastUpdated = nowISO();
    if (Math.random() > 0.55) {
      logSim("system", "Room " + room.number + " heartbeat received",
        "Simulated status sensor reported a fresh timestamp", "bi-activity");
    }
    return ["rooms"];
  }

  /* ------------------------------- Rule engine ---------------------------- */

  function checkRules() {
    var now = Date.now();
    var counts = HSM.stats.parkingCounts();

    /* Waiting tables above the 10 minute demonstration threshold. */
    HSM.db.tables.forEach(function (table) {
      if (table.status !== "cleaning" && table.status !== "service") return;
      var waiting = util.minsSince(table.waitingSince);
      if (waiting >= 10) {
        HSM.raiseAlert({
          priority: "warning",
          title: "Table " + table.number + (table.status === "cleaning" ? " waiting for cleaning" : " waiting for service"),
          description: "Table " + table.number + " has been waiting for " + Math.round(waiting) +
            " minutes. The simulation threshold is 10 minutes.",
          facility: "Restaurant",
          source: "Table " + table.number,
          ruleKey: "table-wait-" + table.number
        });
      }
    });

    /* Parking occupancy threshold. */
    if (counts.occupiedPct >= 90) {
      HSM.raiseAlert({
        priority: "warning",
        title: "Parking occupancy above 90%",
        description: "Simulated occupancy is " + counts.occupiedPct + "% (" + counts.occupied + " / " + counts.total + "). Only " + counts.available + " spaces remain.",
        facility: "Parking",
        source: "Parking simulation",
        ruleKey: "parking-high"
      });
    }

    /* Facilities approaching or at capacity. */
    HSM.db.facilities.forEach(function (facility) {
      var status = HSM.facilityStatus(facility);
      if (status.pct >= 90) {
        HSM.raiseAlert({
          priority: status.pct >= 97 ? "critical" : "warning",
          title: facility.name + " at " + Math.round(status.pct) + "% capacity",
          description: facility.name + " is at " + facility.occupancy + " of " + facility.capacity +
            " guest capacity. Consider limiting new entries.",
          facility: "Facilities",
          source: facility.name,
          ruleKey: "facility-high-" + facility.id
        });
      }
    });

    /* Offline cameras. */
    HSM.db.cameras.forEach(function (camera) {
      if (!camera.online) {
        HSM.raiseAlert({
          priority: "critical",
          title: camera.name + " camera offline",
          description: camera.id + " (" + camera.name + ") is not sending a simulated heartbeat.",
          facility: "Cameras",
          source: "Camera " + camera.id,
          ruleKey: "camera-offline-" + camera.id
        });
      }
    });

    /* One stale room example (older than three hours). */
    var stale = HSM.db.rooms
      .filter(function (r) { return util.minsSince(r.lastUpdated) > 180; })
      .sort(function (a, b) { return new Date(a.lastUpdated) - new Date(b.lastUpdated); })[0];
    if (stale && !HSM.db.alerts.some(function (a) { return a.ruleKey === "stale-room-" + stale.number && a.status === "open"; })) {
      HSM.raiseAlert({
        priority: "info",
        title: "Room " + stale.number + " status not updated recently",
        description: "The simulated sensor for room " + stale.number + " has not reported for " +
          Math.round(util.minsSince(stale.lastUpdated) / 60) + " hours. Check the room status manually.",
        facility: "Rooms",
        source: "Room " + stale.number,
        ruleKey: "stale-room-" + stale.number
      });
    }
  }

  /* --------------------------------- Engine ------------------------------- */

  var EVENTS = [
    { fn: roomEvent, weight: 25 },
    { fn: tableEvent, weight: 25 },
    { fn: parkingEvent, weight: 18 },
    { fn: facilityEvent, weight: 18 },
    { fn: cameraEvent, weight: 7 },
    { fn: heartbeatEvent, weight: 7 }
  ];

  function pickEvent() {
    var total = EVENTS.reduce(function (s, e) { return s + e.weight; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < EVENTS.length; i++) {
      r -= EVENTS[i].weight;
      if (r <= 0) return EVENTS[i];
    }
    return EVENTS[EVENTS.length - 1];
  }

  function tick() {
    if (!HSM.settings.simEnabled) return;
    var event = pickEvent();
    var areas = [];
    try {
      areas = event.fn() || [];
      checkRules();
    } catch (err) {
      console.error("[simulation]", err);
    }
    HSM.afterData(areas.length ? areas : ["dashboard"]);
  }

  function schedule() {
    if (timer) clearInterval(timer);
    timer = null;
    if (!running) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      tick();
    }, HSM.settings.simSpeed * 1000);
  }

  function start() {
    if (running) { schedule(); return; }
    running = true;
    HSM.simPrefs.running = true;
    HSM.store.saveSimPrefs();
    schedule();
    HSM.updateSimUI();
  }

  function pause(persist) {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    if (persist !== false) {
      HSM.simPrefs.running = false;
      HSM.store.saveSimPrefs();
    }
    HSM.updateSimUI();
  }

  HSM.sim = {
    init: function () {
      var shouldRun = HSM.settings.simEnabled && HSM.simPrefs.running !== false;
      if (shouldRun) start();
      else pause(false);
      HSM.updateSimUI();
    },
    start: start,
    pause: function () { pause(true); },
    isRunning: function () { return running; },
    toggle: function () {
      if (running) pause(true);
      else start();
    },
    setSpeed: function (seconds) {
      HSM.settings.simSpeed = util.clamp(Number(seconds) || 7, 3, 15);
      HSM.store.saveSettings();
      if (running) schedule();
      HSM.updateSimUI();
    },
    tickOnce: tick,
    updateIndicator: function (isRunning) {
      var dot = document.querySelector(".sim-mini .live-dot");
      if (dot) {
        dot.style.animation = isRunning ? "" : "none";
        dot.style.background = isRunning ? "var(--accent)" : "var(--sidebar-muted)";
      }
    },
    resetDemo: function () {
      pause(false);
      HSM.store.reset();
      HSM.applySettings();
      HSM.settings.simEnabled = true;
      HSM.simPrefs.running = true;
      HSM.store.saveSettings();
      HSM.store.saveSimPrefs();
      HSM.refreshNotifications();
      running = true;
      schedule();
      HSM.updateSimUI();
      HSM.router.reload();
      HSM.ui.toast({
        title: "Demo data reset",
        message: "All simulated spaces, alerts and preferences have been regenerated.",
        tone: "green", icon: "bi-arrow-clockwise"
      });
    }
  };
})(window.HSM);
