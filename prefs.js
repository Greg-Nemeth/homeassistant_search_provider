import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import {
    ExtensionPreferences,
    gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class Preferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Create a preferences page, with a single group
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: _("General"),
            icon_name: "dialog-information-symbolic",
        });
        window.add(page);

        const connectionGroup = new Adw.PreferencesGroup({
            title: _("Connection Settings"),
            description: _(
                "Configure your connection to your Home Assistance instance",
            ),
        });
        page.add(connectionGroup);

        const searchGroup = new Adw.PreferencesGroup({
            title: "Search Integration",
        });
        page.add(searchGroup);

        const searchrow = new Adw.ActionRow({
            title: "Prioritize in Search",
            subtitle:
                "Move Home Assistant to the top of the GNOME Overview search results",
        });

        const prioritizeSearchBtn = new Gtk.Button({
            label: "Move to Top",
            valign: Gtk.Align.CENTER,
        });

        let prioritizeTimeoutId = null;

        prioritizeSearchBtn.connect("clicked", () => {
            const searchSettings = new Gio.Settings({
                schema_id: "org.gnome.desktop.search-providers",
            });
            const desktopId = "hasp-home-assistant.desktop";
            let currentOrder = searchSettings.get_strv("sort-order");

            currentOrder = currentOrder.filter((id) => id !== desktopId);
            currentOrder.unshift(desktopId);
            searchSettings.set_strv("sort-order", currentOrder);

            prioritizeSearchBtn.label = "Done!";
            if (prioritizeTimeoutId) {
                clearTimeout(prioritizeTimeoutId);
            }
            prioritizeTimeoutId = setTimeout(() => {
                prioritizeSearchBtn.label = "Move to Top";
                prioritizeTimeoutId = null;
            }, 2000);
        });

        searchrow.add_suffix(prioritizeSearchBtn);
        searchGroup.add(searchrow);

        // Create a new preferences row
        const address = new Adw.EntryRow({
            title: _("Server Address"),
            text: settings.get_string("server-address") || "",
        });
        // row.show_apply_button = true;
        connectionGroup.add(address);

        const key = new Adw.EntryRow({
            title: _("Api Key"),
            text: settings.get_string("api-key") || "",
        });
        // row.show_apply_button = true;
        connectionGroup.add(key);

        const scanRow = new Adw.ActionRow({
            title: _("Scan Domains"),
            subtitle: _(
                "Fetch available entity domains from your Home Assistant instance",
            ),
        });

        const scanBtn = new Gtk.Button({
            label: _("Scan"),
            valign: Gtk.Align.CENTER,
            sensitive: Boolean(address.text.trim() && key.text.trim()),
        });

        const updateScanSensitivity = () => {
            scanBtn.sensitive = Boolean(
                address.text.trim() && key.text.trim(),
            );
        };

        address.connect("notify::text", () => {
            settings.set_string("server-address", address.text.trim());
            updateScanSensitivity();
        });

        key.connect("notify::text", () => {
            settings.set_string("api-key", key.text.trim());
            updateScanSensitivity();
        });

        scanRow.add_suffix(scanBtn);
        connectionGroup.add(scanRow);

        // 2. Create a Preferences Group to hold your toggle switches
        const servicesGroup = new Adw.PreferencesGroup({
            title: "Services",
            description: "Enable or disable services below.",
        });
        page.add(servicesGroup);

        let domainRows = [];

        const populateServicesGroup = (domains) => {
            for (const existingRow of domainRows) {
                servicesGroup.remove(existingRow);
            }
            domainRows = [];

            const enabledDomains = new Set(
                settings.get_strv("enabled-domains"),
            );

            for (const domain of domains) {
                const row = new Adw.SwitchRow({
                    title: domain,
                    subtitle: `Show ${domain}.`,
                    active: enabledDomains.has(domain),
                });

                row.connect("notify::active", () => {
                    const currentEnabled = new Set(
                        settings.get_strv("enabled-domains"),
                    );
                    if (row.get_active()) {
                        currentEnabled.add(domain);
                    } else {
                        currentEnabled.delete(domain);
                    }
                    settings.set_strv("enabled-domains", [
                        ...currentEnabled,
                    ]);
                });

                servicesGroup.add(row);
                domainRows.push(row);
            }
        };

        // Populate with any previously scanned domains stored in GSettings
        populateServicesGroup(settings.get_strv("available-domains"));

        const httpSession = new Soup.Session();
        const textDecoder = new TextDecoder();

        window.connect?.("close-request", () => {
            if (prioritizeTimeoutId) {
                clearTimeout(prioritizeTimeoutId);
                prioritizeTimeoutId = null;
            }
            httpSession.abort();
        });

        scanBtn.connect("clicked", () => {
            const haUrl = settings
                .get_string("server-address")
                .trim()
                .replace(/\/+$/, "");
            const haToken = settings.get_string("api-key").trim();

            if (!haUrl || !haToken) {
                return;
            }

            scanBtn.label = _("Scanning...");
            scanBtn.sensitive = false;

            const message = Soup.Message.new("GET", `${haUrl}/api/states`);
            message.request_headers.append(
                "Authorization",
                `Bearer ${haToken}`,
            );

            httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (sess, res) => {
                    try {
                        const bytes = sess.send_and_read_finish(res);
                        const status = message.get_status();

                        if (status < 200 || status >= 300) {
                            throw new Error(
                                `HTTP ${status}: ${message.get_reason_phrase()}`,
                            );
                        }

                        const text = textDecoder.decode(bytes.get_data());
                        const states = JSON.parse(text);
                        const domains = [
                            ...new Set(
                                states
                                    .map(
                                        (entity) =>
                                            entity.entity_id?.split(".")[0],
                                    )
                                    .filter(Boolean),
                            ),
                        ].sort();

                        settings.set_strv("available-domains", domains);

                        // Preserve previously enabled domains that still exist
                        const preservedEnabled = settings
                            .get_strv("enabled-domains")
                            .filter((d) => domains.includes(d));
                        settings.set_strv("enabled-domains", preservedEnabled);

                        populateServicesGroup(domains);
                        scanBtn.label = _("Scan");
                    } catch (err) {
                        console.error(`Failed to scan domains: ${err}`);
                        scanBtn.label = _("Scan Failed");
                    } finally {
                        updateScanSensitivity();
                    }
                },
            );
        });
    }
}
