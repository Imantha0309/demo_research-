# Space Monitoring System

A frontend-only university research prototype for **Grand Horizon Hotel**. It demonstrates how hotel teams could monitor rooms, restaurant tables, parking, shared facilities, simulated camera feeds, alerts and sample analytics from one responsive dashboard.

> **Research demonstration only.** All figures, alerts, detections and camera feeds are simulated. No CCTV connection, computer vision, facial recognition, IoT sensors, backend, database or API keys are used.

## Run the demo

No build step or installation is required.

### Recommended: local web server

From this folder:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

Then open **http://127.0.0.1:8123/**.

You can also open `index.html` directly in a modern browser. The app uses classic scripts so `file://` works, but a local server gives the most reliable CDN and image loading.

Internet access is needed for the Bootstrap, Bootstrap Icons, Chart.js and Google Fonts CDNs, plus the stock camera photos. A local fallback graphic is shown if a camera image cannot load.

## Pages

| Route | Purpose |
| --- | --- |
| `#/dashboard` | KPI overview, live charts, recent activity |
| `#/how-it-works` | Animated CCTV-style demo, simulated workstation, pipeline explainer |
| `#/rooms` | 120 rooms, filters, search, status editing |
| `#/restaurant` | 24 tables across three zones, waiting times |
| `#/parking` | 40 spaces, occupancy and zone filters |
| `#/facilities` | Five shared facilities with capacity monitoring |
| `#/cameras` | Four simulated camera feeds with detection overlays |
| `#/alerts` | Priority filters, alert details, resolve workflows |
| `#/analytics` | Six charts, range/facility/type controls, CSV exports |
| `#/settings` | Hotel identity, theme, simulation speed, notifications, reset |

## Seeded demo state

- 120 rooms: 84 occupied, 21 available, 7 cleaning, 5 reserved, 3 maintenance
- 24 restaurant tables: 15 occupied
- 40 parking spaces: 18 available
- 5 facilities with 430 combined capacity
- 3 open alerts, 3 unread notifications

The simulation engine runs automatically (default 7-second cycle, 3–15 second range), adds plausible occupancy changes and can raise rule-based alerts. Use **Pause/Start** or **Reset** in the top bar at any time. **Reset** restores the seeded state.

## Features

- Fully interactive navigation, global search, filters, modals and status updates
- Live-updating KPI cards and Chart.js visualisations
- Light and dark themes with live chart colour refresh
- CSV downloads for analytics datasets
- LocalStorage persistence for demo state and settings
- Responsive layouts for desktop, tablet and mobile
- Clearly labelled `SIMULATED DATA`, `LIVE DEMO` and `Not real CCTV` indicators
- How It Works canvas scene with guests, waiters in yellow caps, tracking boxes, trails and a simulated operator console

## Tech stack

HTML5, CSS3, vanilla JavaScript (ES6+, classic modules on a global `HSM` namespace), Bootstrap 5.3, Bootstrap Icons and Chart.js via CDN.

## Project structure

```text
hotel-space-monitoring/
├── index.html
├── assets/images/       # favicon and camera fallback
├── css/                 # design tokens, components, dashboard, animations, How It Works
└── js/                  # app shell, data, simulation, page modules
```

## Privacy and limitations

This project is intended to communicate a monitoring concept and support research discussion. The people in the How It Works scene are abstract moving shapes with random identifiers. The camera page uses stock photography. No personal data is collected, stored or processed.
"# demo_research-" 
