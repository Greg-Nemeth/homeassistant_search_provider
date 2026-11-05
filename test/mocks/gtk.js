export class Button {
    constructor(props = {}) {
        this.label = props.label || '';
        this.valign = props.valign;
        this.sensitive = props.sensitive !== undefined ? props.sensitive : true;
        this._signals = new Map();
    }

    connect(signal, callback) {
        if (!this._signals.has(signal)) {
            this._signals.set(signal, []);
        }
        this._signals.get(signal).push(callback);
        return this._signals.get(signal).length;
    }

    click() {
        if (!this.sensitive) return;
        const handlers = this._signals.get('clicked') || [];
        for (const h of handlers) {
            h(this);
        }
    }
}

export const Align = {
    CENTER: 3,
};

export default {
    Button,
    Align,
};
