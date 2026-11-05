import { Given, When, Then, Before } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import SearchProvider from '../../SearchProvider.js';
import { createMockSettings, createMockExtension } from '../../test/mocks/settings-helper.js';
import { mockState } from '../../test/mocks/mock-state.js';
import Gio from 'gi://Gio';

let settings;
let provider;
let searchResults = [];
let metadataResults = [];

Before(() => {
    mockState.reset();
    settings = createMockSettings();
    provider = new SearchProvider({
        extension: createMockExtension(),
        settings,
    });
    searchResults = [];
    metadataResults = [];
});

Given('Home Assistant server is configured at {string}', (url) => {
    settings.set_string('server-address', url);
});

Given('a valid API key {string} is set', (key) => {
    settings.set_string('api-key', key);
});

Given('the following Home Assistant entities exist:', (dataTable) => {
    mockState.entities = dataTable.hashes().map((row) => ({
        entity_id: row.entity_id,
        state: row.state,
        attributes: {friendly_name: row.friendly_name}
    }));
});

Given('the {string} domain is enabled', (domain) => {
    settings.set_boolean(domain, true);
});

Given('the {string} domain is disabled', (domain) => {
    settings.set_boolean(domain, false);
});

Given('the search provider has matching results:', (dataTable) => {
    searchResults = dataTable.hashes();
});

When('the user searches for {string}', async (termsString) => {
    const terms = termsString.split(' ').filter(Boolean);
    searchResults = await provider.getInitialResultSet(terms, new Gio.Cancellable());
});

When('the search provider limits results to {int}', (maxResults) => {
    searchResults = provider.filterResults(searchResults, maxResults);
});

When('the user activates the result {string}', async (entityId) => {
    provider.activateResult(entityId, []);
    // Allow asynchronous dispatch to complete in mock Soup session
    await new Promise((resolve) => setTimeout(resolve, 50));
});

When('the overview requests metadata for the results', async () => {
    metadataResults = await provider.getResultMetas(searchResults, new Gio.Cancellable());
});

When('the user launches the search provider', () => {
    provider.launchSearch([]);
});

Then('the search results should be:', (dataTable) => {
    // const expected = dataTable.raw().map((row) => row[0]);
    const expected = dataTable.hashes();
    assert.deepEqual(searchResults, expected);
});

Then('the search results should be empty', () => {
    assert.deepEqual(searchResults, []);
});

Then('exactly {int} result should be returned', (count) => {
    assert.equal(searchResults.length, count);
});

Then('a POST request should be sent to {string}', (expectedUrl) => {
    const request = mockState.requests.find(
        (r) => r.method === 'POST' && r.url === expectedUrl
    );
    assert.ok(
        request,
        `Expected POST request to ${expectedUrl}, but recorded requests were: ${JSON.stringify(mockState.requests)}`
    );
});

Then('the request should have header {string} with bearer token {string}', (headerName, token) => {
    const request = mockState.requests[mockState.requests.length - 1];
    assert.ok(request, 'No request was recorded');
    const headerVal = request.headers[headerName.toLowerCase()];
    assert.equal(headerVal, `Bearer ${token}`);
});

Then('the request body should be:', (expectedBodyString) => {
    const request = mockState.requests[mockState.requests.length - 1];
    assert.ok(request, 'No request was recorded');
    const expected = JSON.parse(expectedBodyString.trim());
    assert.deepEqual(request.body, expected);
});

Then('the metadata for {string} should have:', (entity, dataTable) => {
    const meta = metadataResults.find((m) => m.id === entity);
    assert.ok(meta, `No metadata found for ${entity}`);
    for (const [key, expectedValue] of dataTable.raw()) {
        assert.equal(
            meta[key],
            expectedValue,
            `Expected ${key} to be "${expectedValue}", got "${meta[key]}"`
        );
    }
});

Then('the system default browser should be launched with {string}', (expectedUri) => {
    assert.ok(
        mockState.launchedUris.includes(expectedUri),
        `Expected browser launch for ${expectedUri}, launched: ${JSON.stringify(mockState.launchedUris)}`
    );
});
