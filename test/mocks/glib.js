export class VariantType {
    constructor(type) {
        this.type = type;
    }

    static new(type) {
        return new VariantType(type);
    }

    equal(other) {
        return other && other.type === this.type;
    }
}

export class Bytes {
    constructor(uint8Array) {
        this._data = uint8Array;
    }

    static new(uint8Array) {
        return new Bytes(uint8Array);
    }

    get_data() {
        return this._data;
    }
}

export default {
    PRIORITY_DEFAULT: 0,
    VariantType,
    Bytes,
    build_filenamev: (parts) => parts.join('/'),
    get_user_data_dir: () => '/tmp/hasp-test',
    mkdir_with_parents: () => true,
    file_set_contents: () => true,
    unlink: () => 0,
};
