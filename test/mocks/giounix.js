export class DesktopAppInfo {
    constructor(filename) {
        this.filename = filename;
    }

    static new_from_filename(filename) {
        return new DesktopAppInfo(filename);
    }

    get_name() {
        return 'Home Assistant';
    }

    should_show() {
        return true;
    }

    get_icon() {
        return null;
    }
}

export default {
    DesktopAppInfo,
};
