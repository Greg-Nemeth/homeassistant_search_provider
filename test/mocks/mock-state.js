export const mockState = {
    entities: [],
    requests: [],
    launchedUris: [],
    httpResponseStatus: 200,
    httpResponsePhrase: 'OK',

    reset() {
        this.entities = [];
        this.requests = [];
        this.launchedUris = [];
        this.httpResponseStatus = 200;
        this.httpResponsePhrase = 'OK';
    }
};
