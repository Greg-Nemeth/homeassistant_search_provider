# Home Assistant Search Provider (HASP) for GNOME Shell

HASP is a GNOME Shell search provider extension that allows users to quickly search, view, and toggle Home Assistant entities directly from the GNOME Shell Overview search bar.

---

## Features

- **GNOME Overview Integration**: Search for smart home devices by typing directly in the GNOME search bar (`Super` key).
- **Direct Device Control**: Instantly toggle devices (lights, switches, etc.) with a single click or `Enter`.
- **Domain Filtering**: Choose which entity categories (e.g., lights, switches, sensors) appear in your search results.
- **Fast Search Prioritization**: Move Home Assistant results to the top of GNOME search directly from the extension preferences.
- **Quick Web Launch**: Jump straight into the Home Assistant web dashboard from search.
- **Behavior-Driven Development (BDD)**: Test suite powered by Cucumber.js with an in-memory GJS mock harness for fast, reliable testing.

---

## Architecture Overview

```
                                 GNOME Overview Search Bar
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │   extension.js (Extension)      │
                           │   - Lifecycle (enable / disable) │
                           └────────────────┬─────────────────┘
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │ SearchProvider.js                │
                           │ - GNOME Search Provider Contract │
                           │ - Desktop file generation        │
                           │ - Entity filtering & matching    │
                           │ - REST API calls to Home Assistant│
                           └────────────────┬─────────────────┘
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼                                                        ▼
┌──────────────────────────────┐                         ┌─────────────────────────────┐
│  Home Assistant REST API     │                         │ GSettings Schema & Prefs    │
│  - GET  /api/states          │                         │ - prefs.js                  │
│  - POST /api/services/{d}/...│                         │ - org.gnome.shell.extensions│
└──────────────────────────────┘                         └─────────────────────────────┘
```

### Key Files

| File | Description |
|------|-------------|
| [`extension.js`](./extension.js) | Main extension entry point. Registers and unregisters the search provider with GNOME Shell. |
| [`SearchProvider.js`](./SearchProvider.js) | Implements GNOME Shell's search provider interface (`getInitialResultSet`, `getResultMetas`, `activateResult`, `launchSearch`). |
| [`prefs.js`](./prefs.js) | Preferences UI built with `Adw` and `Gtk` for configuring server address, API token, and service domain switches. |
| [`schemas/`](./schemas/) | GSettings XML schema (`org.gnome.shell.extensions.hasp.gschema.xml`) defining configuration keys. |
| [`icons/`](./icons/) | Symbolic SVGs used for search provider branding and entity representations. |
| [`metadata.json`](./metadata.json) | Extension metadata (UUID, name, target GNOME Shell versions). |

---

## Development & BDD Testing

HASP uses **Behavior-Driven Development (BDD)** with `@cucumber/cucumber` to define and verify all user-facing behaviors in plain English Gherkin syntax.

### Devcontainer Setup

The project includes a `.devcontainer` configuration (`mcr.microsoft.com/devcontainers/javascript-node:24-trixie`) with Node.js 24 and all required dependencies pre-installed.

### GJS Mock Layer (`test/mocks/`)

Because GNOME Shell extensions run under GJS (SpiderMonkey) with `gi://` and `resource://` module imports, running tests in standard Node.js requires intercepting these imports. 

The project uses Node.js 24 ESM module customization hooks:
- [`register-hooks.js`](./register-hooks.js) registers [`loader-hooks.mjs`](./loader-hooks.mjs).
- `loader-hooks.mjs` transparently routes `gi://Soup`, `gi://GLib`, `gi://Gio`, `gi://GioUnix`, `gi://St`, and Shell resources to in-memory mocks in [`test/mocks/`](./test/mocks/).
- No native GNOME Shell or live Home Assistant instance is required to run tests.

### Running Tests

Inside your devcontainer terminal:

```bash
npm test
```

Or from your host machine via Docker:

```bash
docker exec -w /workspaces/hasp <container_id> npm test
```

---

## Existing Behavior Anchor Features

The existing functionality of HASP is codified in four feature files:

1. **[`features/search_entities.feature`](./features/search_entities.feature)**
   - Searching by single or multiple search terms (case-insensitive substring match).
   - Filtering entities based on enabled domain switches in GSettings (`lights`, `switches`, `sensors`).
   - Limiting search result counts (`filterResults`).

2. **[`features/activate_entity.feature`](./features/activate_entity.feature)**
   - Activating a result in the search overview sends a `POST` request to `/api/services/{domain}/toggle`.
   - Validates Bearer authentication token and JSON payload structure.

3. **[`features/result_metadata.feature`](./features/result_metadata.feature)**
   - Validates search result item formatting (`id`, `name`, `description`, `clipboardText`, `createIcon`) expected by GNOME Shell Overview.

4. **[`features/launch_search.feature`](./features/launch_search.feature)**
   - Opening the search provider in the browser launches the configured Home Assistant server URL.

---

## BDD Workflow for New Features

When developing new features:

1. **Write the Scenario First**: Add a new scenario to an existing `.feature` file or create a new `.feature` in `features/`.
2. **Run `npm test`**: Verify that the scenario fails as expected (red).
3. **Implement Step Definitions**: Add or update steps in [`features/step_definitions/steps.js`](./features/step_definitions/steps.js).
4. **Implement Feature Code**: Add the required logic to [`SearchProvider.js`](./SearchProvider.js) or supporting modules.
5. **Run `npm test`**: Verify that all scenarios pass (green).
6. **Refactor**: Clean up the implementation with full confidence that regressions are caught.

---

## Roadmap

Upcoming features to implement using BDD:

- [ ] **Friendly Names**: Display entity `attributes.friendly_name` instead of raw entity IDs.
- [ ] **State & Area in Description**: Show current state (e.g. "On • Living Room", "21.5 °C") in search result descriptions.
- [ ] **Dynamic Symbolic Icons**: Render domain- and state-specific icons (`lamp-symbolic.svg`, `switch-left-symbolic.svg`, etc.) from [`icons/`](./icons/).
- [ ] **Additional Domains**: Support `climate`, `scene`, `script`, and `media_player`.
- [ ] **State Caching / Debounce**: Cache `/api/states` responses with a short TTL to minimize network overhead on every keystroke.
