# Home Assistant Search Provider (HASP) for GNOME Shell

HASP is a GNOME Shell search provider extension that allows you to quickly search, inspect, and control Home Assistant entities, services, and attributes directly from the GNOME Shell Overview search bar.

---

## Features

- **GNOME Overview Integration**: Search for smart home devices by typing directly in the GNOME search bar (`Super` key), matching either `entity_id` or `friendly_name`.
- **Smart Default Activation**: Selecting an entity result (single click or `Enter`) executes the domain-appropriate default action (`toggle` for lights/switches/covers/climate, `turn_on` for scenes/scripts, `press` for buttons, `trigger` for automations, and state-aware `lock`/`unlock` for locks).
- **`!` Action Expansion & State Control**: Append `!` to any search query (e.g., `loft!`, `loft!40%`, `ac ! 22c`, `loft ! brightness 65`) to expand matching entities into individual service calls and controllable attributes, or directly set target values.
- **Dynamic Domain & Service Discovery**: Scan your Home Assistant instance in Preferences to choose which domains appear in search, and automatically discover domain services and field schemas from `/api/services`.
- **Fast Search Prioritization**: Move Home Assistant results to the top of GNOME search directly from the extension preferences.
- **Quick Web Launch**: Click the Home Assistant provider icon in GNOME Overview to open your Home Assistant web dashboard.
- **Behavior-Driven Development (BDD)**: Test suite powered by Cucumber.js with an in-memory GJS mock harness for fast, reliable testing.

---

## Getting Started

### 1. Generate a Home Assistant Long-Lived Access Token
1. Open your Home Assistant web interface and click on your **Profile** (bottom-left corner).
2. Switch to the **Security** tab and scroll down to **Long-Lived Access Tokens**.
3. Click **Create Token**, give it a name (e.g., `GNOME Search`), and copy the generated token.

### 2. Configure the Extension
1. Open the **Extensions** app (or run `gnome-extensions prefs hasp@greg.rum-and-code`) and open **Home Assistant search provider** preferences.
2. **Server Address**: Enter your Home Assistant URL (e.g., `http://homeassistant.local:8123` or `https://ha.example.com`).
3. **Api Key**: Paste your Long-Lived Access Token.
4. **Scan Domains**: Click the **Scan** button. HASP will query `/api/states` on your Home Assistant instance and populate the **Services** list with all discovered entity domains (e.g., `climate`, `cover`, `light`, `lock`, `media_player`, `scene`, `switch`).
5. **Enable Domains**: Toggle on the domains you want to appear in GNOME Overview search results.
6. *(Optional)* Click **Move to Top** under **Prioritize in Search** so Home Assistant results appear first in GNOME Overview.

### 3. Usage Examples

Press the `Super` key to open GNOME Overview and start typing:

#### Standard Search & Default Activation
| Search Query | Result | Action on `Enter` / Click |
|--------------|--------|---------------------------|
| `loft` or `Lava Lamp` | Shows matching entity `Lava Lamp` (`light.loft_lavalamp`) | Toggles the light (`light.toggle`) |
| `movie night` | Shows `Movie Night` (`scene.movie_night`) | Activates the scene (`scene.turn_on`) |
| `front door` | Shows `Front Door` (`lock.front_door`) | Unlocks if currently locked, or locks if unlocked |
| `doorbell` | Shows `Chime` (`button.doorbell_chime`) | Presses the button (`button.press`) |

#### `!` Action Expansion & Attribute Inspection
Append `!` (attached or space-separated) to list all available actions and current attribute values for matching entities:
- **`loft!`** or **`loft !`** expands `light.loft_lavalamp` into multiple results:
  - `Lava Lamp → Turn On`
  - `Lava Lamp → Turn Off`
  - `Lava Lamp → Toggle`
  - `Lava Lamp → Brightness (current: 80%)`
  - `Lava Lamp → Color Temp Kelvin (current: 3000)`
- **`loft!off`** or **`loft ! off`**: Filters the expanded actions down to `Lava Lamp → Turn Off`.
- **`loft!bright`**: Narrows results to the `Brightness` attribute.

#### Setting Values via Shorthand Tokens
Type a shorthand value directly after `!` (attached or space-separated) to synthesize a parameterized action result:
| Search Query | Synthesized Result | Service Call & Payload |
|--------------|--------------------|------------------------|
| `loft!40%` or `loft ! 40%` | `Lava Lamp → Set brightness to 40%` | `light.turn_on` `{"brightness_pct": 40}` |
| `loft!2700k` | `Lava Lamp → Set color temperature to 2700K` | `light.turn_on` `{"color_temp_kelvin": 2700}` |
| `loft!red` | `Lava Lamp → Set color to red` | `light.turn_on` `{"color_name": "red"}` |
| `ac!22c` or `ac ! 22` | `AC → Set temperature to 22°` | `climate.set_temperature` `{"temperature": 22}` |
| `ac ! cool` | `AC → Set HVAC mode to cool` | `climate.set_hvac_mode` `{"hvac_mode": "cool"}` |
| `garage!50%` | `Garage Door → Set position to 50%` | `cover.set_cover_position` `{"position": 50}` |
| `garage ! close` | `Garage Door → Close` | `cover.close_cover` `{}` |

