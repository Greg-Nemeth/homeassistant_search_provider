import { VariantType } from './glib.js';

export function createMockSettings(initial = {}) {
    const store = {
        'server-address': 'http://homeassistant:8123',
        'api-key': 'test-token',
        'lights': true,
        'switches': true,
        'sensors': true,
        ...initial,
    };

    return {
        _store: store,
        get_string(key) {
            return store[key] !== undefined ? String(store[key]) : '';
        },
        get_boolean(key) {
            return Boolean(store[key]);
        },
        set_string(key, val) {
            store[key] = String(val);
        },
        set_boolean(key, val) {
            store[key] = Boolean(val);
        },
        settings_schema: {
            list_keys() {
                return Object.keys(store);
            },
            get_key(key) {
                const isBool = typeof store[key] === 'boolean';
                return {
                    get_value_type() {
                        return new VariantType(isBool ? 'b' : 's');
                    },
                };
            },
        },
    };
}

export function createMockExtension(uuid = 'hasp@greg.rum-and-code') {
    return {
        uuid,
        dir: {
            get_path() {
                return '/tmp/hasp-test-dir';
            },
            get_child(childName) {
                return {
                    get_path() {
                        return `/tmp/hasp-test-dir/${childName}`;
                    },
                    get_child(subChildName) {
                        return {
                            get_path() {
                                return `/tmp/hasp-test-dir/${childName}/${subChildName}`;
                            },
                        };
                    },
                };
            },
        },
    };
}
