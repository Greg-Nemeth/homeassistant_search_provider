import Soup from "gi://Soup";
import St from "gi://St";
import Gio from "gi://Gio";
import GioUnix from "gi://GioUnix";
import GLib from "gi://GLib";
import QueryParser from "./QueryParser.js";
import ActionRegistry from "./ActionRegistry.js";

export default class SearchProvider {
    constructor(opts) {
        this._extension = opts.extension;
        // Reuse a single session instance instead of recreating on every keystroke
        this._httpSession = new Soup.Session();
        this._text_encoder = new TextEncoder();
        this._text_decoder = new TextDecoder();
        this._settings = opts.settings;
        this._entityCache = new Map();
        this._actionCache = new Map();
        this._servicesCache = null;
        this._ensureDesktopFile();
    }

    // In SearchProvider.js constructor
    _ensureDesktopFile() {
        const appsDir = GLib.build_filenamev([GLib.get_user_data_dir(), 'applications']);
        const desktopPath = GLib.build_filenamev([appsDir, 'hasp-home-assistant.desktop']);
        GLib.mkdir_with_parents(appsDir, 0o755);

        const iconPath = GLib.build_filenamev([
            this._extension.dir.get_path(),
            'icons',
            'ha-logo.svg'
        ]);

        // Omit NoDisplay=true so GNOME Shell accepts the provider
        const desktopContent = `[Desktop Entry]
    Version=1.0
    Type=Application
    Name=Home Assistant
    Icon=${iconPath}
    Exec=true
    NoDisplay=true
    Categories=Utility;
    `;

        try {
            GLib.file_set_contents(desktopPath, desktopContent);
            this._desktopPath = desktopPath;
        } catch (e) {
            console.error(`Failed to write desktop file: ${e.message}`);
        }
    }

    destroy() {
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
        if (this._desktopPath) {
            GLib.unlink(this._desktopPath);
            this._desktopPath = null;
        }
        this._entityCache?.clear();
        this._entityCache = null;
        this._actionCache?.clear();
        this._actionCache = null;
        this._servicesCache = null;
        this._settings = null;
        this._extension = null;
    }

    get appInfo() {
        const appInfo = GioUnix.DesktopAppInfo.new_from_filename(this._desktopPath);
        if (appInfo) {

                    appInfo.get_name = () => 'Home Assistant';
                    appInfo.should_show = () => true;
                    // Explicitly bind your custom SVG file as a FileIcon for the search header
                    const iconFile = this._extension.dir
                        .get_child('icons')
                        .get_child('ha-logo.svg');
                    appInfo.get_icon = () => new Gio.FileIcon({ file: iconFile });
                }
        return appInfo;
    }

    get title() {
        return "Home Assistant";
    }

    get canLaunchSearch() {
        return false;
    }

    launchSearch(terms) {
        console.debug("Opening Home Assistant in browser...");
        try {
            // Opens the default system browser to your Home Assistant URL
            Gio.AppInfo.launch_default_for_uri(this.haUrl, null);
        } catch (e) {
            console.error(`Failed to launch browser: ${e.message}`);
        }
    }

    get id() {
        return this._extension.uuid;
    }

    get haUrl() {
        return this._settings.get_string("server-address").replace(/\/+$/, "");
    }

    get haToken() {
        return this._settings.get_string("api-key");
    }

    activateResult(result, terms) {
        const cachedAction = this._actionCache?.get(result);
        const parsedAction = cachedAction || ActionRegistry.parseActionId(result);

        let domain;
        let service;
        let serviceData;

        if (parsedAction) {
            domain = parsedAction.domain;
            service = parsedAction.service;
            serviceData = parsedAction.serviceData;
        } else {
            const cachedEntity = this._entityCache?.get(result) || { entity_id: result };
            const defaultAction = ActionRegistry.getDefaultAction(cachedEntity);
            domain = defaultAction.domain;
            service = defaultAction.service;
            serviceData = defaultAction.serviceData;
        }

        this.fetch(`${this.haUrl}/api/services/${domain}/${service}`, {
            method: "POST",
            headers: [
                ["Authorization", `Bearer ${this.haToken}`],
                ["Content-Type", "application/json"],
            ],
            cancellable: Gio.Cancellable.get_current(),
            body: serviceData,
        })
            .then((res) => console.debug(`Successfully called ${domain}.${service} on ${result}:`, res))
            .catch((err) => console.error(`Failed to call ${domain}.${service} on ${result}:`, err));
    }

    createResultObject(meta) {
        return null;
    }

    getResultMetas(results, cancellable) {
        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(new Error("Operation Cancelled")),
            );

