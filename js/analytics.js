/* ==========================================================================
   Space Monitoring System — analytics and sample reports
   Every dataset is synthetic. Charts never claim real-world research results.
   ========================================================================== */

(function (HSM) {
  "use strict";

  var filters = { range: 14, facility: "all", compare: "bar" };

  function days() {
    return HSM.db.analytics.days.slice(-filters.range);
  }

  function insightMarkup() {
    var d = days();
    var avgOcc = Math.round(d.reduce(function (s, day) { return s + day.occupied; }, 0) / d.length);
    var avgPark = Math.round(d.reduce(function (s, day) { return s + day.parking; }, 0) / d.length);
    var peak = HSM.db.analytics.hours.reduce(function (best, h) {
      return h.footfall > best.footfall ? h : best;
    }, HSM.db.analytics.hours[0]);
    var facilities = HSM.db.facilities.map(function (f) {
      return { id: f.id, name: f.name, pct: Math.round(HSM.facilityStatus(f).pct) };
    });
    if (filters.facility !== "all") {
      facilities = facilities.filter(function (f) { return f.id === filters.facility; });
    }
    var busiest = facilities.reduce(function (best, f) {
      return !best || f.pct > best.pct ? f : best;
    }, null);

    return [
      { value: avgOcc + "%", label: "Avg room occupancy", icon: "bi-calendar3", tone: "blue" },
      { value: peak.hour, label: "Peak usage hour", icon: "bi-clock-history", tone: "orange" },
      { value: busiest ? busiest.pct + "%" : "—", label: busiest ? busiest.name : "No facility", icon: "bi-building", tone: "green" },
      { value: avgPark + "%", label: "Avg parking usage", icon: "bi-p-square", tone: "yellow" }
    ].map(function (i) {
      return '<div class="insight-card accent-' + i.tone + '"><div class="insight-icon tone-' + i.tone + '"><i class="bi ' + i.icon + '"></i></div>' +
        '<div class="insight-copy"><strong>' + i.value + "</strong><span>" + i.label + "</span></div></div>";
    }).join("");
  }

  function updateInsights() {
    var grid = document.getElementById("insightGrid");
    if (grid) grid.innerHTML = insightMarkup();
  }

  function facilitySeries() {
    var facilities = HSM.db.facilities;
    if (filters.facility !== "all") {
      facilities = facilities.filter(function (f) { return f.id === filters.facility; });
    }
    return facilities.map(function (f) {
      var status = HSM.facilityStatus(f);
      return { name: f.name, pct: Math.round(status.pct), tone: status.tone };
    });
  }

  function buildFacilityChart(colors) {
    var series = facilitySeries();
    var labels = series.map(function (s) { return s.name; });
    var values = series.map(function (s) { return s.pct; });
    var bg = series.map(function (s) {
      return s.tone === "dark-red" ? colors.darkRed : s.tone === "orange" ? colors.orange : colors.green;
    });

    if (filters.compare === "doughnut") {
      return {
        type: "doughnut",
        data: { labels: labels, datasets: [{ data: values, backgroundColor: bg, borderWidth: 0, hoverOffset: 3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "64%",
          plugins: { legend: { position: "bottom", labels: { color: colors.text, font: { size: 9 } } } }
        }
      };
    }
    if (filters.compare === "radar") {
      return {
        type: "radar",
        data: {
          labels: labels,
          datasets: [{
            label: "Utilization", data: values, borderColor: colors.blue,
            backgroundColor: "rgba(47, 107, 255, 0.16)", pointBackgroundColor: colors.blue,
            borderWidth: 2, pointRadius: 2.5
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 100,
              grid: { color: colors.grid },
              angleLines: { color: colors.grid },
              pointLabels: { color: colors.text, font: { size: 9 } },
              ticks: { display: false }
            }
          }
        }
      };
    }
    return {
      type: "bar",
      data: { labels: labels, datasets: [{ label: "Utilization", data: values, backgroundColor: bg, borderRadius: 5, maxBarThickness: 24 }] },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.x + "% utilized"; } } }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: colors.grid, drawBorder: false },
            border: { display: false },
            ticks: { color: colors.text, font: { size: 9 }, callback: function (v) { return v + "%"; } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: colors.text, font: { size: 8.5 }, autoSkip: false }
          }
        }
      }
    };
  }

  function renderCharts() {
    var t = HSM.charts.theme();
    if (typeof window.Chart === "undefined") {
      document.querySelectorAll(".chart-wrap").forEach(function (wrap) {
        wrap.innerHTML = '<div class="chart-empty">Chart.js could not be loaded from the CDN.<br>Charts are unavailable in this offline session.</div>';
      });
      return;
    }

    var d = days();
    var labels = d.map(function (day) { return day.label; });
    var avg = Math.round(d.reduce(function (s, day) { return s + day.occupied; }, 0) / d.length);
    var hours = HSM.db.analytics.hours;
    var peakValue = Math.max.apply(null, hours.map(function (h) { return h.footfall; }));

    /* 1. Daily room occupancy */
    HSM.charts.create("chartDailyOccupancy", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Occupancy %", data: d.map(function (day) { return day.occupied; }),
            borderColor: t.blue, backgroundColor: "rgba(47, 107, 255, 0.1)", fill: true,
            tension: 0.35, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4
          },
          {
            label: "Sample average", data: d.map(function () { return avg; }),
            borderColor: t.grey, borderDash: [4, 4], borderWidth: 1.4, pointRadius: 0, fill: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", align: "end", labels: { color: t.text, font: { size: 9 } } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ": " + ctx.parsed.y + "%"; } } }
        },
        scales: HSM.charts.axis({ max: 100, callback: function (v) { return v + "%"; } })
      }
    });

    /* 2. Facility comparison (filterable and type-switchable) */
    HSM.charts.create("chartFacilityCompare", buildFacilityChart(t));

    /* 3. Weekly utilization */
    HSM.charts.create("chartWeekly", {
      type: "bar",
      data: {
        labels: HSM.db.analytics.weekly.map(function (w) { return w.day; }),
        datasets: [
          { label: "Rooms", data: HSM.db.analytics.weekly.map(function (w) { return w.rooms; }), backgroundColor: t.blue, borderRadius: 4, maxBarThickness: 18 },
          { label: "Restaurant", data: HSM.db.analytics.weekly.map(function (w) { return w.restaurant; }), backgroundColor: t.accent, borderRadius: 4, maxBarThickness: 18 },
          { label: "Parking", data: HSM.db.analytics.weekly.map(function (w) { return w.parking; }), backgroundColor: t.green, borderRadius: 4, maxBarThickness: 18 },
          { label: "Facilities", data: HSM.db.analytics.weekly.map(function (w) { return w.facilities; }), backgroundColor: t.orange, borderRadius: 4, maxBarThickness: 18 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", align: "end", labels: { color: t.text, font: { size: 9 } } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ": " + ctx.parsed.y + "%"; } } }
        },
        scales: HSM.charts.axis({ max: 100, callback: function (v) { return v + "%"; } })
      }
    });

    /* 4. Restaurant table usage */
    HSM.charts.create("chartTableUsage", {
      type: "bar",
      data: {
        labels: hours.map(function (h) { return h.hour; }),
        datasets: [{ label: "Table turns", data: hours.map(function (h) { return h.turns; }), backgroundColor: t.accent, borderRadius: 4, maxBarThickness: 18 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + " table turns (sample)"; } } }
        },
        scales: HSM.charts.axis({ xTicks: 9 })
      }
    });

    /* 5. Parking utilization */
    HSM.charts.create("chartParkingAnalytics", {
      type: "line",
      data: {
        labels: hours.map(function (h) { return h.hour; }),
        datasets: [{
          label: "Parking utilization", data: hours.map(function (h) { return h.parking; }),
          borderColor: t.green, backgroundColor: "rgba(22, 163, 106, 0.1)", fill: true,
          tension: 0.38, pointRadius: 2, borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + "% utilized"; } } }
        },
        scales: HSM.charts.axis({ max: 100, callback: function (v) { return v + "%"; }, xTicks: 9 })
      }
    });

    /* 6. Peak usage hours */
    HSM.charts.create("chartPeakHours", {
      type: "bar",
      data: {
        labels: hours.map(function (h) { return h.hour; }),
        datasets: [{
          label: "Guest footfall",
          data: hours.map(function (h) { return h.footfall; }),
          backgroundColor: hours.map(function (h) { return h.footfall === peakValue ? t.accent : "rgba(20, 43, 74, 0.62)"; }),
          borderRadius: 4,
          maxBarThickness: 18
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + " sample footfall"; } } }
        },
        scales: HSM.charts.axis({ xTicks: 9 })
      }
    });
  }

  function updateLive() {
    var t = HSM.charts.theme();
    var chart = HSM.charts.get("chartFacilityCompare");
    if (chart) {
      var series = facilitySeries();
      chart.data.labels = series.map(function (s) { return s.name; });
      if (chart.config.type === "doughnut") {
        chart.data.datasets[0].data = series.map(function (s) { return s.pct; });
        chart.data.datasets[0].backgroundColor = series.map(function (s) {
          return s.tone === "dark-red" ? t.darkRed : s.tone === "orange" ? t.orange : t.green;
        });
      } else if (chart.config.type === "radar") {
        chart.data.datasets[0].data = series.map(function (s) { return s.pct; });
      } else {
        chart.data.datasets[0].data = series.map(function (s) { return s.pct; });
        chart.data.datasets[0].backgroundColor = series.map(function (s) {
          return s.tone === "dark-red" ? t.darkRed : s.tone === "orange" ? t.orange : t.green;
        });
      }
      chart.update();
    }
    updateInsights();
  }

  /* -------------------------------- Exports ------------------------------- */

  function header(title) {
    return [
      "Space Monitoring System - Sample Analytics",
      "Hotel," + HSM.settings.hotelName,
      "Generated," + new Date().toISOString(),
      "Disclaimer,All values are simulated for a university research demonstration.",
      "",
      title
    ];
  }

  function section(which) {
    var lines = [];
    var d = days();
    var hours = HSM.db.analytics.hours;
    if (which === "daily") {
      lines = lines.concat(header("Daily Room Occupancy (last " + filters.range + " days)"));
      lines.push("Date,Occupied %,Available %,Restaurant %,Parking %,Guest footfall");
      d.forEach(function (day) {
        lines.push([day.date, day.occupied, day.available, day.restaurant, day.parking, day.footfall].map(HSM.ui.csvCell).join(","));
      });
    } else if (which === "weekly") {
      lines = lines.concat(header("Weekly Utilization (representative sample week)"));
      lines.push("Day,Rooms %,Restaurant %,Parking %,Facilities %");
      HSM.db.analytics.weekly.forEach(function (w) {
        lines.push([w.day, w.rooms, w.restaurant, w.parking, w.facilities].join(","));
      });
    } else if (which === "tables") {
      lines = lines.concat(header("Restaurant Table Usage (sample day)"));
      lines.push("Hour,Table turns");
      hours.forEach(function (h) { lines.push([h.hour, h.turns].join(",")); });
    } else if (which === "parking") {
      lines = lines.concat(header("Parking Utilization (sample day)"));
      lines.push("Hour,Utilization %");
      hours.forEach(function (h) { lines.push([h.hour, h.parking].join(",")); });
    } else if (which === "facilities") {
      lines = lines.concat(header("Facility Occupancy Comparison (current simulation)"));
      lines.push("Facility,Occupancy %,Occupancy,Capacity");
      HSM.db.facilities.forEach(function (f) {
        var status = HSM.facilityStatus(f);
        lines.push([f.name, Math.round(status.pct), f.occupancy, f.capacity].map(HSM.ui.csvCell).join(","));
      });
    } else if (which === "peak") {
      lines = lines.concat(header("Peak Usage Hours (sample day)"));
      lines.push("Hour,Guest footfall");
      hours.forEach(function (h) { lines.push([h.hour, h.footfall].join(",")); });
    }
    return lines.join("\n");
  }

  function download(which) {
    if (which === "all") {
      var sections = ["daily", "weekly", "tables", "parking", "facilities", "peak"]
        .map(function (key) { return section(key); });
      HSM.ui.downloadCSV("space-monitoring-sample-analytics.csv", sections.join("\n\n"));
    } else {
      var names = {
        daily: "daily-room-occupancy", weekly: "weekly-utilization", tables: "restaurant-table-usage",
        parking: "parking-utilization", facilities: "facility-comparison", peak: "peak-usage-hours"
      };
      HSM.ui.downloadCSV("space-monitoring-" + (names[which] || "sample") + ".csv", section(which));
    }
    HSM.ui.toast({ title: "CSV downloaded", message: "Synthetic sample data exported for the demo.", tone: "blue", icon: "bi-download" });
  }

  function template() {
    function chartHead(title, sub, exportKey) {
      return '<div class="panel-head"><div><h2 class="panel-title">' + title + '</h2><p class="panel-sub">' + sub + '</p></div>' +
        '<button type="button" class="chart-download" data-export="' + exportKey + '" title="Download this dataset as CSV" aria-label="Download ' + title + ' CSV"><i class="bi bi-download"></i></button></div>';
    }

    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-bar-chart-line"></i> Operations</div>' +
          "<h1>Analytics &amp; reports</h1><p>Representative sample datasets for occupancy, utilization and peak hours. Download any chart as CSV for your research notes. <span class=\"demo-inline\">Sample data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
        '<button type="button" class="btn btn-navy" id="downloadAllCsv"><i class="bi bi-download"></i> Download CSV</button></div>' +
      "</div>" +
      '<div class="analytics-toolbar reveal">' +
        '<span class="toolbar-label">Date range</span>' +
        '<select class="form-select" id="analyticsRange" aria-label="Date range"><option value="7"' + (filters.range === 7 ? " selected" : "") + ">Last 7 days</option>" +
          '<option value="14"' + (filters.range === 14 ? " selected" : "") + ">Last 14 days</option>" +
          '<option value="30"' + (filters.range === 30 ? " selected" : "") + ">Last 30 days</option></select>" +
        '<span class="toolbar-label">Facility</span>' +
        '<select class="form-select" id="analyticsFacility" aria-label="Facility filter"><option value="all">All facilities</option>' +
          HSM.db.facilities.map(function (f) {
            return '<option value="' + f.id + '"' + (filters.facility === f.id ? " selected" : "") + ">" + f.name + "</option>";
          }).join("") + "</select>" +
        '<span class="toolbar-label">Comparison</span>' +
        '<select class="form-select" id="analyticsType" aria-label="Comparison chart type"><option value="bar"' + (filters.compare === "bar" ? " selected" : "") + ">Bar</option>" +
          '<option value="radar"' + (filters.compare === "radar" ? " selected" : "") + ">Radar</option>" +
          '<option value="doughnut"' + (filters.compare === "doughnut" ? " selected" : "") + ">Doughnut</option></select>" +
        '<button type="button" class="filter-clear" id="analyticsReset" title="Reset filters" aria-label="Reset analytics filters"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        '<span class="toolbar-spacer"></span>' +
        '<span class="text-tiny text-muted-2"><i class="bi bi-info-circle"></i> All values are synthetic</span>' +
      "</div>" +
      '<div class="insight-grid reveal" id="insightGrid">' + insightMarkup() + "</div>" +
      '<div class="chart-grid reveal">' +
        '<div class="chart-card span-8">' + chartHead("Daily room occupancy", "Selected range · percentage of 120 rooms occupied", "daily") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartDailyOccupancy" aria-label="Daily room occupancy chart" role="img"></canvas></div></div></div>' +
        '<div class="chart-card span-4">' + chartHead("Facility comparison", "Current utilization · controls above", "facilities") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartFacilityCompare" aria-label="Facility comparison chart" role="img"></canvas></div></div></div>' +
        '<div class="chart-card span-6">' + chartHead("Weekly hotel utilization", "Representative sample week", "weekly") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartWeekly" aria-label="Weekly utilization chart" role="img"></canvas></div></div></div>' +
        '<div class="chart-card span-6">' + chartHead("Restaurant table usage", "Sample table turns by hour", "tables") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartTableUsage" aria-label="Restaurant table usage chart" role="img"></canvas></div></div></div>' +
        '<div class="chart-card span-6">' + chartHead("Parking utilization", "Sample 24-hour parking profile", "parking") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartParkingAnalytics" aria-label="Parking utilization analytics chart" role="img"></canvas></div></div></div>' +
        '<div class="chart-card span-6">' + chartHead("Peak usage hours", "Sample guest footfall · peak highlighted", "peak") +
          '<div class="chart-body"><div class="chart-wrap"><canvas id="chartPeakHours" aria-label="Peak usage hours chart" role="img"></canvas></div></div></div>' +
      "</div>" +
      '<div class="analytics-foot reveal"><i class="bi bi-shield-check"></i><span>Charts are illustrative and generated from hardcoded sample datasets. They do not represent real hotel performance or research findings.</span></div>';
  }

  function bind(root) {
    var range = document.getElementById("analyticsRange");
    var facility = document.getElementById("analyticsFacility");
    var type = document.getElementById("analyticsType");
    if (range) {
      range.addEventListener("change", function () {
        filters.range = Number(range.value);
        renderCharts();
        updateInsights();
      });
    }
    if (facility) {
      facility.addEventListener("change", function () {
        filters.facility = facility.value;
        renderCharts();
        updateInsights();
      });
    }
    if (type) {
      type.addEventListener("change", function () {
        filters.compare = type.value;
        renderCharts();
      });
    }
    var reset = document.getElementById("analyticsReset");
    if (reset) {
      reset.addEventListener("click", function () {
        filters = { range: 14, facility: "all", compare: "bar" };
        if (range) range.value = "14";
        if (facility) facility.value = "all";
        if (type) type.value = "bar";
        renderCharts();
        updateInsights();
      });
    }
    var all = document.getElementById("downloadAllCsv");
    if (all) all.addEventListener("click", function () { download("all"); });
    root.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-export]");
      if (btn) download(btn.getAttribute("data-export"));
    });
  }

  HSM.registerPage("analytics", {
    title: "Analytics & Reports",
    render: function (root) {
      filters = { range: 14, facility: "all", compare: "bar" };
      root.innerHTML = template();
      bind(root);
      renderCharts();
    },
    onData: function () { updateLive(); },
    destroy: function () { /* charts are destroyed by the router */ }
  });
})(window.HSM);