#### Setting Values via Attribute / Field Key-Value Pairs
Specify an attribute or service field name followed by a value (separated by a space, `=`, or `:`):
- **`loft ! brightness 65`** or **`loft!brightness=65`** $\rightarrow$ `light.turn_on` with `{"brightness_pct": 65}`
- **`loft ! color_temp_kelvin 2700`** $\rightarrow$ `light.turn_on` with `{"color_temp_kelvin": 2700}`
- **`climate.living_room ! temperature 23.5`** $\rightarrow$ `climate.set_temperature` with `{"temperature": 23.5}`
- **`climate.living_room ! hvac_mode auto`** $\rightarrow$ `climate.set_hvac_mode` with `{"hvac_mode": "auto"}`
- **`garage ! position 75`** $\rightarrow$ `cover.set_cover_position` with `{"position": 75}`
- **`robo ! fan_speed Turbo`** $\rightarrow$ dynamically resolves `vacuum.set_fan_speed` with `{"fan_speed": "Turbo"}` via `/api/services`.

---

## Architecture Overview

```
                                 GNOME Overview Search Bar
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │   extension.js (Extension)       │
                           │   - Lifecycle (enable / disable) │
                           └────────────────┬─────────────────┘
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │ SearchProvider.js                │
                           │ - GNOME Search Provider Contract │
                           │ - Desktop file generation        │
                           │ - Entity & service catalog cache │
                           │ - REST API calls to Home Assistant│
                           └───────┬──────────────────┬───────┘
                                   │                  │
            ┌──────────────────────┘                  └──────────────────────┐
            ▼                                                                ▼
┌──────────────────────────────┐                                 ┌──────────────────────────────┐
│ QueryParser.js               │                                 │ ActionRegistry.js            │
│ - Splits entity terms vs '!' │                                 │ - Domain default actions     │
│ - Attached & spaced tokens   │                                 │ - Action & attr expansion    │
│ - Matches ID & friendly_name │                                 │ - Shorthand & key-val binding│
└──────────────────────────────┘                                 │ - /api/services discovery    │
                                                                 └──────────────────────────────┘
```

### Key Files

| File | Description |
|------|-------------|
| [`extension.js`](./extension.js) | Main extension entry point. Registers and unregisters the search provider with GNOME Shell. |
| [`SearchProvider.js`](./SearchProvider.js) | Implements GNOME Shell's search provider interface (`getInitialResultSet`, `getResultMetas`, `activateResult`, `launchSearch`). |
| [`QueryParser.js`](./QueryParser.js) | Parses GNOME search term arrays into entity filter terms and `!` action tokens. |
| [`ActionRegistry.js`](./ActionRegistry.js) | Resolves domain actions, attribute listings, shorthand tokens, key-value bindings, and dynamic `/api/services` schemas. |
| [`prefs.js`](./prefs.js) | Preferences UI built with `Adw` and `Gtk` for configuring server address, API token, search priority, and scanned domain switches. |
| [`schemas/`](./schemas/) | GSettings XML schema (`org.gnome.shell.extensions.hasp.gschema.xml`) defining configuration keys. |
| [`icons/`](./icons/) | Symbolic SVGs used for search provider branding and entity representations. |
| [`metadata.json`](./metadata.json) | Extension metadata (UUID, name, target GNOME Shell versions). |

---

## Development & BDD Testing

HASP uses **Behavior-Driven Development (BDD)** with `@cucumber/cucumber` to define and verify all user-facing behaviors in plain English Gherkin syntax.

### GJS Mock Layer (`test/mocks/`)

Because GNOME Shell extensions run under GJS (SpiderMonkey) with `gi://` and `resource://` module imports, running tests in standard Node.js requires intercepting these imports.

The project uses Node.js 24 ESM module customization hooks:
- [`register-hooks.js`](./register-hooks.js) registers [`loader-hooks.mjs`](./loader-hooks.mjs).
- `loader-hooks.mjs` transparently routes `gi://Soup`, `gi://GLib`, `gi://Gio`, `gi://GioUnix`, `gi://St`, `gi://Adw`, `gi://Gtk`, and Shell resources to in-memory mocks in [`test/mocks/`](./test/mocks/).
- No native GNOME Shell or live Home Assistant instance is required to run tests.

### Running Tests

