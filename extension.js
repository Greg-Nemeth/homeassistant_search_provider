import SearchProvider from "./SearchProvider.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class TodoExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._provider = new SearchProvider({
            extension: this,
            settings: this._settings
        });
        Main.overview.searchController.addProvider(this._provider);
    }

    disable() {
        Main.overview.searchController.removeProvider(this._provider);
        this._provider?.destroy();
        this._provider = null;
        this._settings = null;
    }
}
