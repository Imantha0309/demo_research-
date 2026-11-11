/* ==========================================================================
   Space Monitoring System — demo settings and preferences
   ========================================================================== */

(function (HSM) {
  "use strict";

  function simulationStatus() {
    var running = HSM.sim && HSM.sim.isRunning();
    return '<span class="status-badge tone-' + (running ? "green" : "orange") + '"><span class="status-dot"></span>' +
      (running ? "Running" : "Paused") + "</span>";
  }

  function template() {
    var running = HSM.sim && HSM.sim.isRunning();
    return '' +
      '<div class="page-head reveal">' +
        '<div class="page-head-copy"><div class="eyebrow"><i class="bi bi-gear"></i> Configuration</div>' +
          "<h1>Demo settings</h1><p>Control the hotel identity, appearance, notification preferences and the speed of the simulated monitoring engine. <span class=\"demo-inline\">Stored locally</span></p></div>" +
        '<div class="page-actions"><a class="btn btn-outline-soft" href="#/how-it-works"><i class="bi bi-diagram-3"></i> Demo guide</a></div>' +
      "</div>" +
      '<div class="settings-grid">' +
        '<div class="settings-stack">' +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">General</h2><p class="panel-sub">Identity shown across the demo</p></div></div>' +
            '<div class="settings-body">' +
              '<label class="form-label" for="settingsHotelName">Hotel name</label>' +
              '<div class="d-flex gap-2 flex-wrap"><input class="form-control" id="settingsHotelName" type="text" maxlength="48" value="' + HSM.ui.esc(HSM.settings.hotelName) + '" style="flex:1;min-width:200px">' +
              '<button class="btn btn-navy" type="button" id="settingsSaveName"><i class="bi bi-check2"></i> Save name</button></div>' +
              '<div class="form-text mt-2">Updates the top bar, dashboard heading and sample reports immediately.</div>' +
              '<div class="setting-row mt-3"><div class="setting-copy"><strong>Demo operator</strong><span>Alex Morgan · Operations Manager</span></div>' +
                '<span class="status-badge tone-blue"><span class="status-dot"></span>Demo account</span></div>' +
            "</div>" +
          "</section>" +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">Appearance</h2><p class="panel-sub">Applies instantly and is remembered</p></div></div>' +
            '<div class="settings-body">' +
              '<div class="theme-cards">' +
                '<button type="button" class="theme-card' + (HSM.settings.theme !== "dark" ? " is-active" : "") + '" data-theme-choice="light">' +
                  '<div class="theme-preview"><div class="tp-side"></div><div class="tp-main"><span></span><span></span><span></span></div></div>' +
                  '<strong><i class="bi bi-sun"></i> Light theme</strong></button>' +
                '<button type="button" class="theme-card' + (HSM.settings.theme === "dark" ? " is-active" : "") + '" data-theme-choice="dark">' +
                  '<div class="theme-preview dark"><div class="tp-side"></div><div class="tp-main"><span></span><span></span><span></span></div></div>' +
                  '<strong><i class="bi bi-moon-stars"></i> Dark theme</strong></button>' +
              "</div>" +
              '<div class="form-text mt-2">Dark mode is intended for low-light control rooms. All charts and status colours remain accessible.</div>' +
            "</div>" +
          "</section>" +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">Simulation engine</h2><p class="panel-sub">Controls the automatic demo events</p></div>' +
              '<span id="settingsSimStatus">' + simulationStatus() + "</span></div>" +
            '<div class="settings-body">' +
              '<div class="setting-row"><div class="setting-copy"><strong>Enable simulation</strong><span>When disabled, no automatic status changes or alerts are generated.</span></div>' +
                '<label class="switch"><input type="checkbox" id="settingsSimEnabled"' + (HSM.settings.simEnabled ? " checked" : "") + ' aria-label="Enable simulation"><span class="slider"></span></label></div>' +
              '<div class="setting-row"><div class="setting-copy"><strong>Event interval</strong><span>How often a simulated event is generated. Applies immediately.</span></div>' +
                '<div class="setting-control"><input type="range" class="form-range" id="settingsSpeed" min="3" max="15" step="1" value="' + HSM.settings.simSpeed + '" aria-label="Simulation speed">' +
                '<output id="settingsSpeedOut">' + HSM.settings.simSpeed + " sec</output></div></div>" +
              '<div class="setting-row"><div class="setting-copy"><strong>Current state</strong><span>Simulation events update rooms, tables, parking, facilities, cameras, alerts and charts.</span></div>' +
                '<span class="status-badge tone-' + (running ? "green" : "orange") + '" id="settingsRunBadge"><span class="status-dot"></span>' + (running ? "Generating events" : "Paused") + "</span></div>" +
            "</div>" +
          "</section>" +
        "</div>" +
        '<div class="settings-stack">' +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">Notifications</h2><p class="panel-sub">Demo-only preferences</p></div></div>' +
            '<div class="settings-body">' +
              '<div class="setting-row"><div class="setting-copy"><strong>Alert toasts</strong><span>Show a toast when the rule engine raises a new alert.</span></div>' +
                '<label class="switch"><input type="checkbox" id="settingsNotifyAlerts"' + (HSM.settings.notifications.alerts ? " checked" : "") + ' aria-label="Enable alert toasts"><span class="slider"></span></label></div>' +
              '<div class="setting-row"><div class="setting-copy"><strong>Activity feed</strong><span>Record simulation events in the dashboard feed.</span></div>' +
                '<label class="switch"><input type="checkbox" id="settingsNotifyActivity"' + (HSM.settings.notifications.activity ? " checked" : "") + ' aria-label="Enable activity feed"><span class="slider"></span></label></div>' +
              '<div class="setting-row"><div class="setting-copy"><strong>Notification sound</strong><span>Play a short generated tone for new alerts.</span></div>' +
                '<label class="switch"><input type="checkbox" id="settingsNotifySound"' + (HSM.settings.notifications.sound ? " checked" : "") + ' aria-label="Enable notification sound"><span class="slider"></span></label></div>' +
            "</div>" +
          "</section>" +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">Data &amp; persistence</h2><p class="panel-sub">Everything stays in this browser</p></div></div>' +
            '<div class="settings-body">' +
              '<div class="info-note"><i class="bi bi-database-check"></i><div><strong>LocalStorage is enabled.</strong> Room status changes, alerts, activity and preferences persist after a reload. No data is sent to a server.</div></div>' +
              '<div class="setting-row mt-3"><div class="setting-copy"><strong>Saved demo state</strong><span>Last saved: ' + (HSM.db.savedAt ? HSM.util.fmtDateTime(HSM.db.savedAt) : "this session") + "</span></div>" +
                '<button class="btn btn-sm btn-outline-soft" type="button" id="settingsSaveSnapshot"><i class="bi bi-save"></i> Save now</button></div>' +
            "</div>" +
          "</section>" +
          '<section class="panel settings-card danger-zone reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">Reset demo</h2><p class="panel-sub">Regenerate all simulated data</p></div></div>' +
            '<div class="settings-body">' +
              '<p class="about-note mb-3">This clears saved rooms, tables, parking, facilities, cameras, alerts, activities and preferences, then starts a fresh simulation.</p>' +
              '<button class="btn btn-danger-soft w-100" type="button" id="settingsReset"><i class="bi bi-arrow-counterclockwise"></i> Reset demo data</button>' +
            "</div>" +
          "</section>" +
          '<section class="panel settings-card reveal">' +
            '<div class="panel-head bordered"><div><h2 class="panel-title">About this prototype</h2><p class="panel-sub">Research demonstration</p></div></div>' +
            '<div class="settings-body">' +
              '<p class="about-note"><strong>Space Monitoring System v1.0</strong><br>' +
                "Frontend-only university research demonstration built with HTML, CSS, vanilla JavaScript, Bootstrap and Chart.js. " +
                "No backend, database, API keys, real CCTV, computer vision, IoT sensors or personal data are involved. " +
                "All hotel names, guests, vehicles, alerts and charts are fictional and simulated.</p>" +
              '<div class="d-flex gap-2 flex-wrap mt-3"><span class="status-badge tone-grey"><span class="status-dot"></span>Offline capable</span>' +
                '<span class="status-badge tone-blue"><span class="status-dot"></span>Sample data</span>' +
                '<span class="status-badge tone-green"><span class="status-dot"></span>No tracking</span></div>' +
            "</div>" +
          "</section>" +
        "</div>" +
      "</div>";
  }

  function refreshStatusBadges() {
    var status = document.getElementById("settingsSimStatus");
    if (status) status.innerHTML = simulationStatus();
    var running = HSM.sim && HSM.sim.isRunning();
    var badge = document.getElementById("settingsRunBadge");
    if (badge) {
      badge.className = "status-badge tone-" + (running ? "green" : "orange");
      badge.innerHTML = '<span class="status-dot"></span>' + (running ? "Generating events" : "Paused");
    }
  }

  HSM.registerPage("settings", {
    title: "Settings",
    render: function (root) {
      root.innerHTML = template();

      var nameInput = document.getElementById("settingsHotelName");
      var saveName = document.getElementById("settingsSaveName");
      if (saveName) {
        saveName.addEventListener("click", function () {
          var value = nameInput ? nameInput.value.trim() : "";
          if (!value) {
            HSM.ui.toast({ title: "Hotel name required", message: "Enter a name before saving.", tone: "orange", icon: "bi-exclamation-triangle" });
            return;
          }
          HSM.settings.hotelName = value;
          HSM.store.saveSettings();
          HSM.applySettings();
          document.title = "Settings · " + value + " · Space Monitoring System";
          HSM.ui.toast({ title: "Hotel name saved", message: "The demo now displays “" + HSM.ui.esc(value) + "”.", tone: "green", icon: "bi-check2-circle" });
        });
      }

      root.querySelectorAll("[data-theme-choice]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var theme = btn.getAttribute("data-theme-choice");
          root.querySelectorAll("[data-theme-choice]").forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          HSM.setTheme(theme, { reload: false });
          HSM.ui.toast({
            title: "Theme saved",
            message: theme === "dark" ? "Dark theme is now active." : "Light theme is now active.",
            tone: "blue", icon: theme === "dark" ? "bi-moon-stars" : "bi-sun"
          });
        });
      });

      var simEnabled = document.getElementById("settingsSimEnabled");
      if (simEnabled) {
        simEnabled.addEventListener("change", function () {
          HSM.settings.simEnabled = simEnabled.checked;
          HSM.store.saveSettings();
          if (simEnabled.checked) HSM.sim.start();
          else HSM.sim.pause();
          refreshStatusBadges();
          HSM.ui.toast({
            title: simEnabled.checked ? "Simulation enabled" : "Simulation disabled",
            message: simEnabled.checked ? "Automatic demo events will continue." : "No new events will be generated until re-enabled.",
            tone: simEnabled.checked ? "green" : "grey",
            icon: simEnabled.checked ? "bi-play-fill" : "bi-pause-fill"
          });
        });
      }

      var speed = document.getElementById("settingsSpeed");
      var speedOut = document.getElementById("settingsSpeedOut");
      if (speed) {
        speed.addEventListener("input", function () {
          if (speedOut) speedOut.textContent = speed.value + " sec";
        });
        speed.addEventListener("change", function () {
          HSM.sim.setSpeed(speed.value);
          if (speedOut) speedOut.textContent = HSM.settings.simSpeed + " sec";
          refreshStatusBadges();
          HSM.ui.toast({
            title: "Simulation speed updated",
            message: "A new simulated event will arrive every " + HSM.settings.simSpeed + " seconds.",
            tone: "blue", icon: "bi-speedometer2"
          });
        });
      }

      function bindToggle(id, key, label) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", function () {
          HSM.settings.notifications[key] = el.checked;
          HSM.store.saveSettings();
          HSM.ui.toast({
            title: label + (el.checked ? " enabled" : " disabled"),
            message: "Preference saved to this browser.",
            tone: el.checked ? "green" : "grey", icon: "bi-sliders"
          });
        });
      }
      bindToggle("settingsNotifyAlerts", "alerts", "Alert toasts");
      bindToggle("settingsNotifyActivity", "activity", "Activity feed");
      bindToggle("settingsNotifySound", "sound", "Notification sound");

      var saveSnapshot = document.getElementById("settingsSaveSnapshot");
      if (saveSnapshot) {
        saveSnapshot.addEventListener("click", function () {
          HSM.store.save();
          HSM.ui.toast({ title: "Demo state saved", message: "Current simulated state stored in LocalStorage.", tone: "green", icon: "bi-save" });
          var row = saveSnapshot.closest(".setting-row");
          if (row) row.querySelector(".setting-copy span").textContent = "Last saved: " + HSM.util.fmtDateTime(HSM.db.savedAt);
        });
      }

      var reset = document.getElementById("settingsReset");
      if (reset) {
        reset.addEventListener("click", function () {
          HSM.ui.confirm({
            title: "Reset demo data?",
            tone: "danger",
            message: "This clears every simulated room, table, parking space, facility, camera, alert, activity and preference, then starts a fresh simulation. It cannot be undone.",
            confirmLabel: "Reset everything",
            onConfirm: function () { HSM.sim.resetDemo(); }
          });
        });
      }
    },
    onData: function () { refreshStatusBadges(); }
  });
})(window.HSM);
