import { mockState } from './mock-state.js';

class MockMessageHeaders {
    constructor() {
        this._headers = new Map();
    }

    append(name, value) {
        this._headers.set(name.toLowerCase(), value);
    }

    get(name) {
        return this._headers.get(name.toLowerCase());
    }

    getAll() {
        return Object.fromEntries(this._headers.entries());
    }
}

export class MockMessage {
    constructor(method, url) {
        this.method = method;
        this.url = url;
        this.request_headers = new MockMessageHeaders();
        this._body = null;
        this._status = 200;
        this._reasonPhrase = 'OK';
    }

    static new(method, url) {
        return new MockMessage(method, url);
    }

    set_request_body_from_bytes(contentType, bytes) {
        this._bodyBytes = bytes;
        if (bytes && bytes.get_data) {
            const decoder = new TextDecoder();
            const text = decoder.decode(bytes.get_data());
            try {
                this._body = JSON.parse(text);
            } catch {
                this._body = text;
            }
        }
    }

    get_status() {
        return mockState.httpResponseStatus || 200;
    }

    get_reason_phrase() {
        return mockState.httpResponsePhrase || 'OK';
    }
}

export class MockSession {
    send_and_read_async(message, priority, cancellable, callback) {
        setImmediate(() => {
            if (cancellable && cancellable.is_cancelled && cancellable.is_cancelled()) {
                callback(this, { error: new Error('Cancelled') });
                return;
            }

            // Record request
            mockState.requests.push({
                method: message.method,
                url: message.url,
                headers: message.request_headers.getAll(),
                body: message._body,
            });

            // Prepare response data
            let responseData = '[]';
            if (message.url.endsWith('/api/states')) {
                responseData = JSON.stringify(mockState.entities);
            } else if (message.url.includes('/api/services/')) {
                responseData = JSON.stringify({ message: 'Service called' });
            }

            const encoder = new TextEncoder();
            const bytes = encoder.encode(responseData);

            callback(this, {
                bytes: {
                    get_data: () => bytes,
                },
            });
        });
    }

    send_and_read_finish(res) {
        if (res.error) {
            throw res.error;
        }
        return res.bytes;
    }

    abort() {}
}

export default {
    Message: MockMessage,
    Session: MockSession,
};
