/* ==========================================================================
   Space Monitoring System — dashboard overview
   ========================================================================== */

(function (HSM) {
  "use strict";

  var charts = {};

  function kpiData() {
    var rooms = HSM.stats.roomCounts();
    var tables = HSM.stats.tableCounts();
    var parking = HSM.stats.parkingCounts();
    var alerts = HSM.stats.alertCounts();
    return [
      {
        label: "Total Rooms", value: rooms.total, unit: "",
        desc: "6 floors · 5 room types", icon: "bi-door-open", tone: "blue", go: "rooms",
        trend: "Live", trendClass: "neutral", foot: "monitored spaces"
      },
      {
        label: "Occupied Rooms", value: rooms.occupied, unit: "",
        desc: rooms.occupancyPct + "% occupancy", icon: "bi-person-fill", tone: "red", go: "rooms",
        trend: "↑ 3%", trendClass: "", foot: "vs. sample average"
      },
      {
        label: "Available Rooms", value: rooms.unoccupied, unit: "",
        desc: rooms.available + " ready · " + (rooms.cleaning + rooms.reserved + rooms.maintenance) + " turnover",
        icon: "bi-check-circle-fill", tone: "green", go: "rooms",
        trend: "↓ 2%", trendClass: "down", foot: "vs. sample average"
      },
      {
        label: "Restaurant Tables", value: tables.total, unit: "",
        desc: tables.available + " available · " + tables.cleaning + " cleaning",
        icon: "bi-cup-hot", tone: "blue", go: "restaurant",
        trend: "Live", trendClass: "neutral", foot: "tables monitored"
      },
      {
        label: "Occupied Tables", value: tables.occupied, unit: "",
        desc: tables.utilizationPct + "% table utilization", icon: "bi-people-fill", tone: "orange", go: "restaurant",
        trend: "↑ 8%", trendClass: "", foot: "vs. sample average"
      },
      {
        label: "Available Parking", value: parking.available, unit: "/ " + parking.total,
        desc: parking.utilizationPct + "% occupied incl. reserved", icon: "bi-p-square", tone: "green", go: "parking",
        trend: "↓ 5%", trendClass: "down", foot: "vs. sample average"
      },
      {
        label: "Active Alerts", value: alerts.open, unit: "",
        desc: alerts.critical + " critical · " + alerts.warning + " warning", icon: "bi-bell-fill",
        tone: alerts.critical ? "dark-red" : alerts.warning ? "orange" : "green", go: "alerts",
        trend: alerts.open ? "Needs attention" : "Clear", trendClass: alerts.open ? "down" : "", foot: "simulated rules"
      }
    ];
  }

  function kpiMarkup() {
    return kpiData().map(function (k) {
      return '<button type="button" class="kpi-card accent-' + k.tone + '" data-go="' + k.go + '">' +
        '<div class="kpi-top"><div class="kpi-icon tone-' + k.tone + '"><i class="bi ' + k.icon + '"></i></div>' +
        '<span class="status-dot tone-' + k.tone + '"></span></div>' +
        '<div class="kpi-label">' + k.label + "</div>" +
        '<div class="kpi-value">' + k.value + (k.unit ? "<small>" + k.unit + "</small>" : "") + "</div>" +
        '<div class="kpi-desc">' + k.desc + "</div>" +
        '<div class="kpi-foot"><span class="trend ' + k.trendClass + '">' + k.trend + "</span><span>" + k.foot + "</span></div>" +
        "</button>";
    }).join("");
  }

  function facilityMarkup() {
    return HSM.db.facilities.map(function (f) {
      var status = HSM.facilityStatus(f);
      return '<button type="button" class="fo-card accent-' + status.tone + '" data-facility="' + f.id + '">' +
        '<div class="fo-top"><span class="fo-icon tone-' + status.tone + '"><i class="bi ' + f.icon + '"></i></span>' +
        HSM.statusBadge(status.toneKey) + "</div>" +
        '<div><div class="fo-name">' + f.name + "</div>" +
        '<div class="fo-pct">' + Math.round(status.pct) + '%<small> · ' + f.occupancy + "/" + f.capacity + "</small></div></div>" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + status.pct + '%"></div></div>' +
        '<div class="fo-meta"><span>Updated ' + HSM.util.timeAgo(f.lastUpdated) + "</span><span>" + f.location.split(" · ")[0] + "</span></div>" +
        "</button>";
    }).join("");
  }

  function activityMarkup() {
    var items = HSM.db.activities.slice(0, 9);
    if (!items.length) return '<div class="activity-empty">No simulated activity yet.</div>';
    return '<ul class="activity-list">' + items.map(function (a) {
      var tone = HSM.activityTone(a.type);
      return '<li class="activity-item">' +
        '<span class="activity-icon tone-' + tone + '"><i class="bi ' + a.icon + '"></i></span>' +
        '<span class="activity-copy"><strong>' + HSM.ui.esc(a.title) + "</strong><span>" + HSM.ui.esc(a.detail) + "</span></span>" +
        '<span class="activity-time">' + HSM.util.timeAgo(a.at) + "</span>" +
        "</li>";
    }).join("") + "</ul>";
  }

  /* -------------------------------- Charts -------------------------------- */

  var centerTextPlugin = {
    id: "hsmCenterText",
    afterDraw: function (chart) {
      var cfg = chart.options.plugins && chart.options.plugins.centerText;
      if (!cfg || !chart.chartArea) return;
      var ctx = chart.ctx;
      var area = chart.chartArea;
      var x = (area.left + area.right) / 2;
      var y = (area.top + area.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = cfg.color || "#172b4d";
      ctx.font = "800 26px Inter, sans-serif";
      ctx.fillText(cfg.value || "", x, y + 3);
      ctx.fillStyle = cfg.subColor || "#66758d";
      ctx.font = "600 9px Inter, sans-serif";
      ctx.fillText(cfg.label || "", x, y + 20);
      ctx.restore();
    }
  };

  function roomChartData() {
    var rooms = HSM.stats.roomCounts();
    return [rooms.occupied, rooms.available, rooms.cleaning, rooms.reserved, rooms.maintenance];
  }

  function zoneChartData() {
    var zones = ["Window side", "Main dining", "Terrace"];
    return zones.map(function (zone) {
      var tables = HSM.db.tables.filter(function (t) { return t.zone === zone; });
      var occupied = tables.filter(function (t) { return t.status === "occupied"; }).length;
      return tables.length ? Math.round((occupied / tables.length) * 100) : 0;
    });
  }

  function parkingChartData() {
    var hours = HSM.db.analytics.hours.filter(function (h) {
      var n = parseInt(h.hour, 10);
      return n >= 8 && n <= 19;
    });
    var values = hours.map(function (h) { return h.parking; });
    if (values.length) values[values.length - 1] = HSM.stats.parkingCounts().utilizationPct;
    return values;
  }

  function parkingLabels() {
    return HSM.db.analytics.hours.filter(function (h) {
      var n = parseInt(h.hour, 10);
      return n >= 8 && n <= 19;
    }).map(function (h) { return h.hour; });
  }

  function facilityChartData() {
    return HSM.db.facilities.map(function (f) {
      return Math.round(HSM.facilityStatus(f).pct);
    });
  }

  function facilityColors() {
    return HSM.db.facilities.map(function (f) {
      var t = HSM.charts.theme();
      var status = HSM.facilityStatus(f);
      return status.tone === "dark-red" ? t.darkRed : status.tone === "orange" ? t.orange : t.green;
    });
  }

  function buildCharts() {
    if (typeof window.Chart === "undefined") {
      document.querySelectorAll(".chart-wrap").forEach(function (wrap) {
        wrap.innerHTML = '<div class="chart-empty">Chart.js could not be loaded from the CDN.<br>Charts are unavailable in this offline session.</div>';
      });
      return;
    }
    var t = HSM.charts.theme();

    charts.occupancy = HSM.charts.create("chartOccupancy", {
      type: "doughnut",
      data: {
        labels: ["Occupied", "Available", "Cleaning", "Reserved", "Maintenance"],
        datasets: [{
          data: roomChartData(),
          backgroundColor: [t.red, t.green, t.orange, t.blue, t.grey],
          borderWidth: 0,
          hoverOffset: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: t.text, font: { size: 9 }, usePointStyle: true, boxWidth: 6, boxHeight: 6, padding: 10 }
          },
          centerText: {
            value: HSM.stats.roomCounts().occupancyPct + "%",
            label: "OCCUPIED",
            color: t.textStrong,
            subColor: t.text
          }
        }
      },
      plugins: [centerTextPlugin]
    });

    charts.restaurant = HSM.charts.create("chartRestaurant", {
      type: "bar",
      data: {
        labels: ["Window", "Main dining", "Terrace"],
        datasets: [{
          label: "Occupied tables",
          data: zoneChartData(),
          backgroundColor: [t.blue, t.navy, t.accent],
          borderRadius: 6,
          maxBarThickness: 46
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + "% of tables occupied"; } } }
        },
        scales: HSM.charts.axis({ max: 100, callback: function (v) { return v + "%"; } })
      }
    });

    charts.parking = HSM.charts.create("chartParking", {
      type: "line",
      data: {
        labels: parkingLabels(),
        datasets: [{
          label: "Parking utilization",
          data: parkingChartData(),
          borderColor: t.green,
          backgroundColor: "rgba(22, 163, 106, 0.1)",
          fill: true,
          tension: 0.38,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: t.green,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + "% utilized"; } } }
        },
        scales: HSM.charts.axis({ max: 100, callback: function (v) { return v + "%"; } })
      }
    });

    charts.facilities = HSM.charts.create("chartFacilities", {
      type: "bar",
      data: {
        labels: HSM.db.facilities.map(function (f) { return f.name; }),
        datasets: [{
          label: "Utilization",
          data: facilityChartData(),
          backgroundColor: facilityColors(),
          borderRadius: 5,
          maxBarThickness: 24
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.x + "% utilized"; } } }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: t.grid, drawBorder: false },
            border: { display: false },
            ticks: { color: t.text, font: { size: 9.5 }, callback: function (v) { return v + "%"; } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.text, font: { size: 9.5 } }
          }
        }
      }
    });
  }

  function updateCharts() {
    var t = HSM.charts.theme();
    if (charts.occupancy) {
      charts.occupancy.data.datasets[0].data = roomChartData();
      charts.occupancy.options.plugins.centerText.value = HSM.stats.roomCounts().occupancyPct + "%";
      charts.occupancy.update();
    }
    if (charts.restaurant) {
      charts.restaurant.data.datasets[0].data = zoneChartData();
      charts.restaurant.update();
    }
    if (charts.parking) {
      charts.parking.data.datasets[0].data = parkingChartData();
      charts.parking.update();
    }
    if (charts.facilities) {
      charts.facilities.data.labels = HSM.db.facilities.map(function (f) { return f.name; });
      charts.facilities.data.datasets[0].data = facilityChartData();
      charts.facilities.data.datasets[0].backgroundColor = facilityColors();
      charts.facilities.update();
    }
    /* Keep chart text colours aligned after a theme change. */
    Object.keys(charts).forEach(function (key) {
      if (charts[key] && charts[key].options.plugins && charts[key].options.plugins.legend) {
        charts[key].options.plugins.legend.labels.color = t.text;
      }
    });
  }

  /* -------------------------------- Template ------------------------------ */

  function template() {
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy">' +
          '<div class="eyebrow"><i class="bi bi-grid-1x2"></i> Operations overview</div>' +
          "<h1>Hotel dashboard</h1>" +
          "<p>A consolidated view of rooms, restaurant tables, parking and shared facilities at " +
            '<strong class="js-hotel-name">' + HSM.ui.esc(HSM.settings.hotelName) + "</strong>. " +
            '<span class="demo-inline">Simulated data</span></p>' +
        "</div>" +
        '<div class="page-actions">' +
          '<a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
          '<a class="btn btn-navy" href="#/cameras"><i class="bi bi-camera-video"></i> Live camera view</a>' +
        "</div>" +
      "</div>" +
      '<div class="kpi-grid reveal" id="kpiGrid">' + kpiMarkup() + "</div>" +
      '<div class="chart-grid reveal">' +
        '<div class="chart-card span-4">' +
          '<div class="panel-head"><div><h2 class="panel-title">Hotel occupancy</h2><p class="panel-sub">Current room status distribution</p></div>' +
          '<span class="demo-inline">Live demo</span></div>' +
          '<div class="chart-body"><div class="chart-wrap short"><canvas id="chartOccupancy" aria-label="Room occupancy doughnut chart" role="img"></canvas></div></div>' +
        "</div>" +
        '<div class="chart-card span-4">' +
          '<div class="panel-head"><div><h2 class="panel-title">Restaurant utilization</h2><p class="panel-sub">Occupied tables by floor-plan zone</p></div>' +
          '<span class="demo-inline">Live demo</span></div>' +
          '<div class="chart-body"><div class="chart-wrap short"><canvas id="chartRestaurant" aria-label="Restaurant utilization bar chart" role="img"></canvas></div></div>' +
        "</div>" +
        '<div class="chart-card span-4">' +
          '<div class="panel-head"><div><h2 class="panel-title">Parking utilization</h2><p class="panel-sub">Sample trend · last point is live</p></div>' +
          '<span class="demo-inline">Sample</span></div>' +
          '<div class="chart-body"><div class="chart-wrap short"><canvas id="chartParking" aria-label="Parking utilization line chart" role="img"></canvas></div></div>' +
        "</div>" +
        '<div class="chart-card span-7">' +
          '<div class="panel-head"><div><h2 class="panel-title">Facility usage</h2><p class="panel-sub">Current utilization across shared facilities</p></div>' +
          '<a class="btn btn-sm btn-outline-soft" href="#/facilities">View facilities <i class="bi bi-arrow-right"></i></a></div>' +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartFacilities" aria-label="Facility usage bar chart" role="img"></canvas></div></div>' +
        "</div>" +
        '<div class="chart-card span-5 activity-panel">' +
          '<div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="panel-sub">Generated by the simulation engine</p></div>' +
          '<span class="live-dot"></span></div>' +
          '<div id="activityFeed">' + activityMarkup() + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="panel reveal">' +
        '<div class="panel-head"><div><h2 class="panel-title">Facility overview</h2><p class="panel-sub">Capacity and utilization of monitored shared spaces</p></div>' +
        '<a class="btn btn-sm btn-outline-soft" href="#/facilities">Open monitoring <i class="bi bi-arrow-right"></i></a></div>' +
        '<div class="panel-pad" style="padding-top:0"><div class="facility-overview" id="facilityOverview">' + facilityMarkup() + "</div></div>" +
      "</div>";
  }

  function bind(root) {
    root.addEventListener("click", function (event) {
      var go = event.target.closest("[data-go]");
      if (go) {
        window.location.hash = "#/" + go.getAttribute("data-go");
        return;
      }
      var facility = event.target.closest("[data-facility]");
      if (facility) {
        HSM.pendingOpen = { type: "facility", id: facility.getAttribute("data-facility") };
        window.location.hash = "#/facilities";
      }
    });
  }

  HSM.registerPage("dashboard", {
    title: "Dashboard",
    render: function (root) {
      root.innerHTML = template();
      bind(root);
      buildCharts();
    },
    onData: function () {
      var kpi = document.getElementById("kpiGrid");
      var overview = document.getElementById("facilityOverview");
      var feed = document.getElementById("activityFeed");
      if (kpi) kpi.innerHTML = kpiMarkup();
      if (overview) overview.innerHTML = facilityMarkup();
      if (feed) feed.innerHTML = activityMarkup();
      updateCharts();
    },
    destroy: function () {
      Object.keys(charts).forEach(function (key) { charts[key] = null; });
      charts = {};
    }
  });
})(window.HSM);
