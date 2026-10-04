# RapidResQ

Smart ambulance dispatch and emergency route optimization, built as a Data Structures course project.

RapidResQ simulates **pre-hospital emergency response** on a simplified road network of Chennai. The base map is OpenStreetMap data (CARTO Voyager tiles), nodes are real localities (Avadi to Sholinganallur) and the five hospitals are real Chennai hospitals at their real locations. Road links, travel times, ambulance stations, bed counts and specialties are simulated, and the roads are straight links between places rather than true street geometry. An emergency is reported, placed in a priority queue, matched to the ambulance with the lowest Dijkstra travel time, driven to the scene, and then taken to a suitable hospital. Traffic and road closures change routes while ambulances are moving.

This is a simulation. It uses fictional data and is not suitable for real emergency services.

## Contents

1. [Requirements](#requirements)
2. [Quick start](#quick-start)
3. [Demo accounts](#demo-accounts)
4. [Where the data structures are](#where-the-data-structures-are)
5. [How a mission works](#how-a-mission-works)
6. [Simulation model](#simulation-model)
7. [Project structure](#project-structure)
8. [REST API](#rest-api)
9. [Tests](#tests)
10. [Design decisions and limits](#design-decisions-and-limits)
11. [Troubleshooting](#troubleshooting)

## Requirements

- Node.js 14.17 to 18 (developed and tested on 14.17.3 with npm 6). The pinned `better-sqlite3` 7.6.2 does not build on Node 22 and is not supported on versions after 18; see [Troubleshooting](#troubleshooting)
- A C++ toolchain is **not** needed: `better-sqlite3` ships a prebuilt binary for common platforms

The three `package.json` files pin versions that run on Node 14 (Vite 2, Jest 27, `better-sqlite3` 7). Each folder has an `.npmrc` that points npm at the public registry. Delete those files if your network requires a private registry.

## Quick start

```bash
npm run install:all      # installs root, server and client dependencies
npm run dev              # API on http://localhost:4000, UI on http://localhost:5173
```

Open http://localhost:5173 and sign in. The SQLite database is created and seeded automatically on first start (`database/rapidresq.db`).

Production style run, served by Express on one port:

```bash
npm run build            # builds client/dist
npm start                # http://localhost:4000
```

Other scripts:

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `npm test`           | Runs the server test suite (Jest)                           |
| `npm run seed`       | Seeds the database if it is empty                           |
| `npm run seed:reset` | Wipes city and mission data and reseeds (accounts are kept) |

### Deploy to Render

`render.yaml` describes a free Render web service that builds the client and serves the UI and the API from one Node 18 process. In Render choose **New, Blueprint**, pick this repository and apply. The deployed site is not a real dispatch system: the demo accounts below work on it, and the free plan's disk is temporary, so the database is reseeded (and any changed passwords are lost) whenever the service restarts or redeploys. Free services also sleep after about 15 minutes idle and take up to a minute to wake.

Environment variables (all optional): `PORT` (default 4000), `JWT_SECRET` (otherwise a random secret is generated once and stored in the database), `RAPIDRESQ_DB` (database path), `CORS_ORIGIN` (only needed if the UI is served from another origin), `TRUST_PROXY` (set to `1` behind a single reverse proxy such as Render, so the sign-in rate limit applies per visitor).

## Demo accounts

| Role       | Username     | Password       |
| ---------- | ------------ | -------------- |
| Admin      | `admin`      | `Admin@123`    |
| Dispatcher | `dispatcher` | `Dispatch@123` |

Change them in Settings. Passwords are stored as bcrypt hashes and sessions use signed JWTs that can be revoked on sign out.

- **Admin**: everything, including ambulances, hospitals, graph editing, traffic control, mission history and analytics.
- **Dispatcher**: report emergencies, dispatch, pick up patients, manage active emergencies, view the map, ambulances and hospitals.

## Where the data structures are

Everything lives in `server/datastructures` and `server/algorithms`. No graph, heap or shortest-path library is used.

| Concept                        | Implementation                                                                       | Where it is used                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Weighted graph, adjacency list | `Graph.js`                                                                           | City roads. Each edge has `source`, `destination`, `distance`, `normalTravelTime`, `currentTravelTime`, `trafficLevel`, `isClosed` |
| Min heap                       | `MinHeap.js` (`insert`, `extractMin`, `peek`, `heapifyUp`, `heapifyDown`, `isEmpty`) | Frontier of Dijkstra, storage for the emergency queue                                                                              |
| Priority queue                 | `PriorityQueue.js` (`enqueue`, `dequeue`, `peek`, `isEmpty`, `size`)                 | Pending emergencies. Critical 10, High 7, Medium 5, Low 2. Equal priority, earlier arrival first                                   |
| Hash table                     | `HashTable.js` (separate chaining, djb2, resizing)                                   | `ambulanceId`, `hospitalId`, `emergencyId`, `missionId`, `nodeId`, `roadId` lookups, and the graph's own node and adjacency tables |
| Queue                          | `Queue.js` (linked list)                                                             | FIFO event queue that becomes notifications, and BFS                                                                               |
| Stack                          | `Stack.js`                                                                           | Rebuilding a path from Dijkstra's predecessor links                                                                                |
| Dijkstra                       | `algorithms/dijkstra.js`                                                             | Ambulance and hospital routes, rerouting, the visualizer. Returns `path`, `totalDistance`, `estimatedTime`, `visitedNodes`         |
| BFS                            | `algorithms/bfs.js`                                                                  | Reachability check after closures, connected components                                                                            |
| Ambulance selection            | `algorithms/ambulanceSelection.js`                                                   | Filter by availability, filter by equipment, run Dijkstra for each, pick the lowest ETA                                            |
| Hospital selection             | `algorithms/hospitalSelection.js`                                                    | Filter by open, free bed, specialty, reachability, pick the lowest ETA                                                             |

The **Data Structures** page in the app shows each structure with live values from the running system, a hash table lookup tool, a BFS explorer, the priority queue and heap drawn as a tree, and a step by step **Dijkstra visualizer** (run, start, pause, next step, reset).

Complexities: Dijkstra O((V + E) log V), priority queue insert and remove O(log n), peek O(1), hash lookup average O(1), BFS O(V + E), adjacency list O(V + E) space.

## How a mission works

1. A dispatcher reports an emergency. It is validated, saved and enqueued.
2. In the Dispatch Center the queue is shown in dequeue order. The recommendation lists every available ambulance, drops those without the required equipment, runs Dijkstra from each remaining one, and picks the lowest ETA. It is **not** simply the nearest unit: traffic changes the answer.
3. **Dispatch** creates a mission. Statuses move `AVAILABLE`, `DISPATCHED`, `EN_ROUTE`, `AT_SCENE`.
4. The ambulance moves along the route on the map. Traffic or a closure on the remaining route triggers BFS (is the destination still reachable?) and then Dijkstra from the ambulance's current position. If nothing is reachable the mission shows **DESTINATION CURRENTLY UNREACHABLE** and the unit waits until a road reopens.
5. On arrival the app shows **AMBULANCE ARRIVED**. **Pick up patient** runs hospital selection, shows every candidate and the reason, and starts the transport (`TRANSPORTING`).
6. On arrival at the hospital one bed is taken, the mission and emergency complete, the ambulance becomes available at the hospital, and history and analytics update. If the hospital filled up or closed in the meantime, the ambulance is diverted to the next best hospital.

Queue order is enforced: a lower priority emergency cannot be dispatched while a higher priority one has a suitable ambulance, unless the dispatcher overrides. Emergencies that cannot be served right now (for example no ALS unit) do not block the ones behind them. Auto-dispatch (Settings) applies the same rule automatically.

### Run demo

The **Run demo** button plays the whole scenario using the real services: a critical cardiac emergency, ALS filtering, Dijkstra comparison, dispatch, movement, a road closure and reroute, scene arrival, pickup, cardiac hospital choice, delivery, bed update, completion and analytics. A progress panel lists each step. The demo restores any road it changed when it ends.

## Simulation model

- The server owns the simulation. It advances every 250 ms and the UI polls `/api/live`.
- Speed 1x equals one simulation minute per real second. 2x and 4x are available, and the simulation can be paused.
- Travel time of a road is `normalTravelTime x multiplier`: normal 1.0, moderate 1.4, heavy 2.0, severe 3.0. Closed roads are skipped by every algorithm.
- The crew takes one simulation minute to turn out before an ambulance leaves.
- **Response time** runs from the report to arrival at the scene, on the simulation clock. The clock advances only while an ambulance is moving.
- **Travel time** in history runs from dispatch to arrival at the hospital, including turnout and any waiting.
- An ambulance in the middle of a road finishes that road before taking a new route.
- State is saved to SQLite. Missions in progress resume after a server restart.

## Project structure

```
rapidresq/
├── client/                React, Vite, Tailwind, React Router, Recharts, lucide-react
│   └── src/ components, pages, layouts, hooks, services, utils, App.jsx
├── server/
│   ├── controllers/       request handlers
│   ├── routes/            REST routes and role checks
│   ├── models/            SQLite table gateways
│   ├── services/          dispatch, simulation, traffic, rerouting, analytics, demo
│   ├── datastructures/    Graph, MinHeap, PriorityQueue, Queue, Stack, HashTable
│   ├── algorithms/        dijkstra, bfs, ambulanceSelection, hospitalSelection
│   ├── middleware/        authentication, error handling
│   ├── tests/             Jest tests
│   └── server.js
├── database/
│   ├── schema.sql         users, ambulances, hospitals, hospital_specialties, emergencies,
│   │                      missions, nodes, roads, traffic_events (plus settings, revoked_tokens)
│   └── seed.js            demo city: 30 nodes, 50 roads, 8 ambulances, 5 hospitals
├── README.md
└── package.json
```

## REST API

All routes are under `/api` and need a Bearer token except `login` and `health`.

| Area           | Endpoints                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password`                                                                     |
| Emergencies    | `GET /emergencies`, `GET /emergencies/:id`, `POST /emergencies`, `PUT /emergencies/:id`, `DELETE /emergencies/:id`                                 |
| Ambulances     | `GET /ambulances`, `GET /ambulances/:id`, `POST /ambulances`, `PUT /ambulances/:id`, `POST /ambulances/:id/return`                                 |
| Hospitals      | `GET /hospitals`, `POST /hospitals`, `PUT /hospitals/:id`                                                                                          |
| Dispatch       | `GET /dispatch/:emergencyId/recommendation`, `POST /dispatch/:emergencyId`, `POST /dispatch/next`                                                  |
| Routes         | `POST /routes/calculate` (Dijkstra, optional trace), `POST /routes/bfs`                                                                            |
| Traffic        | `GET /traffic`, `PUT /roads/:roadId/traffic`, `PUT /roads/:roadId/close`, `PUT /roads/:roadId/reopen`                                              |
| Missions       | `GET /missions`, `GET /missions/:id`, `GET /missions/:id/hospital-options`, `POST /missions/:id/pickup`, `POST /missions/:id/complete`             |
| Resources      | `GET /resources`, `POST /resources`, `PUT /resources/:id`, `DELETE /resources/:id` (writes are admin only)                                         |
| Analytics      | `GET /analytics`                                                                                                                                   |
| Graph          | `GET /graph`, `POST /graph/nodes`, `POST /graph/roads`                                                                                             |
| Live and tools | `GET /live`, `PUT /sim`, `POST /sim/demo`, `DELETE /sim/demo`, `POST /sim/reset`, `GET /datastructures`, `GET /datastructures/hash`, `GET /health` |

Errors use one shape: `{ "error": { "code", "message", "details" } }`. Handled cases include no available ambulance, no suitable equipment, no reachable ambulance, no suitable hospital, no beds, disconnected graph, closed roads, invalid data, duplicate ids, invalid login and database failures. The server logs unexpected errors and keeps running.

## Tests

```bash
npm test
```

99 tests cover MinHeap, PriorityQueue, Queue, Stack, HashTable, Graph, Dijkstra (normal route, road closure, disconnected graph, traffic route change), A\* (same answer as Dijkstra for every node pair), BFS, ambulance and hospital selection (no ambulance, no equipment, no reachable unit, no hospital, no beds), equal priority emergencies, multiple simultaneous emergencies, the full REST API with roles, mission lifecycle, rerouting and unreachable destinations, diversion, restart recovery, traffic presets, CSV export, duplicate report merging, auto-return and the scripted demo.

## Design decisions and limits

- Roads are two-way and stored once. The adjacency lists therefore hold 2E entries.
- Stations and hospitals are vertices of the graph, so routes can pass through them.
- Equipment rule: a BASIC request can be served by any unit. ALS, TRAUMA and PEDIATRIC requests need a unit with exactly that equipment.
- Hospital selection reserves beds already promised to ambulances that are on their way, so one bed is not offered twice.
- Statistics start empty. Nothing in the dashboard or analytics is pre-filled. Run missions or the demo to populate them.
- Tokens live in `sessionStorage` and expire after 8 hours. The application sets no cookies. The only third party request is for CARTO map tiles of OpenStreetMap data (`a.basemaps.cartocdn.com`); fonts and scripts are bundled.
- **Resources** page and `/api/resources`: public helplines (112, 108, 102, 104, 1913) and a hospital contact directory stored in the `contacts` table. Hospital phone numbers are only filled in where I could confirm them from the hospital's own website: Apollo Greams Road (health help line 1860-500-1066 and emergency 1066). The other four hospitals show "Not added" until an admin enters a verified number.
- Map projection: node positions come from real latitude and longitude in `database/seed.js` (Web Mercator). `client/src/utils/geo.js` holds the same bounds to place the tiles. Change both together.
- Changing the seed layout: bump `SEED_VERSION` in `database/seed.js`. On the next start an older database is reset to the new city (accounts are kept).
- The model is deliberately simple: no vehicle speeds beyond road travel times, no shift patterns, no multiple patients per ambulance.
- **A\***: `server/algorithms/astar.js` uses straight-line travel time at 50 km/h as the heuristic. That is admissible for the seeded roads (all 45 km/h or slower). A road added with an unrealistically short travel time could break that guarantee.
- **Traffic patterns**: Morning peak and Evening peak slow the roads around fixed hub nodes (`server/services/trafficPresets.js`). Clear all traffic resets every road.
- **Duplicate reports**: a second report of the same type at the same place while the first is still waiting is merged into it (higher severity wins, descriptions are joined).
- **Return to station** (Settings): after delivery an ambulance drives home with status RETURNING before it can be dispatched again.
- **CSV export**: Mission History and Traffic Control (admin only). Cells that start with a formula character are prefixed with an apostrophe.

## Viva guide

A suggested order for showing each structure, with the screen and the code.

| Show                    | Screen                                                                  | Code                                                  |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Graph, adjacency list   | Data Structures, Graph panel                                            | `datastructures/Graph.js`, `neighbors()`              |
| Priority queue ordering | Data Structures, Priority queue. Report a LOW then a CRITICAL emergency | `PriorityQueue.js` comparator: priority, then arrival |
| Min heap                | Same page, heap drawn as a tree                                         | `MinHeap.js` `heapifyUp`, `heapifyDown`               |
| Hash table              | Data Structures, Hash table. Use "Build a table step by step"           | `HashTable.js` `_resize`                              |
| Stack                   | Data Structures, Stack panel after any route                            | `dijkstra.js` `reconstructPath`                       |
| Queue                   | Data Structures, Queue panel after any action                           | `runtime.js` `emit`, `processEvents`                  |
| Dijkstra                | Dijkstra visualizer: run, then step                                     | `algorithms/dijkstra.js`                              |
| A\* against Dijkstra    | Dijkstra visualizer, Compare algorithms                                 | `algorithms/astar.js`                                 |
| BFS reachability        | Data Structures, BFS panel, then close roads in Traffic Control         | `algorithms/bfs.js`, `rerouting.js`                   |
| Ambulance selection     | Dispatch Center, select an emergency                                    | `ambulanceSelection.js`                               |
| Hospital selection      | Pick up a patient and read the candidate table                          | `hospitalSelection.js`                                |
| Dynamic rerouting       | Start a mission, then apply Evening peak or close a road on its route   | `services/rerouting.js`                               |
| Whole flow              | Run demo                                                                | `services/demo.js`                                    |

## Troubleshooting

- **`npm install` returns 401 or cannot find packages**: your global npm registry needs credentials. The bundled `.npmrc` files use the public registry. If you removed them, pass `--registry https://registry.npmjs.org/`.
- **`better-sqlite3` fails to build, or `invalid ELF header` / `not a valid Win32 application`**: `node_modules` was installed on another OS or Node version. Delete `server/node_modules` and run `npm install --prefix server` again. On Node 20 or newer, use Node 18 (for example `nvm use 18`) or install `better-sqlite3@11` in `server`; the API the project uses is unchanged.
- **Port already in use**: set `PORT` for the server. For the dev UI, change `server.port` in `client/vite.config.js` and the proxy target if you changed the API port.
- **Reset everything**: stop the server, delete `database/rapidresq.db`, start again. Or use Settings, Reset simulation data (keeps accounts).
