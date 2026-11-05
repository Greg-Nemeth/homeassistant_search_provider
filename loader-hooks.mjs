import { pathToFileURL } from 'node:url';

const MOCK_MAP = new Map([
    ['gi://Soup', './test/mocks/soup.js'],
    ['gi://GLib', './test/mocks/glib.js'],
    ['gi://GioUnix', './test/mocks/giounix.js'],
    ['gi://Gio', './test/mocks/gio.js'],
    ['gi://St', './test/mocks/st.js'],
    ['gi://Adw', './test/mocks/adw.js'],
    ['gi://Gtk', './test/mocks/gtk.js'],
    ['resource:///org/gnome/shell/ui/main.js', './test/mocks/shell-main.js'],
    ['resource:///org/gnome/shell/extensions/extension.js', './test/mocks/shell-extension.js'],
    ['resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js', './test/mocks/shell-prefs.js'],
    ['resource:///org/gnome/shell/ui/search.js', './test/mocks/shell-search.js'],
]);

const FALLBACK_DATA_URI = `data:text/javascript,${encodeURIComponent('export default {}; export const Extension = class {};')}`;

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('gi:') || specifier.startsWith('resource:')) {
        // Strip query params like ?version=3.0
        const [cleanSpecifier] = specifier.split('?');

        for (const [prefix, mockPath] of MOCK_MAP.entries()) {
            if (cleanSpecifier === prefix || cleanSpecifier.startsWith(prefix)) {
                return {
                    shortCircuit: true,
                    url: pathToFileURL(mockPath).href,
                };
            }
        }

        return {
            shortCircuit: true,
            url: FALLBACK_DATA_URI,
        };
    }

    return nextResolve(specifier, context);
}
