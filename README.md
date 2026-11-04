# Pyro Nav — VS Code project

A browser-based Star Citizen-inspired station tracker and cargo route planner.

## Open in Visual Studio Code

1. Extract this folder from the ZIP.
2. Open Visual Studio Code.
3. Choose **File → Open Folder…** and select `pyro-nav-vscode`.
4. Open `index.html` in a browser. For easier development, install the **Live Server** extension, right-click `index.html`, and choose **Open with Live Server**.

No Node.js or build step is required for this version.

## Open the hosted app

The public browser version is available at [https://volderaxe.github.io/pyro-nav/](https://volderaxe.github.io/pyro-nav/). Share that link with friends; each browser keeps its own station and route data.

## Included features

- Station registry with external freight elevator and regular station categories
- Add, edit, delete, and mark stations visited
- Ruin Station as the fixed home base
- Multiple custom routes that can be active concurrently, with independent progress and a separate focused route for planning
- Selectable stops, manual stop ordering, and progress-aware distance optimization
- Route manifests always show departure from Ruin and a required return to Ruin
- Route distance estimates include the Ruin return leg and flag unknown distances
- Per-route haul-run checklist for departure, stop completion, return, and fresh runs without deleting the route
- Record early cargo drops at Ruin during a haul and continue the same route later with stop progress preserved
- Fresh station trackers begin with zero visited locations (Ruin is the home base, not a counted visit); the overview's visited count reflects unique stops completed in haul runs still in progress
- Searchable route setup with large, full-row station selectors
- Overview action to complete the current station as the focused route's next stop
- Recent-improvements notice and feature request form that prepares an email draft
- Distance matrix and manually editable distances
- Browser local-storage persistence, JSON export, and validated backup restore

## Important notes

- The app does not read your live in-game position. Select your current station manually.
- Multiple routes may be active at once for separate ships. Each route keeps its own progress and can be activated or paused without changing other routes. The overview route selector changes the **focused** route only; it does not activate or pause it.
- The overview's station status list follows the focused route: incomplete route stops show **Not visited**, completed stops show **Visited**, and stations outside that route are tucked into a collapsed **Not on this route** section.
- Overview route completion aggregates completed stop instances across every saved route and provides per-route active/paused state, progress, next-stop/return-leg status, **Focus**, **Activate/Pause**, and **Plan route** actions. Registry visit totals remain separate so completing the same station on different routes is tracked accurately per route.
- Starting a haul run activates only that route; completing its return to Ruin ends that run and resets the overview's visited count for it to zero. Completed route history remains visible in its route card. Pausing preserves in-progress counts. Resetting route progress or deleting a route cancels it, removes its stops from the live visited count, and restores independent prior station statuses. With multiple ships, the overview counts distinct visited stations across all unfinished runs.
- If a run needs an early cargo drop, select your current station and choose **Early drop at Ruin** in the focused route checklist. This records the partial drop, returns the tracker location to Ruin, and preserves completed stops. Choose **Continue route from Ruin** when ready to resume; route stops must still be completed in order.
- New installs start with zero visited stations; Ruin Station is excluded from the visited/unvisited counters. Previously saved data is preserved, except the old untouched all-visited starter data is migrated to the new zero-visited defaults. Completing a route stop updates station visit status and the live run total; finishing or canceling a run resets its contribution to the overview total.
- The overview's **Complete current route stop** action is enabled when your selected current station is the focused active route's next stop and its haul run has started.
- Feature requests open a prefilled message in the visitor's default email app. The visitor reviews and sends the email; the app does not submit requests in the background.
- Distance estimates are community reference values and may be approximate; unknown distances show as unavailable.
- Data is saved in the current browser profile. Use **Export data** to back up your records.
- Import a JSON backup from the Station Registry. The app validates it before replacing saved data and reports errors without changing the current records.
- If saved data is malformed or browser storage is unavailable, the app displays a warning and disables writes rather than overwriting existing records with defaults. Use **Export data** for currently readable records, then explicitly reset app data if needed.
- Ruin Station is a protected home base. Route optimization leaves completed stops fixed, starts from the current or last completed station, and considers the return distance when all required distances are known.
- This is a fan-made personal utility and is not affiliated with Cloud Imperium Games.

## Files

- `index.html` — page structure
- `styles.css` — visual design
- `app.js` — station data, route logic, and local persistence
