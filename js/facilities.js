/* ==========================================================================
   Space Monitoring System — shared facility monitoring
   ========================================================================== */

(function (HSM) {
  "use strict";

  function summary() {
    var totals = HSM.db.facilities.reduce(function (acc, f) {
      acc.capacity += f.capacity;
      acc.occupancy += f.occupancy;
      if (HSM.facilityStatus(f).toneKey === "warning" || HSM.facilityStatus(f).toneKey === "critical") acc.near++;
      return acc;
    }, { capacity: 0, occupancy: 0, near: 0 });
    totals.pct = totals.capacity ? Math.round((totals.occupancy / totals.capacity) * 100) : 0;
    return totals;
  }

  function statsMarkup() {
    var s = summary();
    var items = [
      { label: "Facilities monitored", value: HSM.db.facilities.length, icon: "bi-building", tone: "blue" },
      { label: "Combined capacity", value: s.capacity, icon: "bi-people", tone: "navy" },
      { label: "Guests in facilities", value: s.occupancy, icon: "bi-person-check-fill", tone: "green" },
      { label: "Near capacity", value: s.near, icon: "bi-exclamation-triangle-fill", tone: s.near ? "orange" : "green" }
    ];
    return items.map(function (i) {
      return '<div class="page-stat accent-' + i.tone + '"><div class="ps-icon tone-' + i.tone + '"><i class="bi ' + i.icon + '"></i></div>' +
        '<div class="ps-copy"><strong>' + i.value + "</strong><span>" + i.label + "</span></div></div>";
    }).join("");
  }

  function cardMarkup(facility) {
    var status = HSM.facilityStatus(facility);
    return '<button type="button" class="facility-card accent-' + status.tone + '" data-facility="' + facility.id + '">' +
      '<div class="facility-top">' +
        '<div class="d-flex align-items-center gap-2">' +
          '<span class="facility-icon"><i class="bi ' + facility.icon + '"></i></span>' +
          '<span><span class="facility-title" style="display:block">' + facility.name + '</span>' +
          '<span class="facility-sub">' + facility.location + "</span></span>" +
        "</div>" +
        HSM.statusBadge(status.toneKey) +
      "</div>" +
      '<div class="facility-numbers"><div class="big">' + facility.occupancy +
        '<small> / ' + facility.capacity + "</small></div>" +
        '<span class="pct">' + Math.round(status.pct) + "% utilized</span></div>" +
      '<div class="progress-track"><div class="progress-fill" style="width:' + status.pct + '%"></div></div>' +
      '<div class="facility-meta"><span><i class="bi bi-clock"></i> Updated ' + HSM.util.timeAgo(facility.lastUpdated) + "</span>" +
        '<span>View details <i class="bi bi-arrow-right"></i></span></div>' +
      "</button>";
  }

  function refresh() {
    HSM.db.facilities.forEach(function (facility) {
      var card = document.querySelector('.facility-card[data-facility="' + facility.id + '"]');
      if (!card) return;
      var status = HSM.facilityStatus(facility);
      card.className = "facility-card accent-" + status.tone;
      card.querySelector(".facility-top .status-badge").outerHTML = HSM.statusBadge(status.toneKey);
      card.querySelector(".facility-numbers .big").innerHTML = facility.occupancy + "<small> / " + facility.capacity + "</small>";
      card.querySelector(".facility-numbers .pct").textContent = Math.round(status.pct) + "% utilized";
      card.querySelector(".progress-fill").style.width = status.pct + "%";
      card.querySelector(".facility-meta span:first-child").innerHTML = '<i class="bi bi-clock"></i> Updated ' + HSM.util.timeAgo(facility.lastUpdated);
    });
    var strip = document.getElementById("facilityStats");
    if (strip) strip.innerHTML = statsMarkup();
  }

  function openFacility(id) {
    var facility = HSM.store.getFacility(id);
    if (!facility) return;
    var status = HSM.facilityStatus(facility);
    var history = (facility.history || []).slice(-6).reverse().map(function (h) {
      return '<li><div class="h-title">' + h.occupancy + " of " + facility.capacity + " spaces occupied</div>" +
        '<span class="h-time">' + HSM.util.fmtDateTime(h.at) + "</span></li>";
    }).join("");

    var controller = HSM.ui.modal({
      title: facility.name,
      subtitle: facility.location + " · Simulated occupancy sensor",
      body:
        '<div class="detail-hero accent-' + status.tone + '">' +
          '<div class="dh-icon"><i class="bi ' + facility.icon + '"></i></div>' +
          '<div class="dh-main"><h3>' + facility.name + "</h3><p>" + facility.description + "</p></div>" +
          HSM.statusBadge(status.toneKey, "lg") +
        "</div>" +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><span>Capacity</span><strong>' + facility.capacity + " guests</strong></div>" +
          '<div class="detail-cell"><span>Current occupancy</span><strong>' + facility.occupancy + " guests</strong></div>" +
          '<div class="detail-cell"><span>Utilization</span><strong>' + Math.round(status.pct) + "%</strong></div>" +
          '<div class="detail-cell"><span>Last updated</span><strong>' + HSM.util.fmtDateTime(facility.lastUpdated) + "</strong></div>" +
        "</div>" +
        '<div class="row g-4"><div class="col-md-6">' +
          '<h4 class="detail-section-title">Recent occupancy</h4>' +
          '<ul class="history-list tone-' + status.tone + '">' + (history || "<li>No history recorded</li>") + "</ul>" +
        "</div><div class=\"col-md-6\">" +
          '<h4 class="detail-section-title">Set occupancy (demo)</h4>' +
          '<label class="form-label" for="facilityRange">Current guests: <output id="facilityRangeOut">' + facility.occupancy + "</output> / " + facility.capacity + "</label>" +
          '<input type="range" class="form-range" id="facilityRange" min="0" max="' + facility.capacity + '" value="' + facility.occupancy + '">' +
          '<div class="progress-track mt-2"><div class="progress-fill" id="facilityRangeBar" style="width:' + status.pct + '%"></div></div>' +
          '<button type="button" class="btn btn-navy w-100 mt-3" id="facilityApply"><i class="bi bi-check2"></i> Update occupancy</button>' +
          '<div class="info-note mt-3"><i class="bi bi-info-circle-fill"></i><div>Occupancy above 90% raises a simulated warning. Capacity and guest counts are demonstration data only.</div></div>' +
        "</div></div>",
      footer: '<button type="button" class="btn btn-outline-soft" data-bs-dismiss="modal">Close</button>',
      onShown: function (el) {
        var range = el.querySelector("#facilityRange");
        var out = el.querySelector("#facilityRangeOut");
        var bar = el.querySelector("#facilityRangeBar");
        if (range) {
          range.addEventListener("input", function () {
            var pct = facility.capacity ? (Number(range.value) / facility.capacity) * 100 : 0;
            out.textContent = range.value;
            bar.style.width = pct + "%";
          });
        }
        var apply = el.querySelector("#facilityApply");
        if (apply) {
          apply.addEventListener("click", function () {
            facility.occupancy = HSM.util.clamp(Number(range.value), 0, facility.capacity);
            facility.lastUpdated = new Date().toISOString();
            facility.history = facility.history || [];
            facility.history.push({ occupancy: facility.occupancy, at: facility.lastUpdated });
            if (facility.history.length > 12) facility.history.shift();
            var next = HSM.facilityStatus(facility);
            HSM.store.addActivity("facility", facility.name + " occupancy set to " + Math.round(next.pct) + "%",
              "Manual update · " + facility.occupancy + " of " + facility.capacity + " spaces in use", facility.icon);
            if (next.pct >= 90) {
              HSM.raiseAlert({
                priority: next.pct >= 97 ? "critical" : "warning",
                title: facility.name + " at " + Math.round(next.pct) + "% capacity",
                description: facility.name + " is at " + facility.occupancy + " of " + facility.capacity +
                  " guest capacity. This warning was raised by a manual demo update.",
                facility: "Facilities",
                source: facility.name,
                ruleKey: "facility-high-" + facility.id
              });
            }
            HSM.afterData(["facilities", "dashboard"]);
            refresh();
            if (controller) controller.hide();
            HSM.ui.toast({
              title: facility.name + " updated",
              message: "Occupancy set to " + facility.occupancy + " / " + facility.capacity + " (simulated).",
              tone: next.tone, icon: "bi-check2-circle"
            });
          });
        }
      }
    });
  }

  function template() {
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-building"></i> Live monitoring</div>' +
          "<h1>Facility monitoring</h1><p>Capacity, occupancy and utilization for shared guest facilities. Progress colours indicate normal, near-capacity and critical states. <span class=\"demo-inline\">Simulated data</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> How it works</a>' +
        '<a class="btn btn-navy" href="#/cameras"><i class="bi bi-camera-video"></i> Camera view</a></div>' +
      "</div>" +
      '<div class="page-stat-strip reveal" id="facilityStats">' + statsMarkup() + "</div>" +
      '<div class="facility-grid reveal">' + HSM.db.facilities.map(cardMarkup).join("") + "</div>" +
      '<div class="info-note mt-3 reveal"><i class="bi bi-info-circle-fill"></i><div><strong>Monitoring rules:</strong> below 70% is normal, 70–89% is near capacity, and 90% or more is critical. ' +
        "These thresholds exist only inside this demonstration.</div></div>";
  }

  HSM.registerPage("facilities", {
    title: "Facility Monitoring",
    render: function (root) {
      root.innerHTML = template();
      root.addEventListener("click", function (event) {
        var card = event.target.closest("[data-facility]");
        if (card) openFacility(card.getAttribute("data-facility"));
      });
    },
    onData: function () { refresh(); },
    openPending: function (pending) {
      if (pending && pending.type === "facility") openFacility(pending.id);
    }
  });
})(window.HSM);
