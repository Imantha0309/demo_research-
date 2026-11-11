/* ==========================================================================
   Space Monitoring System — mock data, persistence and shared statistics
   Frontend-only research prototype. Every value is simulated.
   ========================================================================== */

window.HSM = window.HSM || {};

(function (HSM) {
  "use strict";

  /* ------------------------------ Status system --------------------------- */

  var STATUS_META = {
    available:   { label: "Available",            tone: "green",    icon: "bi-check-circle-fill" },
    occupied:    { label: "Occupied",             tone: "red",      icon: "bi-person-fill" },
    cleaning:    { label: "Cleaning",             tone: "orange",   icon: "bi-stars" },
    reserved:    { label: "Reserved",             tone: "blue",     icon: "bi-calendar-check-fill" },
    maintenance: { label: "Maintenance",          tone: "grey",     icon: "bi-tools" },
    service:     { label: "Waiting for Service",  tone: "yellow",   icon: "bi-bell-fill" },
    online:      { label: "Online",               tone: "green",    icon: "bi-wifi" },
    offline:     { label: "Offline",              tone: "red",      icon: "bi-wifi-off" },
    critical:    { label: "Critical",             tone: "dark-red", icon: "bi-exclamation-octagon-fill" },
    warning:     { label: "Warning",              tone: "orange",   icon: "bi-exclamation-triangle-fill" },
    info:        { label: "Information",          tone: "blue",     icon: "bi-info-circle-fill" },
    resolved:    { label: "Resolved",             tone: "green",    icon: "bi-check2-circle" }
  };

  HSM.STATUS = STATUS_META;
  HSM.meta = function (key) {
    return STATUS_META[key] || { label: key || "Unknown", tone: "grey", icon: "bi-circle" };
  };
  HSM.statusBadge = function (key, extraClass) {
    var m = HSM.meta(key);
    return '<span class="status-badge tone-' + m.tone + (extraClass ? " " + extraClass : "") + '">' +
      '<span class="status-dot"></span>' + m.label + "</span>";
  };

  /* -------------------------------- Helpers ------------------------------- */

  var uidSeq = 1000;

  var util = {
    randInt: function (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    pick: function (arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },
    clamp: function (v, min, max) {
      return Math.max(min, Math.min(max, v));
    },
    pad: function (n) {
      return n < 10 ? "0" + n : String(n);
    },
    isoMinutesAgo: function (minutes) {
      return new Date(Date.now() - minutes * 60000).toISOString();
    },
    minsSince: function (iso) {
      if (!iso) return 0;
      return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    },
    fmtTime: function (iso) {
      var d = iso ? new Date(iso) : new Date();
      return util.pad(d.getHours()) + ":" + util.pad(d.getMinutes());
    },
    fmtDateTime: function (iso) {
      if (!iso) return "—";
      var d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " + util.fmtTime(d);
    },
    durationLabel: function (minutes) {
      minutes = Math.max(0, Math.round(minutes));
      if (minutes < 60) return minutes + "m";
      var h = Math.floor(minutes / 60);
      var m = minutes % 60;
      return h + "h" + (m ? " " + m + "m" : "");
    },
    timeAgo: function (iso) {
      if (!iso) return "—";
      var mins = util.minsSince(iso);
      if (mins < 1) return "just now";
      if (mins < 60) return Math.floor(mins) + "m ago";
      var h = Math.floor(mins / 60);
      if (h < 24) return h + "h ago";
      var d = Math.floor(h / 24);
      return d + "d ago";
    },
    escapeHtml: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },
    uid: function (prefix) {
      uidSeq += 1;
      return (prefix || "ID") + "-" + uidSeq;
    }
  };
  HSM.util = util;

  /* ------------------------------ Seed builder ---------------------------- */

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var GUESTS = [
    "J. Carter", "M. Alvarez", "S. Nakamura", "L. Dubois", "A. Haddad", "R. Okafor",
    "E. Lindqvist", "T. Novak", "P. Rossi", "K. Andersen", "N. Petrov", "D. Kim",
    "H. Muller", "C. Ferreira", "B. O'Sullivan", "F. Haddad", "I. Kowalski", "G. Mendes",
    "V. Sharma", "Y. Tanaka", "W. Zhang", "O. Ibrahim", "Q. Nguyen", "Z. Rahman"
  ];
  var ROOM_TYPES = ["Double Room", "Twin Room", "Deluxe Room", "Executive Suite", "Family Room", "Single Room"];
  var VEHICLES = ["Sedan", "SUV", "Electric", "Van", "Compact"];

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function roomHistory(status, lastUpdated, rng) {
    var base = new Date(lastUpdated).getTime();
    var prior = status === "occupied" ? "reserved"
      : status === "available" ? "cleaning"
      : status === "cleaning" ? "occupied"
      : status === "reserved" ? "available"
      : "maintenance";
    var older = prior === "cleaning" ? "occupied" : prior === "occupied" ? "reserved" : "available";
    return [
      { status: status, at: new Date(base).toISOString() },
      { status: prior, at: new Date(base - (18 + Math.floor(rng() * 45)) * 60000).toISOString() },
      { status: older, at: new Date(base - (70 + Math.floor(rng() * 90)) * 60000).toISOString() }
    ];
  }

  function buildRooms(rng) {
    var pool = [];
    var i;
    for (i = 0; i < 84; i++) pool.push("occupied");
    for (i = 0; i < 21; i++) pool.push("available");
    for (i = 0; i < 7; i++) pool.push("cleaning");
    for (i = 0; i < 5; i++) pool.push("reserved");
    for (i = 0; i < 3; i++) pool.push("maintenance");
    pool = shuffle(pool, rng);

    var rooms = [];
    var idx = 0;
    for (var floor = 1; floor <= 6; floor++) {
      for (var n = 1; n <= 20; n++) {
        var number = String(floor) + (n < 10 ? "0" + n : n);
        var status = pool[idx++];
        var updatedMins = status === "occupied" ? 3 + Math.floor(rng() * 120)
          : status === "cleaning" ? 1 + Math.floor(rng() * 16)
          : status === "reserved" ? 10 + Math.floor(rng() * 120)
          : 15 + Math.floor(rng() * 240);
        var updated = util.isoMinutesAgo(updatedMins);
        rooms.push({
          id: number,
          number: number,
          floor: floor,
          type: ROOM_TYPES[(n + floor) % ROOM_TYPES.length],
          status: status,
          guest: status === "occupied" || status === "reserved" ? GUESTS[(n * 3 + floor) % GUESTS.length] : null,
          rate: 140 + ((n * 17 + floor * 23) % 280),
          lastUpdated: updated,
          history: roomHistory(status, updated, rng)
        });
      }
    }
    return rooms;
  }

  function buildTables(rng) {
    var statuses = [
      "occupied", "available", "cleaning", "service",
      "occupied", "occupied", "occupied", "cleaning",
      "occupied", "occupied", "service", "occupied",
      "occupied", "occupied", "occupied", "available",
      "occupied", "available", "occupied", "occupied",
      "available", "occupied", "cleaning", "occupied"
    ];
    var zones = [];
    var i;
    for (i = 0; i < 6; i++) zones.push("Window side");
    for (i = 0; i < 12; i++) zones.push("Main dining");
    for (i = 0; i < 6; i++) zones.push("Terrace");

    var seatsPattern = [4, 2, 4, 4, 6, 4];
    var tables = [];
    for (i = 0; i < 24; i++) {
      var number = "T" + (i < 9 ? "0" + (i + 1) : (i + 1));
      var status = statuses[i];
      var seats = seatsPattern[i % seatsPattern.length];
      var t = {
        id: number,
        number: number,
        zone: zones[i],
        seats: seats,
        status: status,
        guests: status === "occupied" ? Math.max(1, Math.min(seats, 1 + Math.floor(rng() * seats))) : 0,
        seatedAt: null,
        waitingSince: null,
        lastUpdated: util.isoMinutesAgo(5 + Math.floor(rng() * 50))
      };
      if (status === "occupied") {
        t.seatedAt = util.isoMinutesAgo(8 + Math.floor(rng() * 80));
      }
      if (status === "cleaning" || status === "service") {
        var wait = number === "T08" ? 12 : 2 + Math.floor(rng() * 9);
        t.waitingSince = util.isoMinutesAgo(wait);
        t.lastUpdated = t.waitingSince;
      }
      tables.push(t);
    }
    return tables;
  }

  function buildParking(rng) {
    var statuses = [];
    var i;
    for (i = 0; i < 18; i++) statuses.push("occupied");
    for (i = 0; i < 18; i++) statuses.push("available");
    for (i = 0; i < 2; i++) statuses.push("reserved");
    for (i = 0; i < 2; i++) statuses.push("maintenance");
    statuses = shuffle(statuses, rng);

    var spots = [];
    for (i = 0; i < 40; i++) {
      var id = "P" + (i < 9 ? "0" + (i + 1) : (i + 1));
      var type = (i === 4 || i === 24 || i === 34) ? "EV charging"
        : (i === 1 || i === 21) ? "Accessible"
        : (i === 9 || i === 29) ? "VIP"
        : "Standard";
      var status = statuses[i];
      var vehicle = null;
      var plate = null;
      if (status === "occupied") {
        vehicle = type === "EV charging" ? "Electric" : util.pick(VEHICLES);
        plate = "GH-" + (1000 + Math.floor(rng() * 8999));
      }
      spots.push({
        id: id,
        zone: i < 20 ? "A" : "B",
        type: type,
        status: status,
        vehicle: vehicle,
        plate: plate,
        lastUpdated: util.isoMinutesAgo(2 + Math.floor(rng() * 120))
      });
    }
    return spots;
  }

  function buildFacilities() {
    var definitions = [
      { id: "pool", name: "Swimming Pool", icon: "bi-water", capacity: 80, occupancy: 60, location: "Level 3 · Pool deck", description: "Outdoor leisure pool with 80-guest capacity and lifeguard station." },
      { id: "gym", name: "Fitness Centre", icon: "bi-dumbbell", capacity: 40, occupancy: 22, location: "Level 2 · East wing", description: "Cardio and weights area with instructor-led sessions." },
      { id: "meeting", name: "Meeting Rooms", icon: "bi-people-fill", capacity: 60, occupancy: 42, location: "Level 1 · Business centre", description: "Four flexible meeting rooms combined into one monitored space." },
      { id: "lounge", name: "Executive Lounge", icon: "bi-cup", capacity: 50, occupancy: 18, location: "Level 6 · Sky lounge", description: "Members' lounge with refreshments and workspace seating." },
      { id: "conference", name: "Conference Hall", icon: "bi-projector", capacity: 200, occupancy: 60, location: "Level 0 · Convention floor", description: "Multi-purpose hall configured for a 150-seat conference." }
    ];
    return definitions.map(function (f) {
      var history = [];
      for (var h = 5; h >= 0; h--) {
        history.push({
          occupancy: Math.max(0, Math.min(f.capacity, f.occupancy + (h === 0 ? 0 : Math.floor(Math.random() * 12) - 6))),
          at: util.isoMinutesAgo(h * 12 + 2)
        });
      }
      return Object.assign({}, f, {
        lastUpdated: util.isoMinutesAgo(2 + Math.floor(Math.random() * 18)),
        history: history
      });
    });
  }

  function buildCameras() {
    return [
      {
        id: "CAM-01", name: "Restaurant Overhead", location: "Level 2 · Main dining room",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=70",
        online: true, resolution: "1920 × 1080", fps: 24,
        lastDetection: util.isoMinutesAgo(1), detections: 18, kind: "restaurant"
      },
      {
        id: "CAM-02", name: "Parking Area", location: "Level -1 · Parking zone A",
        image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=70",
        online: false, resolution: "1280 × 720", fps: 0,
        lastDetection: util.isoMinutesAgo(34), detections: 0, kind: "parking"
      },
      {
        id: "CAM-03", name: "Pool Deck", location: "Level 3 · Outdoor pool",
        image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=70",
        online: true, resolution: "1920 × 1080", fps: 24,
        lastDetection: util.isoMinutesAgo(2), detections: 14, kind: "pool"
      },
      {
        id: "CAM-04", name: "Lobby Entrance", location: "Level 0 · Reception",
        image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=70",
        online: true, resolution: "1920 × 1080", fps: 24,
        lastDetection: util.isoMinutesAgo(1), detections: 9, kind: "lobby"
      }
    ];
  }

  function buildAlerts() {
    return [
      {
        id: "ALR-2041", priority: "critical", status: "open",
        title: "Parking camera offline",
        description: "CAM-02 (Parking Area) has not sent a simulated heartbeat for 8 minutes. Live monitoring is unavailable for zone A.",
        facility: "Parking", source: "Camera CAM-02", ruleKey: "camera-offline-CAM-02",
        unread: true, createdAt: util.isoMinutesAgo(8), resolvedAt: null
      },
      {
        id: "ALR-2042", priority: "warning", status: "open",
        title: "Table T08 waiting for cleaning",
        description: "Table T08 has been waiting for cleaning for 12 minutes. The demonstration service standard is 10 minutes.",
        facility: "Restaurant", source: "Table T08", ruleKey: "table-wait-T08",
        unread: true, createdAt: util.isoMinutesAgo(12), resolvedAt: null
      },
      {
        id: "ALR-2043", priority: "warning", status: "open",
        title: "Swimming Pool near maximum capacity",
        description: "Pool occupancy is at 75% of capacity (60 / 80 guests). Consider monitoring the pool deck more closely.",
        facility: "Facilities", source: "Swimming Pool", ruleKey: "facility-high-pool",
        unread: true, createdAt: util.isoMinutesAgo(5), resolvedAt: null
      },
      {
        id: "ALR-2039", priority: "warning", status: "resolved",
        title: "Parking area reached 90% occupancy",
        description: "Simulated parking occupancy reached 90% during the evening peak. The alert cleared after 14 minutes.",
        facility: "Parking", source: "Parking sensors", ruleKey: null,
        unread: false, createdAt: util.isoMinutesAgo(126), resolvedAt: util.isoMinutesAgo(95)
      },
      {
        id: "ALR-2038", priority: "info", status: "resolved",
        title: "Room 118 maintenance completed",
        description: "Housekeeping marked the simulated maintenance work in room 118 as complete. The room is back in the availability pool.",
        facility: "Rooms", source: "Room 118", ruleKey: null,
        unread: false, createdAt: util.isoMinutesAgo(220), resolvedAt: util.isoMinutesAgo(186)
      }
    ];
  }

  function buildActivities() {
    return [
      { id: util.uid("ACT"), type: "room", icon: "bi-door-open", title: "Room 204 changed to Occupied", detail: "Guest checked in · Floor 2", at: util.isoMinutesAgo(3) },
      { id: util.uid("ACT"), type: "table", icon: "bi-cup-hot", title: "Table T11 became Available", detail: "Cleaning completed by housekeeping", at: util.isoMinutesAgo(6) },
      { id: util.uid("ACT"), type: "parking", icon: "bi-car-front", title: "Parking P12 became Occupied", detail: "Vehicle GH-4821 · Zone A", at: util.isoMinutesAgo(9) },
      { id: util.uid("ACT"), type: "facility", icon: "bi-water", title: "Swimming Pool reached 75% capacity", detail: "60 of 80 spaces in use", at: util.isoMinutesAgo(12) },
      { id: util.uid("ACT"), type: "camera", icon: "bi-camera-video", title: "CAM-04 completed a simulated scan", detail: "9 anonymised figures tracked in the lobby", at: util.isoMinutesAgo(18) },
      { id: util.uid("ACT"), type: "table", icon: "bi-bell", title: "Table T04 requested service", detail: "Waiting for service · Main dining", at: util.isoMinutesAgo(22) },
      { id: util.uid("ACT"), type: "room", icon: "bi-box-arrow-right", title: "Room 317 checked out", detail: "Status changed to Cleaning", at: util.isoMinutesAgo(27) },
      { id: util.uid("ACT"), type: "facility", icon: "bi-dumbbell", title: "Fitness Centre occupancy updated", detail: "22 of 40 spaces in use (55%)", at: util.isoMinutesAgo(35) }
    ];
  }

  function buildAnalytics(rng) {
    var days = [];
    var now = new Date();
    for (var d = 29; d >= 0; d--) {
      var date = new Date(now.getTime() - d * 86400000);
      var occ = Math.round(62 + rng() * 24);
      days.push({
        date: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        occupied: occ,
        available: 100 - occ,
        restaurant: Math.round(52 + rng() * 34),
        parking: Math.round(38 + rng() * 48),
        footfall: Math.round(280 + rng() * 480)
      });
    }

    var weekly = [
      { day: "Mon", rooms: 68, restaurant: 61, parking: 54, facilities: 48 },
      { day: "Tue", rooms: 71, restaurant: 58, parking: 60, facilities: 52 },
      { day: "Wed", rooms: 74, restaurant: 66, parking: 63, facilities: 57 },
      { day: "Thu", rooms: 72, restaurant: 70, parking: 68, facilities: 61 },
      { day: "Fri", rooms: 81, restaurant: 82, parking: 77, facilities: 72 },
      { day: "Sat", rooms: 88, restaurant: 91, parking: 85, facilities: 84 },
      { day: "Sun", rooms: 79, restaurant: 76, parking: 69, facilities: 65 }
    ];

    var hours = [];
    for (var h = 6; h <= 23; h++) {
      var peak = Math.max(0, 1 - Math.abs(h - 19) / 7);
      hours.push({
        hour: util.pad(h) + ":00",
        turns: Math.round(6 + peak * 18 + rng() * 5),
        parking: Math.round(22 + peak * 62 + rng() * 8),
        footfall: Math.round(40 + peak * 190 + rng() * 30)
      });
    }

    return {
      days: days,
      weekly: weekly,
      hours: hours,
      facilityComparison: [
        { name: "Pool", pct: 75 },
        { name: "Gym", pct: 55 },
        { name: "Meeting rooms", pct: 70 },
        { name: "Lounge", pct: 36 },
        { name: "Conference", pct: 30 }
      ],
      generatedAt: new Date().toISOString()
    };
  }

  HSM.buildSeed = function () {
    var rng = mulberry32(0x5EA7C0DE);
    return {
      version: 1,
      rooms: buildRooms(rng),
      tables: buildTables(rng),
      parking: buildParking(rng),
      facilities: buildFacilities(),
      cameras: buildCameras(),
      alerts: buildAlerts(),
      activities: buildActivities(),
      analytics: buildAnalytics(rng),
      savedAt: new Date().toISOString()
    };
  };

  /* --------------------------------- Store -------------------------------- */

  var KEYS = {
    state: "hsm.state.v1",
    settings: "hsm.settings.v1",
    sim: "hsm.sim.v1"
  };

  var DEFAULT_SETTINGS = {
    hotelName: "Grand Horizon Hotel",
    theme: "light",
    simSpeed: 7,
    simEnabled: true,
    notifications: {
      alerts: true,
      activity: true,
      sound: false
    }
  };

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validState(state) {
    return state && state.version === 1 &&
      Array.isArray(state.rooms) && state.rooms.length === 120 &&
      Array.isArray(state.tables) && state.tables.length === 24 &&
      Array.isArray(state.parking) && state.parking.length === 40 &&
      Array.isArray(state.facilities) && state.facilities.length === 5 &&
      Array.isArray(state.cameras) && state.cameras.length >= 4 &&
      Array.isArray(state.alerts) && Array.isArray(state.activities);
  }

  HSM.settings = copy(DEFAULT_SETTINGS);
  HSM.simPrefs = { running: true };

  HSM.store = {
    init: function () {
      var seed = HSM.buildSeed();
      var savedState = readJSON(KEYS.state);
      HSM.db = validState(savedState) ? savedState : seed;
      if (!HSM.db.analytics) HSM.db.analytics = seed.analytics;

      var savedSettings = readJSON(KEYS.settings) || {};
      HSM.settings = Object.assign({}, copy(DEFAULT_SETTINGS), savedSettings, {
        notifications: Object.assign({}, DEFAULT_SETTINGS.notifications, savedSettings.notifications || {})
      });
      HSM.settings.simSpeed = util.clamp(Number(HSM.settings.simSpeed) || 7, 3, 15);

      var savedSim = readJSON(KEYS.sim) || {};
      HSM.simPrefs = { running: savedSim.running !== false };
    },

    save: function () {
      if (!HSM.db) return false;
      HSM.db.savedAt = new Date().toISOString();
      return writeJSON(KEYS.state, HSM.db);
    },

    saveSettings: function () {
      return writeJSON(KEYS.settings, HSM.settings);
    },

    saveSimPrefs: function () {
      return writeJSON(KEYS.sim, HSM.simPrefs);
    },

    reset: function () {
      try {
        localStorage.removeItem(KEYS.state);
        localStorage.removeItem(KEYS.settings);
        localStorage.removeItem(KEYS.sim);
      } catch (err) { /* storage may be unavailable */ }
      HSM.db = HSM.buildSeed();
      HSM.settings = copy(DEFAULT_SETTINGS);
      HSM.simPrefs = { running: true };
      this.save();
      this.saveSettings();
      this.saveSimPrefs();
    },

    addActivity: function (type, title, detail, icon) {
      if (!HSM.db) return null;
      var entry = {
        id: util.uid("ACT"),
        type: type,
        icon: icon || "bi-activity",
        title: title,
        detail: detail || "Simulated monitoring event",
        at: new Date().toISOString()
      };
      HSM.db.activities.unshift(entry);
      if (HSM.db.activities.length > 40) HSM.db.activities.length = 40;
      return entry;
    },

    addAlert: function (payload) {
      if (!HSM.db) return { alert: null, created: false };
      if (payload.ruleKey) {
        var existing = HSM.db.alerts.find(function (a) {
          return a.ruleKey === payload.ruleKey && a.status === "open";
        });
        if (existing) {
          /* Keep the original timestamp and read state while the condition persists. */
          if (payload.description) existing.description = payload.description;
          return { alert: existing, created: false };
        }
      }
      var alert = {
        id: util.uid("ALR"),
        priority: payload.priority || "info",
        status: "open",
        title: payload.title,
        description: payload.description || "",
        facility: payload.facility || "General",
        source: payload.source || "Simulated monitoring",
        ruleKey: payload.ruleKey || null,
        unread: true,
        createdAt: new Date().toISOString(),
        resolvedAt: null
      };
      HSM.db.alerts.unshift(alert);
      if (HSM.db.alerts.length > 60) HSM.db.alerts.length = 60;
      return { alert: alert, created: true };
    },

    getAlert: function (id) {
      return HSM.db ? HSM.db.alerts.find(function (a) { return a.id === id; }) : null;
    },

    getRoom: function (id) {
      return HSM.db ? HSM.db.rooms.find(function (r) { return r.id === id; }) : null;
    },

    getTable: function (id) {
      return HSM.db ? HSM.db.tables.find(function (t) { return t.id === id; }) : null;
    },

    getParking: function (id) {
      return HSM.db ? HSM.db.parking.find(function (p) { return p.id === id; }) : null;
    },

    getFacility: function (id) {
      return HSM.db ? HSM.db.facilities.find(function (f) { return f.id === id; }) : null;
    },

    getCamera: function (id) {
      return HSM.db ? HSM.db.cameras.find(function (c) { return c.id === id; }) : null;
    }
  };

  /* --------------------------------- Stats -------------------------------- */

  function countBy(items, status) {
    return items.filter(function (i) { return i.status === status; }).length;
  }

  HSM.facilityStatus = function (facility) {
    var pct = facility.capacity ? (facility.occupancy / facility.capacity) * 100 : 0;
    if (pct >= 90) return { pct: pct, tone: "dark-red", toneKey: "critical", label: "Critical" };
    if (pct >= 70) return { pct: pct, tone: "orange", toneKey: "warning", label: "Near capacity" };
    return { pct: pct, tone: "green", toneKey: "available", label: "Normal" };
  };

  HSM.stats = {
    roomCounts: function () {
      var rooms = HSM.db ? HSM.db.rooms : [];
      var occupied = countBy(rooms, "occupied");
      return {
        total: rooms.length,
        occupied: occupied,
        available: countBy(rooms, "available"),
        cleaning: countBy(rooms, "cleaning"),
        reserved: countBy(rooms, "reserved"),
        maintenance: countBy(rooms, "maintenance"),
        unoccupied: rooms.length - occupied,
        occupancyPct: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0
      };
    },
    tableCounts: function () {
      var tables = HSM.db ? HSM.db.tables : [];
      var occupied = countBy(tables, "occupied");
      return {
        total: tables.length,
        occupied: occupied,
        available: countBy(tables, "available"),
        cleaning: countBy(tables, "cleaning"),
        service: countBy(tables, "service"),
        utilizationPct: tables.length ? Math.round((occupied / tables.length) * 100) : 0
      };
    },
    parkingCounts: function () {
      var spots = HSM.db ? HSM.db.parking : [];
      var occupied = countBy(spots, "occupied");
      var reserved = countBy(spots, "reserved");
      return {
        total: spots.length,
        occupied: occupied,
        available: countBy(spots, "available"),
        reserved: reserved,
        maintenance: countBy(spots, "maintenance"),
        utilizationPct: spots.length ? Math.round(((occupied + reserved) / spots.length) * 100) : 0,
        occupiedPct: spots.length ? Math.round((occupied / spots.length) * 100) : 0
      };
    },
    alertCounts: function () {
      var alerts = HSM.db ? HSM.db.alerts : [];
      return {
        total: alerts.length,
        open: alerts.filter(function (a) { return a.status === "open"; }).length,
        critical: alerts.filter(function (a) { return a.status === "open" && a.priority === "critical"; }).length,
        warning: alerts.filter(function (a) { return a.status === "open" && a.priority === "warning"; }).length,
        info: alerts.filter(function (a) { return a.status === "open" && a.priority === "info"; }).length,
        resolved: alerts.filter(function (a) { return a.status === "resolved"; }).length,
        unread: alerts.filter(function (a) { return a.status === "open" && a.unread; }).length
      };
    }
  };

  HSM.activityTone = function (type) {
    return {
      room: "blue", table: "orange", parking: "green", facility: "orange",
      camera: "blue", alert: "red", system: "grey"
    }[type] || "grey";
  };
})(window.HSM);
