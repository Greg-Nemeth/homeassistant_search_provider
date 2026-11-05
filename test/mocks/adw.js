class MockWidget {
    constructor(props = {}) {
        this._signals = new Map();
        Object.assign(this, props);
    }

    connect(signal, callback) {
        if (!this._signals.has(signal)) {
            this._signals.set(signal, []);
        }
        this._signals.get(signal).push(callback);
        return this._signals.get(signal).length;
    }

    emit(signal, ...args) {
        const handlers = this._signals.get(signal) || [];
        for (const h of handlers) {
            h(this, ...args);
        }
    }
}

export class PreferencesPage extends MockWidget {
    constructor(props = {}) {
        super(props);
        this.groups = [];
    }

    add(group) {
        this.groups.push(group);
    }
}

export class PreferencesGroup extends MockWidget {
    constructor(props = {}) {
        super(props);
        this.rows = [];
    }

    add(row) {
        this.rows.push(row);
    }

    remove(row) {
        this.rows = this.rows.filter((r) => r !== row);
    }

    get_title() {
        return this.title;
    }
}

export class ActionRow extends MockWidget {
    constructor(props = {}) {
        super(props);
        this.suffixes = [];
    }

    add_suffix(widget) {
        this.suffixes.push(widget);
    }
}

export class EntryRow extends MockWidget {
    constructor(props = {}) {
        super({ text: '', ...props });
    }

    set_text(val) {
        this.text = val;
        this.emit('notify::text');
    }
}

export class SwitchRow extends MockWidget {
    constructor(props = {}) {
        super({ active: false, ...props });
    }

    get_title() {
        return this.title;
    }

    get_active() {
        return Boolean(this.active);
    }

    set_active(val) {
        this.active = Boolean(val);
        this.emit('notify::active');
    }
}

export default {
    PreferencesPage,
    PreferencesGroup,
    ActionRow,
    EntryRow,
    SwitchRow,
};
