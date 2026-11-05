import { VariantType } from './glib.js';

export function createMockSettings(initial = {}) {
    const store = {
        'server-address': 'http://homeassistant:8123',
        'api-key': 'test-token',
        'available-domains': [],
        'enabled-domains': [],
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
        get_strv(key) {
            return Array.isArray(store[key]) ? [...store[key]] : [];
        },
        set_string(key, val) {
            store[key] = String(val);
        },
        set_boolean(key, val) {
            store[key] = Boolean(val);
        },
        set_strv(key, val) {
            store[key] = Array.isArray(val) ? [...val] : [];
        },
        bind() {},
        settings_schema: {
            list_keys() {
                return Object.keys(store);
            },
            get_key(key) {
                const isBool = typeof store[key] === 'boolean';
                const isArray = Array.isArray(store[key]);
                return {
                    get_value_type() {
                        if (isArray) return new VariantType('as');
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
