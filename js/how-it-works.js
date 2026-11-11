/* ==========================================================================
   Space Monitoring System — How It Works
   An animated, clearly-labelled simulation of an overhead restaurant CCTV
   feed with anonymised tracking boxes and a fake operator workstation.
   ========================================================================== */

(function (HSM) {
  "use strict";

  var W = 1000;
  var H = 560;

  var TABLE_POS = [
    { id: "T01", x: 150, y: 165 }, { id: "T02", x: 300, y: 165 }, { id: "T03", x: 450, y: 165 },
    { id: "T04", x: 150, y: 305 }, { id: "T05", x: 300, y: 305 }, { id: "T06", x: 450, y: 305 },
    { id: "T07", x: 620, y: 165 }, { id: "T08", x: 760, y: 165 }, { id: "T09", x: 900, y: 165 },
    { id: "T10", x: 620, y: 295 }, { id: "T11", x: 760, y: 295 }, { id: "T12", x: 900, y: 295 },
    { id: "T13", x: 620, y: 425 }, { id: "T14", x: 760, y: 425 }, { id: "T15", x: 900, y: 425 },
    { id: "T16", x: 150, y: 455 }, { id: "T17", x: 300, y: 455 }, { id: "T18", x: 450, y: 455 }
  ];

  var COLORS = {
    floorTop: "#0b1f2e", floorBottom: "#071420", grid: "rgba(125, 180, 205, 0.055)",
    wall: "rgba(140, 190, 215, 0.16)", block: "rgba(19, 45, 63, 0.9)", blockRim: "rgba(90, 140, 165, 0.35)",
    table: "#183245", tableRim: "#2e5570", chair: "#23445a",
    guestBody: "#2d6470", guestHead: "#9fd3d8", plate: "rgba(215, 233, 240, 0.82)",
    waiterBody: "#30566f", waiterHead: "#d8e6ed", hat: "#e5a526", hatRim: "#c8890f",
    green: "rgba(74, 222, 170, 0.9)", gold: "rgba(255, 213, 92, 0.95)",
    scan: "rgba(74, 222, 170, 0.5)"
  };

  var canvas = null;
  var ctx = null;
  var raf = null;
  var lastTs = 0;
  var intervals = [];
  var mounted = false;

  var state = {
    playing: true,
    speed: 1,
    showTracking: true,
    showTrails: true,
    time: 0,
    tables: [],
    guests: [],
    waiters: [],
    scanStart: null,
    scanLogged: true,
    logs: [],
    feedOffset: 0,
    reduced: false
  };

  /* ------------------------------ Scene setup ----------------------------- */

  function buildGuests() {
    var guests = [];
    var counter = 1;
    state.tables.forEach(function (t) {
      if (!t.data || t.data.status !== "occupied") return;
      var count = Math.max(2, Math.min(4, t.data.guests || 2));
      for (var i = 0; i < count; i++) {
        var angle = -Math.PI / 2 + (i * Math.PI * 2) / count;
        guests.push({
          id: "G-" + (counter < 10 ? "0" + counter : counter),
          role: "guest",
          tableId: t.id,
          tableX: t.x,
          tableY: t.y,
          angle: angle,
          x: t.x + Math.cos(angle) * 39,
          y: t.y + Math.sin(angle) * 39,
          phase: (counter * 1.37) % (Math.PI * 2),
          conf: 0.86 + ((counter * 7) % 12) / 100
        });
        counter++;
      }
    });
    return guests;
  }

  function initScene() {
    state.tables = TABLE_POS.map(function (pos) {
      return { id: pos.id, x: pos.x, y: pos.y, data: HSM.store.getTable(pos.id) };
    });
    state.guests = buildGuests();
    if (!state.waiters.length) {
      state.waiters = [
        {
          id: "W-01", role: "waiter", x: 535, y: 110,
          path: [[535, 110], [535, 500], [965, 500], [965, 110]], wp: 1,
          speed: 42, dwell: 0, trail: [], phase: 0.4, conf: 0.96
        },
        {
          id: "W-02", role: "waiter", x: 90, y: 385,
          path: [[90, 385], [505, 385], [505, 105], [90, 105]], wp: 1,
          speed: 37, dwell: 0, trail: [], phase: 1.8, conf: 0.94
        },
        {
          id: "W-03", role: "waiter", x: 566, y: 360,
          path: [[566, 370], [690, 370], [690, 105], [566, 105]], wp: 1,
          speed: 40, dwell: 0, trail: [], phase: 3.1, conf: 0.95
        }
      ];
    }
  }

  function syncScene() {
    if (!mounted) return;
    state.tables.forEach(function (t) { t.data = HSM.store.getTable(t.id); });
    state.guests = buildGuests();
    updateHud();
    updateMonitorStats();
    renderFeed(true);
    var occupied = state.tables.filter(function (t) { return t.data && t.data.status === "occupied"; }).length;
    addLog("Table state sync · " + occupied + " tables occupied (simulated)", "ok");
  }

  /* ------------------------------- Animation ------------------------------ */

  function updateWaiters(dt) {
    state.waiters.forEach(function (w) {
      if (w.dwell > 0) {
        w.dwell -= dt;
        return;
      }
      var target = w.path[w.wp];
      var dx = target[0] - w.x;
      var dy = target[1] - w.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) {
        w.wp = (w.wp + 1) % w.path.length;
        w.dwell = 0.7 + Math.random() * 1.2;
        return;
      }
      var step = Math.min(dist, w.speed * dt);
      w.x += (dx / dist) * step;
      w.y += (dy / dist) * step;
      w.angle = Math.atan2(dy, dx);
      if (Math.random() < dt * 5) {
        w.trail.push({ x: w.x, y: w.y });
        if (w.trail.length > 18) w.trail.shift();
      }
    });
  }

  function loop(ts) {
    if (!state.playing) { raf = null; return; }
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000) * state.speed;
    lastTs = ts;
    state.time += dt;
    updateWaiters(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!mounted || raf) return;
    lastTs = 0;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  /* -------------------------------- Drawing ------------------------------- */

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFloor() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, COLORS.floorTop);
    grad.addColorStop(1, COLORS.floorBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    /* Kitchen block */
    ctx.fillStyle = COLORS.block;
    ctx.strokeStyle = COLORS.blockRim;
    ctx.lineWidth = 1;
    roundRect(38, 26, 250, 62, 7);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(170, 215, 235, 0.5)";
    ctx.font = "700 8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KITCHEN · SERVICE PASS", 163, 61);

    /* Bar block */
    roundRect(700, 26, 252, 62, 7);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(170, 215, 235, 0.5)";
    ctx.fillText("BAR · LOUNGE", 826, 61);

    /* Entrance */
    ctx.fillStyle = "rgba(170, 215, 235, 0.35)";
    ctx.font = "700 8px Inter, sans-serif";
    ctx.fillText("ENTRANCE", 500, 540);
    ctx.strokeStyle = "rgba(229, 165, 38, 0.5)";
    ctx.beginPath();
    ctx.moveTo(500, 520);
    ctx.lineTo(500, 500);
    ctx.moveTo(493, 508);
    ctx.lineTo(500, 499);
    ctx.lineTo(507, 508);
    ctx.stroke();

    /* Plants */
    [[62, 500], [940, 500], [62, 120], [940, 120]].forEach(function (p) {
      ctx.fillStyle = "rgba(35, 86, 80, 0.8)";
      ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(60, 120, 110, 0.7)";
      ctx.beginPath(); ctx.arc(p[0] - 3, p[1] - 3, 6, 0, Math.PI * 2); ctx.fill();
    });
  }

  function tableRing(status) {
    if (status === "occupied") return "rgba(227, 75, 75, 0.65)";
    if (status === "cleaning") return "rgba(242, 163, 58, 0.7)";
    if (status === "service") return "rgba(229, 165, 38, 0.8)";
    return "rgba(22, 163, 106, 0.55)";
  }

  function drawTable(t) {
    var status = t.data ? t.data.status : "available";

    /* Chairs */
    for (var i = 0; i < 4; i++) {
      var angle = -Math.PI / 2 + (i * Math.PI) / 2;
      var cx = t.x + Math.cos(angle) * 35;
      var cy = t.y + Math.sin(angle) * 35;
      ctx.fillStyle = COLORS.chair;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Table */
    ctx.fillStyle = COLORS.table;
    ctx.strokeStyle = COLORS.tableRim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(t.x, t.y, 20, 0, Math.PI * 2);
    ctx.stroke();

    /* Status ring */
    ctx.strokeStyle = tableRing(status);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 31, 0, Math.PI * 2);
    ctx.stroke();

    /* Plates for occupied tables */
    if (status === "occupied") {
      var guests = state.guests.filter(function (g) { return g.tableId === t.id; });
      guests.forEach(function (g) {
        var px = t.x + Math.cos(g.angle) * 16;
        var py = t.y + Math.sin(g.angle) * 16;
        ctx.fillStyle = COLORS.plate;
        ctx.beginPath();
        ctx.arc(px, py, 4.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(30, 60, 75, 0.6)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    }

    ctx.fillStyle = "rgba(200, 226, 238, 0.38)";
    ctx.font = "700 7.5px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.id, t.x, t.y);
  }

  function drawGuest(g) {
    var bob = Math.sin(state.time * 2.1 + g.phase) * 1.1;
    var x = g.x;
    var y = g.y + bob;

    /* Chair hint behind the guest */
    ctx.fillStyle = COLORS.chair;
    ctx.beginPath();
    ctx.arc(x, y, 9.5, 0, Math.PI * 2);
    ctx.fill();

    /* Shoulders */
    ctx.fillStyle = COLORS.guestBody;
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 7.6, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Head */
    ctx.fillStyle = COLORS.guestHead;
    ctx.beginPath();
    ctx.arc(x, y - 1.5, 5, 0, Math.PI * 2);
    ctx.fill();

    /* Eating arm */
    var px = g.tableX + Math.cos(g.angle) * 16;
    var py = g.tableY + Math.sin(g.angle) * 16;
    var eat = (Math.sin(state.time * 3.2 + g.phase) + 1) / 2;
    var hx = x + (px - x) * (0.25 + eat * 0.45);
    var hy = y + (py - y) * (0.25 + eat * 0.45);
    ctx.strokeStyle = "rgba(190, 226, 232, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    /* Plate already drawn on the table */
  }

  function drawTrails() {
    state.waiters.forEach(function (w) {
      if (w.trail.length < 2) return;
      ctx.strokeStyle = "rgba(229, 165, 38, 0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w.trail[0].x, w.trail[0].y);
      for (var i = 1; i < w.trail.length; i++) ctx.lineTo(w.trail[i].x, w.trail[i].y);
      ctx.stroke();
    });
  }

  function drawWaiter(w) {
    var bob = Math.sin(state.time * 9 + w.phase) * 0.9;

    /* Legs / movement hint */
    ctx.strokeStyle = "rgba(190, 215, 230, 0.5)";
    ctx.lineWidth = 2;
    var stride = Math.sin(state.time * 9 + w.phase) * 4;
    ctx.beginPath();
    ctx.moveTo(w.x - 3, w.y + 8);
    ctx.lineTo(w.x - 3 + stride, w.y + 14);
    ctx.moveTo(w.x + 3, w.y + 8);
    ctx.lineTo(w.x + 3 - stride, w.y + 14);
    ctx.stroke();

    /* Tray */
    ctx.fillStyle = "#dbe7ee";
    ctx.strokeStyle = "rgba(20, 43, 74, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(w.x + 13, w.y + 5, 7, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 213, 92, 0.9)";
    ctx.beginPath();
    ctx.arc(w.x + 13, w.y + 4, 2, 0, Math.PI * 2);
    ctx.fill();

    /* Body */
    ctx.fillStyle = COLORS.waiterBody;
    ctx.beginPath();
    ctx.ellipse(w.x, w.y + bob, 8.5, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Head */
    ctx.fillStyle = COLORS.waiterHead;
    ctx.beginPath();
    ctx.arc(w.x, w.y - 3, 5.2, 0, Math.PI * 2);
    ctx.fill();

    /* Yellow cap — deliberately prominent */
    ctx.fillStyle = COLORS.hat;
    ctx.beginPath();
    ctx.arc(w.x, w.y - 5, 6.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.hatRim;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(w.x - 7.5, w.y - 4.5);
    ctx.lineTo(w.x + 7.5, w.y - 4.5);
    ctx.stroke();

    /* Small cap peak */
    ctx.fillStyle = COLORS.hatRim;
    ctx.beginPath();
    ctx.ellipse(w.x + 4, w.y - 3.5, 4, 1.7, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrackBox(actor, waiter) {
    var x = actor.x;
    var y = actor.y;
    var boxW = 26;
    var boxH = 30;
    var top = y - 15;
    var left = x - 13;
    var color = waiter ? COLORS.gold : COLORS.green;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    var c = 7;
    /* Four corner brackets */
    ctx.beginPath();
    ctx.moveTo(left, top + c); ctx.lineTo(left, top); ctx.lineTo(left + c, top);
    ctx.moveTo(left + boxW - c, top); ctx.lineTo(left + boxW, top); ctx.lineTo(left + boxW, top + c);
    ctx.moveTo(left, top + boxH - c); ctx.lineTo(left, top + boxH); ctx.lineTo(left + c, top + boxH);
    ctx.moveTo(left + boxW - c, top + boxH); ctx.lineTo(left + boxW, top + boxH); ctx.lineTo(left + boxW, top + boxH - c);
    ctx.stroke();

    var label = actor.id + "  " + actor.conf.toFixed(2);
    ctx.font = "700 7.5px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(3, 13, 20, 0.84)";
    roundRect(left - 1, top - 12, tw + 8, 10, 2);
    ctx.fill();
    ctx.fillStyle = waiter ? "#ffd55c" : "#4adeaa";
    ctx.fillText(label, left + 3, top - 7);
  }

  function drawTracking() {
    var tracked = state.guests.filter(function (g, i) { return i % 4 === 0; }).slice(0, 9);
    tracked.forEach(function (g) { drawTrackBox(g, false); });
    state.waiters.forEach(function (w) { drawTrackBox(w, true); });
  }

  function drawScan() {
    if (state.scanStart == null) return;
    var p = (state.time - state.scanStart) / 2.4;
    if (p < 0 || p > 1) {
      if (p > 1 && !state.scanLogged) {
        state.scanLogged = true;
        state.scanStart = null;
        var banner = document.getElementById("scanBanner");
        if (banner) banner.classList.add("d-none");
        addLog("Scan cycle complete · " + (state.guests.length + state.waiters.length) + " figures tracked", "ok");
      }
      return;
    }
    var radius = 20 + p * 700;
    ctx.strokeStyle = "rgba(74, 222, 170, " + (0.55 * (1 - p)) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(74, 222, 170, " + (0.14 * (1 - p)) + ")";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(1, radius - 8), 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawFloor();
    state.tables.forEach(drawTable);
    state.guests.forEach(drawGuest);
    if (state.showTrails) drawTrails();
    state.waiters.forEach(drawWaiter);
    if (state.showTracking) drawTracking();
    drawScan();
  }

  /* --------------------------- Monitor / HUD data ------------------------- */

  function occupiedTables() {
    return state.tables.filter(function (t) { return t.data && t.data.status === "occupied"; }).length;
  }

  function averageConfidence() {
    var actors = state.guests.concat(state.waiters);
    if (!actors.length) return 0;
    return actors.reduce(function (s, a) { return s + a.conf; }, 0) / actors.length;
  }

  function clockText() {
    var now = new Date();
    return now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + "  " +
      now.toLocaleTimeString("en-GB", { hour12: false });
  }

  function updateHud() {
    var el = document.getElementById("cctvCounts");
    if (el) el.textContent = state.guests.length + " people · " + state.waiters.length + " waiters · " + occupiedTables() + " tables occupied";
    var clock = document.getElementById("cctvClock");
    if (clock) clock.textContent = clockText();
  }

  function updateMonitorStats() {
    var people = state.guests.length + state.waiters.length;
    function set(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    }
    set("monPeople", people);
    set("monWaiters", state.waiters.length);
    set("monTables", occupiedTables() + " / 18");
    set("monConf", (averageConfidence() * 100).toFixed(1) + "%");
    set("feedCount", Math.min(5, state.guests.length + state.waiters.length));
    var latency = 26 + Math.floor(Math.random() * 5);
    var gpu = 36 + Math.floor(Math.random() * 12);
    set("telLatency", latency + " ms");
    set("telGpu", gpu + "%");
  }

  function renderFeed(force) {
    var feed = document.getElementById("trackFeed");
    if (!feed) return;
    var actors = state.guests.slice(0, 10).concat(state.waiters);
    if (!actors.length) {
      feed.innerHTML = '<div class="track-empty">No figures in frame</div>';
      return;
    }
    if (force) state.feedOffset = 0;
    var start = state.feedOffset % actors.length;
    var rows = [];
    for (var i = 0; i < Math.min(5, actors.length); i++) {
      rows.push(actors[(start + i) % actors.length]);
    }
    feed.innerHTML = rows.map(function (a) {
      var waiter = a.role === "waiter";
      return '<div class="track-row' + (waiter ? " waiter" : "") + '">' +
        '<span class="track-id">' + a.id + "</span>" +
        '<span class="track-bar"><i style="width:' + (a.conf * 100).toFixed(0) + '%"></i></span>' +
        '<span class="track-conf">' + a.conf.toFixed(2) + "</span></div>";
    }).join("");
    state.feedOffset++;
  }

  function renderLogs() {
    var log = document.getElementById("consoleLog");
    if (!log) return;
    log.innerHTML = state.logs.map(function (entry) {
      return '<div class="log-row ' + (entry.tone || "") + '"><span class="log-time">' + entry.time + "</span><span>" + entry.text + "</span></div>";
    }).join("");
  }

  function addLog(text, tone) {
    var now = new Date();
    state.logs.unshift({
      text: text,
      tone: tone || "",
      time: now.toLocaleTimeString("en-GB", { hour12: false })
    });
    if (state.logs.length > 7) state.logs.length = 7;
    renderLogs();
  }

  function randomLog() {
    var pick = Math.floor(Math.random() * 6);
    var guest = state.guests[Math.floor(Math.random() * state.guests.length)];
    var waiter = state.waiters[Math.floor(Math.random() * state.waiters.length)];
    var table = TABLE_POS[Math.floor(Math.random() * TABLE_POS.length)];
    if (pick === 0 && guest) {
      addLog(guest.id + " tracked · confidence " + guest.conf.toFixed(2), "ok");
    } else if (pick === 1 && waiter) {
      addLog("Waiter " + waiter.id + " routed through main aisle", "");
    } else if (pick === 2) {
      addLog("Table " + table.id + " dwell " + (20 + Math.floor(Math.random() * 90)) + "s · demo", "");
    } else if (pick === 3) {
      addLog("Service pass queue: " + (1 + Math.floor(Math.random() * 4)) + " trays", "");
    } else if (pick === 4) {
      addLog("Table " + table.id + " waiting 11m · simulated warning", "warn");
    } else {
      addLog("Scan confidence " + (92 + Math.floor(Math.random() * 7)) + "." + Math.floor(Math.random() * 9) + "%", "ok");
    }
    updateMonitorStats();
  }

  /* --------------------------------- UI ----------------------------------- */

  function updatePlayButton() {
    var btn = document.getElementById("cctvPlay");
    if (!btn) return;
    btn.innerHTML = state.playing
      ? '<i class="bi bi-pause-fill"></i> Pause'
      : '<i class="bi bi-play-fill"></i> Play';
    btn.classList.toggle("is-active", state.playing);
  }

  function triggerScan() {
    state.scanStart = state.time;
    state.scanLogged = false;
    var banner = document.getElementById("scanBanner");
    if (banner) {
      banner.classList.remove("d-none");
      setTimeout(function () { banner.classList.add("d-none"); }, 2000);
    }
    addLog("Manual scan triggered · sweeping restaurant floor", "ok");
    if (!state.playing) {
      state.scanStart = state.time - 0.9;
      draw();
      setTimeout(function () {
        state.scanStart = null;
        draw();
      }, 800);
    }
  }

  function bindControls(root) {
    var play = document.getElementById("cctvPlay");
    if (play) {
      play.addEventListener("click", function () {
        state.playing = !state.playing;
        if (state.playing) startLoop();
        else { stopLoop(); draw(); }
        updatePlayButton();
      });
    }

    var speed = document.getElementById("cctvSpeed");
    if (speed) {
      speed.addEventListener("click", function () {
        state.speed = state.speed === 1 ? 2 : 1;
        speed.textContent = state.speed + "×";
        speed.classList.toggle("is-active", state.speed === 2);
        addLog("Playback speed set to " + state.speed + "×", "");
      });
    }

    var tracking = document.getElementById("cctvTracking");
    if (tracking) {
      tracking.addEventListener("click", function () {
        state.showTracking = !state.showTracking;
        tracking.classList.toggle("is-active", state.showTracking);
        addLog(state.showTracking ? "Tracking overlay enabled" : "Tracking overlay hidden", "");
        if (!state.playing) draw();
      });
    }

    var trails = document.getElementById("cctvTrails");
    if (trails) {
      trails.addEventListener("click", function () {
        state.showTrails = !state.showTrails;
        trails.classList.toggle("is-active", state.showTrails);
        if (!state.playing) draw();
      });
    }

    var scan = document.getElementById("cctvScan");
    if (scan) scan.addEventListener("click", triggerScan);

    var link = document.getElementById("cctvRestaurantLink");
    if (link) link.addEventListener("click", function () { /* anchor handles navigation */ });
  }

  function template() {
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-diagram-3"></i> Explainable monitoring</div>' +
          "<h1>How it works</h1><p>An animated, deliberately simulated overhead camera feed shows how anonymised figures could be detected, tracked and converted into space-status data. " +
          '<span class="demo-inline">Not real computer vision</span></p></div>' +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/cameras"><i class="bi bi-camera-video"></i> Camera page</a>' +
        '<a class="btn btn-navy" href="#/restaurant"><i class="bi bi-cup-hot"></i> Restaurant data</a></div>' +
      "</div>" +

      '<div class="howit-layout">' +
        '<section class="panel cctv-panel reveal">' +
          '<div class="cctv-frame">' +
            '<div class="cctv-screen">' +
              '<canvas id="cctvCanvas" width="1000" height="560" aria-label="Animated simulated overhead restaurant camera feed"></canvas>' +
              '<div class="cctv-tint"></div><div class="cctv-scanlines"></div><div class="cctv-vignette"></div><div class="cctv-grain"></div>' +
              '<div class="cctv-hud hud-top"><span class="hud-cam"><i class="bi bi-camera-video"></i> CAM-05 · RESTAURANT OVERHEAD</span>' +
                '<span class="hud-right"><span class="hud-rec">REC</span><span class="hud-demo">DEMO · SIMULATED</span></span></div>' +
              '<div class="scan-banner d-none" id="scanBanner"><i class="bi bi-radar"></i> SCANNING…</div>' +
              '<div class="cctv-hud hud-bottom"><span id="cctvCounts">—</span><span id="cctvClock">—</span></div>' +
            "</div>" +
            '<div class="cctv-controls">' +
              '<button type="button" class="ctr-btn is-active" id="cctvPlay"><i class="bi bi-pause-fill"></i> Pause</button>' +
              '<button type="button" class="ctr-btn" id="cctvSpeed" title="Toggle playback speed">1×</button>' +
              '<button type="button" class="ctr-btn is-active" id="cctvTracking"><i class="bi bi-bounding-box"></i> Tracking</button>' +
              '<button type="button" class="ctr-btn is-active" id="cctvTrails"><i class="bi bi-bezier2"></i> Trails</button>' +
              '<button type="button" class="ctr-btn ctr-accent" id="cctvScan"><i class="bi bi-radar"></i> Scan now</button>' +
              '<span class="cctv-control-spacer"></span>' +
              '<a class="cctv-link" href="#/restaurant" id="cctvRestaurantLink">Restaurant monitoring <i class="bi bi-arrow-right"></i></a>' +
            "</div>" +
            '<div class="cctv-caption"><i class="bi bi-info-circle"></i> Canvas animation with anonymised silhouettes. Waiters wear <span class="cap-hat">yellow caps</span>; green and gold boxes are tracking overlays. No real footage is used.</div>' +
          "</div>" +
        "</section>" +

        '<aside class="monitor-panel reveal">' +
          '<div class="monitor">' +
            '<div class="monitor-screen">' +
              '<div class="screen-scan"></div>' +
              '<div class="console-head"><span class="console-dots"><i></i><i></i><i></i></span>' +
                '<span class="console-title">SpaceVision · Demo Console</span><span class="console-demo">SIMULATED</span></div>' +
              '<div class="console-stats">' +
                '<div class="console-stat"><span>People</span><strong id="monPeople">0</strong><small>in frame</small></div>' +
                '<div class="console-stat"><span>Waiters</span><strong id="monWaiters">0</strong><small>yellow caps</small></div>' +
                '<div class="console-stat"><span>Tables</span><strong id="monTables">0 / 18</strong><small>occupied</small></div>' +
                '<div class="console-stat"><span>Confidence</span><strong id="monConf">0%</strong><small>average</small></div>' +
              "</div>" +
              '<div class="console-section-title">Tracking feed <span>· <span id="feedCount">0</span> active</span></div>' +
              '<div class="track-feed" id="trackFeed"></div>' +
              '<div class="console-side">' +
                '<div class="console-radar"><span class="radar-sweep"></span><span class="radar-ring"></span>' +
                  '<span class="radar-blip b1"></span><span class="radar-blip b2"></span><span class="radar-blip b3"></span>' +
                  '<span class="radar-label">SCANNING</span></div>' +
                '<div class="telemetry">' +
                  '<div class="telemetry-row"><span>FPS</span><b>24</b></div>' +
                  '<div class="telemetry-row"><span>Inference</span><b id="telLatency">28 ms</b></div>' +
                  '<div class="telemetry-row"><span>GPU load</span><b id="telGpu">42%</b></div>' +
                  '<div class="telemetry-row"><span>Model</span><b>DEMO-v1</b></div>' +
                  '<div class="telemetry-note">Fake telemetry</div>' +
                "</div>" +
              "</div>" +
              '<div class="console-section-title">Detection log</div>' +
              '<div class="console-log" id="consoleLog"></div>' +
            "</div>" +
            '<div class="monitor-stand"></div>' +
            '<div class="monitor-brand">OPERATOR WORKSTATION · SIMULATED DATA</div>' +
          "</div>" +
        "</aside>" +
      "</div>" +

      '<div class="pipeline-grid reveal">' +
        '<div class="pipeline-card"><span class="pipeline-step">1</span><div class="pipeline-icon tone-blue"><i class="bi bi-camera-video"></i></div>' +
          "<h3>Capture</h3><p>Cameras and sensors report how a space is being used. In this prototype, the feed is drawn on a canvas.</p>" +
          '<span class="pipeline-tag">Simulated step</span></div>' +
        '<div class="pipeline-card"><span class="pipeline-step">2</span><div class="pipeline-icon tone-green"><i class="bi bi-bounding-box-circles"></i></div>' +
          "<h3>Detect &amp; track</h3><p>Anonymised figures receive temporary tracking IDs and confidence scores. No faces are identified or stored.</p>" +
          '<span class="pipeline-tag">Simulated step</span></div>' +
        '<div class="pipeline-card"><span class="pipeline-step">3</span><div class="pipeline-icon tone-orange"><i class="bi bi-bar-chart-line"></i></div>' +
          "<h3>Analyse</h3><p>Occupancy, dwell time and waiting thresholds update the shared dashboard and trigger demo alerts.</p>" +
          '<span class="pipeline-tag">Rule engine</span></div>' +
        '<div class="pipeline-card"><span class="pipeline-step">4</span><div class="pipeline-icon tone-yellow"><i class="bi bi-bell"></i></div>' +
          "<h3>Act</h3><p>Staff see capacity warnings and waiting alerts, then update the simulated space status.</p>" +
          '<span class="pipeline-tag">Operator</span></div>' +
      "</div>" +

      '<div class="panel ethics-note reveal"><div class="ethics-icon"><i class="bi bi-shield-check"></i></div>' +
        '<div><h3>Privacy and limitations</h3><p>This page is an explainer, not a working vision system. There is no CCTV connection, no computer vision library, no facial recognition and no personal data collection. ' +
        "The people are abstract moving shapes, tracking IDs are invented, and the monitor is a simulated workstation. " +
        "The camera page uses stock photography; this page uses a canvas animation. Both are clearly labelled <strong>DEMO / SIMULATED</strong>.</p></div></div>";
  }

  function visibilityHandler() {
    if (document.hidden) stopLoop();
    else if (state.playing) startLoop();
  }

  HSM.registerPage("how-it-works", {
    title: "How It Works",
    render: function (root) {
      root.innerHTML = template();
      mounted = true;
      state.playing = true;
      state.speed = 1;
      state.showTracking = true;
      state.showTrails = true;
      state.time = 0;
      state.logs = [];
      state.waiters = [];
      state.scanStart = null;
      state.feedOffset = 0;
      state.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (state.reduced) state.playing = false;

      canvas = document.getElementById("cctvCanvas");
      ctx = canvas ? canvas.getContext("2d") : null;
      initScene();
      bindControls(root);
      updateHud();
      updateMonitorStats();
      updatePlayButton();
      renderFeed(true);
      addLog("CAM-05 demo feed initialised · no real signal", "ok");
      addLog("Tracking overlay active · anonymised shapes only", "");
      addLog("Yellow caps identify simulated waiters", "");
      draw();
      if (state.playing) startLoop();

      intervals.push(setInterval(function () { updateHud(); }, 1000));
      intervals.push(setInterval(function () { renderFeed(false); }, 1600));
      intervals.push(setInterval(function () { randomLog(); }, 2700));
      document.addEventListener("visibilitychange", visibilityHandler);
    },
    onData: function (areas) {
      if (!areas || !areas.length || areas.indexOf("restaurant") !== -1 || areas.indexOf("dashboard") !== -1) {
        syncScene();
      }
    },
    destroy: function () {
      mounted = false;
      stopLoop();
      intervals.forEach(clearInterval);
      intervals = [];
      document.removeEventListener("visibilitychange", visibilityHandler);
      canvas = null;
      ctx = null;
    }
  });
})(window.HSM);
