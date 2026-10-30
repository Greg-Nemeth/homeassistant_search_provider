import Soup from "gi://Soup?version=3.0";
import St from "gi://St";
import Gio from "gi://Gio";
import GioUnix from "gi://GioUnix";
import GLib from "gi://GLib";
import * as Search from "resource:///org/gnome/shell/ui/search.js";
import Clutter from "gi://Clutter";
import Pango from "gi://Pango";

export default class SearchProvider {
    constructor(opts) {
        this._extension = opts.extension;
        // Reuse a single session instance instead of recreating on every keystroke
        this._httpSession = new Soup.Session();
        this._text_encoder = new TextEncoder();
        this._text_decoder = new TextDecoder();
        this._settings = opts.settings;
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
        console.log(`Opening Home Assistant in browser...`);
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
        console.log(`activateResult(${result})`);

        // result is "light.loft_lavalamp"
        const [domain] = result.split(".");

        this.fetch(`${this.haUrl}/api/services/${domain}/toggle`, {
            method: "POST",
            headers: [
                ["Authorization", `Bearer ${this.haToken}`],
                ["Content-Type", "application/json"],
            ],
            cancellable: Gio.Cancellable.get_current(),
            body: { entity_id: result },
        })
            .then((res) => console.log(`Successfully toggled ${result}:`, res))
            .catch((err) => console.error(`Failed to toggle ${result}:`, err));
    }

    createResultObject(meta) {
        return null;
    }

    getResultMetas(results, cancellable) {
        console.error(`createResultMetas(${results})`);
        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(new Error("Operation Cancelled")),
            );

            const resultMetas = results.map((entityId) => {
                return {
                    id: entityId,
                    name: entityId,
                    description: entityId,
                    clipboardText: entityId,
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

    getInitialResultSet(terms, cancellable) {
        const lowerTerms = terms.map((t) => t.toLowerCase());
        const schema = this._settings.settings_schema;

        // 2. Get all keys defined in your xml schema file
        const allKeys = schema.list_keys();

        // 3. Filter for keys where the type matches GVariant "b" (boolean)
        const booleanKeys = allKeys.filter((keyName) => {
            const keyInfo = schema.get_key(keyName);
            const valueType = keyInfo.get_value_type();
            return (
                valueType.equal(GLib.VariantType.new("b")) &&
                this._settings.get_boolean(keyName)
            );
        });

        return this.fetch(`${this.haUrl}/api/states`, {
            method: "GET",
            headers: [["Authorization", `Bearer ${this.haToken}`]],
            cancellable: cancellable,
        })
            .then((response) => JSON.parse(response))
            .then((array) => {
                if (cancellable.is_cancelled()) {
                    throw new Error("Search Cancelled");
                }

                // console.error(`in getInitialResultset: ${JSON.stringify(array.map(e => e.entity_id))}`);
                return array
                    .map((elem) => elem.entity_id)
                    .filter((id) =>
                        booleanKeys.some((t) => t.match(id.split(".")[0])),
                    )
                    .filter((id) =>
                        lowerTerms.every((term) =>
                            id.toLowerCase().includes(term),
                        ),
                    );
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