Inside your devcontainer or Distrobox container:

```bash
npm test
```

Or from your host machine via Distrobox:

```bash
distrobox enter hasp -- npm test
```

---

## Packaging & Distribution (`extensions.gnome.org`)

### Local Build & Packaging

You can validate `metadata.json`, compile GSettings schemas, and package a clean `.shell-extension.zip` archive ready for upload to [extensions.gnome.org](https://extensions.gnome.org/):

```bash
# Package only (creates dist/hasp@greg.rum-and-code.shell-extension.zip)
distrobox enter hasp -- npm run pack

# Run BDD test suite + package
distrobox enter hasp -- npm run build

# Package and install directly to ~/.local/share/gnome-shell/extensions/
distrobox enter hasp -- npm run install:local
```

### GitHub Actions Pipeline

The repository includes a CI/CD workflow in [`.github/workflows/package.yml`](./.github/workflows/package.yml):

- **On Push / Pull Request to `main` (or manual `workflow_dispatch`)**:
  1. Installs Node.js 24, `glib-compile-schemas`, and `zip`.
  2. Runs the Cucumber BDD test suite (`npm test`).
  3. Validates `metadata.json` and GSettings schemas, then builds `dist/hasp@greg.rum-and-code.shell-extension.zip` (`npm run pack`).
  4. Uploads the `.shell-extension.zip` bundle as a downloadable GitHub Actions workflow artifact (`hasp-gnome-shell-extension`).
- **On Version Tags (`v*`, e.g. `v1.0.0`)**:
  - Automatically creates/updates the GitHub Release and attaches `hasp@greg.rum-and-code.shell-extension.zip` as a release asset.

---

## Feature Specifications (`features/`)

All behaviors are specified and verified across five Gherkin feature files:

1. **[`features/search_entities.feature`](./features/search_entities.feature)**
   - Searching by single or multiple search terms (case-insensitive substring match).
   - Filtering entities based on enabled domain switches in GSettings.
   - Limiting search result counts (`filterResults`).

2. **[`features/activate_entity.feature`](./features/activate_entity.feature)**
   - Activating a result directly sends a `POST` request to `/api/services/{domain}/{service}`.
   - Validates Bearer authentication token and JSON payload structure.

3. **[`features/entity_actions.feature`](./features/entity_actions.feature)**
   - Expanding entities into multiple action and attribute results using `!`.
   - Setting state and attributes via shorthand tokens (`!40%`, `!22c`, `!cool`, `!50%`, `!close`).
   - Filtering attributes and binding values via key-value tokens (`! brightness 65`, `!brightness=65`, `! temperature 23.5`).
   - Dynamic service and field schema discovery via `/api/services`.
   - Domain-appropriate default activation (`scene`, `script`, `button`, `automation`, `lock`).

4. **[`features/scan_domains.feature`](./features/scan_domains.feature)**
   - Scanning available entity domains from `/api/states` in Preferences and persisting enabled domain toggles.

5. **[`features/result_metadata.feature`](./features/result_metadata.feature)** & **[`features/launch_search.feature`](./features/launch_search.feature)**
   - Formatting search result metadata (`id`, `name`, `description`, `clipboardText`, `createIcon`) and launching the Home Assistant web UI.

---

## BDD Workflow for New Features

When developing new features:

1. **Write the Scenario First**: Add a new scenario to an existing `.feature` file or create a new `.feature` in `features/`.
2. **Run `npm test`**: Verify that the scenario fails as expected (red).
3. **Implement Step Definitions**: Add or update steps in [`features/step_definitions/steps.js`](./features/step_definitions/steps.js).
4. **Implement Feature Code**: Add the required logic to [`SearchProvider.js`](./SearchProvider.js), [`QueryParser.js`](./QueryParser.js), or [`ActionRegistry.js`](./ActionRegistry.js).
5. **Run `npm test`**: Verify that all scenarios pass (green).
6. **Refactor**: Clean up the implementation with full confidence that regressions are caught.

---

## Roadmap

Upcoming features to implement using BDD:

- [x] **Friendly Names**: Display entity `attributes.friendly_name` instead of raw entity IDs.
- [x] **Dynamic Domain Scanning**: Scan available domains from Home Assistant in Preferences.
- [x] **Additional Domains & `!` Action Tokens**: Support `climate`, `cover`, `scene`, `script`, `lock`, `button`, `automation`, `media_player`, and dynamic `/api/services` discovery with `!` token expansion.
- [ ] **Dynamic Symbolic Icons**: Render domain- and state-specific icons (`lamp-symbolic.svg`, `switch-left-symbolic.svg`, etc.) from [`icons/`](./icons/).
- [ ] **State Caching / Debounce**: Cache `/api/states` responses with a short TTL to minimize network overhead on every keystroke.
