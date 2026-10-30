import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from 'gi://Gtk';

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
            setTimeout(() => {
                prioritizeSearchBtn.label = "Move to Top";
            }, 2000);
        });

        searchrow.add_suffix(prioritizeSearchBtn);
        searchGroup.add(searchrow);
        window.add(page);
        // Create a new preferences row
        const address = new Adw.EntryRow({
            title: _("Server Address"),
            text: settings.get_string("server-address") || "",
        });
        address.connect("notify::text", () => {
            settings.set_string("server-address", address.text.trim());
        });
        // row.show_apply_button = true;
        connectionGroup.add(address);
        const key = new Adw.EntryRow({
            title: _("Api Key"),
            text: settings.get_string("api-key") || "",
        });
        key.connect("notify::text", () => {
            settings.set_string("api-key", key.text.trim());
        });
        // row.show_apply_button = true;
        connectionGroup.add(key);

        // 2. Create a Preferences Group to hold your toggle switches
        const servicesGroup = new Adw.PreferencesGroup({
            title: "Services",
            description: "Enable or disable services below.",
        });
        page.add(servicesGroup);

        // 3. Create individual Switch Rows
        const lights = new Adw.SwitchRow({
            title: "lights",
            subtitle: "Show lights.",
        });

        const switches = new Adw.SwitchRow({
            title: "switches",
            subtitle: "Show switches.",
        });

        const sensors = new Adw.SwitchRow({
            title: "sensors",
            subtitle: "Show sensors.",
        });

        // 4. Add the rows to the group
        [lights, switches, sensors].forEach((row) => {
            servicesGroup.add(row);
            settings.bind(
                row.get_title(),
                row,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );
            row.connect("notify::active", () => {
                settings.set_boolean(row.title, row.get_active());
            });
        });

        settings.bind(
            "server-address",
            address,
            "active",
            Gio.SettingsBindFlags.DEFAULT,
        );
        settings.bind("api-key", key, "active", Gio.SettingsBindFlags.DEFAULT);
    }
}