            const resultMetas = results.map((resultId) => {
                const action = this._actionCache?.get(resultId);
                if (action) {
                    const entity = this._entityCache?.get(action.entityId);
                    const baseName = entity?.friendly_name || action.entityId;
                    return {
                        id: resultId,
                        name: `${baseName} → ${action.label}`,
                        description: action.description,
                        clipboardText: action.entityId,
                        createIcon: (size) =>
                            new St.Icon({
                                icon_name: "dialog-information",
                                icon_size: size,
                            }),
                    };
                }

                const entity = this._entityCache?.get(resultId);
                return {
                    id: resultId,
                    name: entity?.friendly_name || resultId,
                    description: resultId,
                    clipboardText: resultId,
                    createIcon: (size) =>
                        new St.Icon({
                            icon_name: "dialog-information",
                            icon_size: size,
                        }),
                };
            });

            cancellable.disconnect(cancelledId);

            if (cancellable.is_cancelled()) {
                reject(new Error("Operation Cancelled"));
            } else {
                resolve(resultMetas);
            }
        });
    }

    _ensureServicesCatalog(cancellable) {
        if (this._servicesCache) {
            return Promise.resolve(this._servicesCache);
        }

        return this.fetch(`${this.haUrl}/api/services`, {
            method: "GET",
            headers: [["Authorization", `Bearer ${this.haToken}`]],
            cancellable: cancellable,
        })
            .then((response) => {
                const parsed = JSON.parse(response);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const catalog = {};
                    for (const entry of parsed) {
                        if (entry && entry.domain && entry.services) {
                            catalog[entry.domain] = entry.services;
                        }
                    }
                    this._servicesCache = catalog;
                    return catalog;
                }
                return null;
            })
            .catch(() => null);
    }

    getInitialResultSet(terms, cancellable) {
        const parsedQuery = QueryParser.parse(terms);
        const enabledDomains = this._settings.get_strv("enabled-domains");

        const statesPromise = this.fetch(`${this.haUrl}/api/states`, {
            method: "GET",
            headers: [["Authorization", `Bearer ${this.haToken}`]],
            cancellable: cancellable,
        }).then((response) => JSON.parse(response));

        const servicesPromise = parsedQuery.hasAction
            ? this._ensureServicesCatalog(cancellable)
            : Promise.resolve(this._servicesCache);

        return Promise.all([statesPromise, servicesPromise])
            .then(([array, servicesCatalog]) => {
                if (cancellable.is_cancelled()) {
                    throw new Error("Search Cancelled");
                }

                const matchedEntities = array
                    .filter((e) =>
                        enabledDomains.includes(e.entity_id.split(".")[0]),
                    )
                    .filter((e) =>
                        QueryParser.matchesEntity(e, parsedQuery.entityTerms),
                    );

                for (const r of matchedEntities) {
                    this._entityCache?.set(r.entity_id, {
                        entity_id: r.entity_id,
                        friendly_name: r.attributes?.friendly_name,
                        state: r.state,
                        attributes: r.attributes || {},
                    });
                }

                if (!parsedQuery.hasAction) {
                    return matchedEntities.map((r) => r.entity_id);
                }

                const actionIds = [];
                for (const entity of matchedEntities) {
                    const actions = ActionRegistry.resolveActions(
                        entity,
                        parsedQuery,
                        servicesCatalog,
                    );
                    for (const action of actions) {
                        this._actionCache?.set(action.id, action);
                        actionIds.push(action.id);
                    }
                }
                return actionIds;
            })
            .catch((err) => {
                if (!cancellable.is_cancelled()) {
                    console.error(
                        `SearchProvider getInitialResultSet error: ${err}`,
                    );
                }
                return [];
            });
    }

    getSubsearchResultSet(results, terms, cancellable) {
        if (cancellable.is_cancelled()) throw new Error("Search Cancelled");
        return this.getInitialResultSet(terms, cancellable);
    }

    filterResults(results, maxResults) {
        if (results.length <= maxResults) return results;
        return results.slice(0, maxResults);
    }

    /**
     * @typedef {[key: string, val: string]} Header
     * @typedef {{method: "GET"|"POST", headers: Header[], body: {Object}}} Options
     */
    /**
     *  @param{string} url
     *  @param{Options} options
     */
    fetch(url, options) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new(options.method, url);
            options.headers.forEach((header) =>
                message.request_headers.append(...header),
            );
            if (options.method === "POST" && options.body) {
                message.set_request_body_from_bytes(
                    null,
                    GLib.Bytes.new(
                        new TextEncoder().encode(JSON.stringify(options.body)),
                    ),
                );
            }

            this._httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                options.cancellable,
                (sess, res) => {
                    try {
                        const bytes = sess.send_and_read_finish(res);
                        const status = message.get_status();

                        if (status < 200 || status >= 300) {
                            reject(
                                new Error(
                                    `HTTP ${status}: ${message.get_reason_phrase()}`,
                                ),
                            );
                            return;
                        }

                        const text = this._text_decoder.decode(
                            bytes.get_data(),
                        );
                        resolve(text);
                    } catch (err) {
                        reject(err);
                    }
                },
            );
        });
    }
}
