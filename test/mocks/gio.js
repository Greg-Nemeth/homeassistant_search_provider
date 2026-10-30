import { mockState } from './mock-state.js';

export class MockCancellable {
    constructor() {
        this._cancelled = false;
        this._listeners = new Map();
        this._nextId = 1;
    }

    static get_current() {
        return new MockCancellable();
    }

    cancel() {
        this._cancelled = true;
        for (const cb of this._listeners.values()) {
            cb();
        }
    }

    is_cancelled() {
        return this._cancelled;
    }

    connect(callback) {
        const id = this._nextId++;
        this._listeners.set(id, callback);
        return id;
    }

    disconnect(id) {
        this._listeners.delete(id);
    }
}

export class MockFileIcon {
    constructor(opts) {
        this.file = opts && opts.file;
    }
}

export const AppInfo = {
    launch_default_for_uri(uri, context) {
        mockState.launchedUris.push(uri);
        return true;
    },
};

export default {
    Cancellable: MockCancellable,
    FileIcon: MockFileIcon,
    AppInfo,
    SettingsBindFlags: { DEFAULT: 0 },
};
