export class ExtensionPreferences {
    constructor(metadata = {}) {
        this.metadata = metadata;
        this._settings = metadata.settings || null;
    }

    getSettings() {
        return this._settings;
    }
}

export const gettext = (str) => str;

export default {
    ExtensionPreferences,
    gettext,
};
