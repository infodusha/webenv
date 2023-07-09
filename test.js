import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert';
import fs from 'node:fs/promises';
import http from 'node:http';
import { main } from './lib/main.js';

describe('tests',   () => {
    let listenMock;
    let fakeCreateServer;

    function getResponse() {
        const requestHandler = fakeCreateServer.mock.calls[0].arguments[0];
        const res = {
            setHeader: mock.fn(),
            end: mock.fn(),
        };
        requestHandler(null, res);
        return res;
    }

    function getScript() {
        const res = getResponse();
        return res.end.mock.calls[0].arguments[0];
    }

    function setArgs(args = []) {
        process.argv = ['node', 'test.js', ...args];
    }

    beforeEach(() => {
        listenMock = mock.fn();
        fakeCreateServer = mock.fn(() => ({
            listen: listenMock,
        }));

        setArgs();

        async function fakeReadFile() {
            return `FOO=BAR`;
        }
        mock.method(fs, 'readFile', fakeReadFile);
        mock.method(http, 'createServer', fakeCreateServer);
    });

    afterEach(() => {
        mock.restoreAll();
    });

    it('Runs with defaults', async () => {
        await assert.doesNotReject(main);
        assert.strictEqual(listenMock.mock.calls[0].arguments[0], '8080'); // Port
        assert.strictEqual(fs.readFile.mock.calls[0].arguments[0], '.env'); // File
        assert.match(getScript(), /^const CONFIG = \{\n/); // Variable & Window & Compress
    });

    it('Serves with correct content type',  async () => {
        await main();
        assert.strictEqual(getResponse().setHeader.mock.calls[0].arguments[0], 'Content-Type');
        assert.strictEqual(getResponse().setHeader.mock.calls[0].arguments[1], 'application/javascript');
    });

    it('Reads file',  async () => {
        setArgs(['-f', '.env.test']);
        await main();
        assert.strictEqual(fs.readFile.mock.calls.length, 1);
        assert.strictEqual(fs.readFile.mock.calls[0].arguments[0], '.env.test');
    });

    it('Can do compression',  async () => {
        setArgs(['-c']);
        await main();
        assert.strictEqual(getScript(), `const CONFIG = {"FOO":"BAR"};`);
    });

    it('Can set as window',  async () => {
        setArgs(['-w']);
        await main();
        assert.match(getScript(), /^window\.CONFIG = \{\n/);
    });

    it('Overrides with process values',  async () => {
        process.env.FOO = 'BAZ';
        setArgs(['-c']);
        await main();
        assert.strictEqual(getScript(), `const CONFIG = {"FOO":"BAZ"};`);
    });

    it('Throws if TBD values',  async () => {
        mock.method(fs, 'readFile', async () => 'BAZ');
        await assert.rejects(main, /Value for 'BAZ' should be defined/);
    });
});
