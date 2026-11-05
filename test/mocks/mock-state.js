export const mockState = {
    entities: [],
    services: [],
    requests: [],
    launchedUris: [],
    httpResponseStatus: 200,
    httpResponsePhrase: 'OK',

    reset() {
        this.entities = [];
        this.services = [];
        this.requests = [];
        this.launchedUris = [];
        this.httpResponseStatus = 200;
        this.httpResponsePhrase = 'OK';
    }
};
