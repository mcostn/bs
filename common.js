"use strict";

// IndexedDB
const DB_NAME = 'bangsearch';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let _dbPromise = null;
function openDB() {
    if (!_dbPromise) {
        _dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE_NAME);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return _dbPromise;
}

async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(key, val) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Util
async function getSaved(key, defaultVal = null) {
    try {
        const val = await idbGet(key);
        return val === null || val === undefined ? defaultVal : val;
    } catch {
        return defaultVal;
    }
}

async function setSaved(key, val) {
    return idbSet(key, val);
}

function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// Settings
const DEFAULT_SETTINGS = Object.freeze({
    defaultBang: 'g',
    theme: 'auto',
    luckyEngine: 'google',
});

async function getSettings() {
    const saved = await getSaved('settings', DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...saved };
}

async function updateSettings(newSettings) {
    const current = await getSettings();
    await setSaved('settings', { ...current, ...newSettings });
}

// Query
class QueryParser {
    buff;
    cursor;

    constructor(str) {
        this.buff = str;
        this.cursor = 0;
    }

    parse() {
        const out = { text: '', bangs: [], lucky: false };

        let peek = this.cursor;
        while (peek < this.buff.length && isWhitespace(this.buff[peek])) peek++;
        if (this.buff[peek] === '\\') {
            out.lucky = true;
            this.cursor = peek + 1;
        }

        let atWordStart = true;
        while (!this.isEOF()) {
            let ch = this.top();

            if (ch === '!') {
                const bang = this.getPrefixBang();
                if (bang !== null) {
                    out.bangs.push(bang);
                    atWordStart = true;
                    continue;
                }

                out.lucky = true;
                atWordStart = false;
                continue;
            }

            if (atWordStart) {
                const bang = this.getSuffixBang();
                if (bang !== null) {
                    out.bangs.push(bang);
                    atWordStart = true;
                    continue;
                }
            }

            out.text += ch;
            this.next();
        }
        out.text = out.text.trim();

        return out;
    }

    getPrefixBang() {
        if (this.top() !== '!') return null;

        this.next();
        if (this.top() === '!') {
            this.next();
            return '!';
        }

        let out = '';
        while (!this.isEOF()) {
            const ch = this.top();
            if (isWhitespace(ch) || ch === '!') break;
            out += ch;
            this.next();
        }

        if (out.length === 0) {
            return null;
        }
        return out.toLowerCase();
    }

    getSuffixBang() {
        const start = this.cursor;
        let name = '';

        while (!this.isEOF()) {
            const ch = this.top();

            if (ch === '!') {
                if (name.length === 0) {
                    this.cursor = start;
                    return null;
                }

                this.next();
                if (!this.isEOF() && !isWhitespace(this.top())) {
                    this.cursor = start;
                    return null;
                }

                return name.toLowerCase();
            }

            if (isWhitespace(ch)) break;

            name += ch;
            this.next();
        }

        this.cursor = start;
        return null;
    }

    isEOF() {
        return this.cursor >= this.buff.length;
    }

    top() {
        return this.buff[this.cursor];
    }

    next() {
        return this.buff[this.cursor++];
    }
}

let _allBangsPromise = null;
async function getAllBangs() {
    if (!_allBangsPromise) {
        _allBangsPromise = fetch('./bangs/ddg.json')
            .then(r => {
                if (!r.ok) {
                    throw new Error(`Failed to fetch bangs: ${r.status}`);
                }
                return r.json();
            })
            .catch(err => {
                _allBangsPromise = null;
                throw err;
            });
    }

    return _allBangsPromise;
}

let _bangsMapPromise = null;
async function getBangMap() {
    if (!_bangsMapPromise) {
        _bangsMapPromise = getAllBangs().then(bangs => new Map(bangs.map(b => [b.t, b])));
    }

    return _bangsMapPromise;
}

async function resolveBangs(query, bangMap, settings) {
    const resolved = [];

    for (const b of query.bangs) {
        if (b === '!') {
            const lastBang = await getSaved('last-bang');
            if (lastBang) {
                const bang = bangMap.get(lastBang);
                if (bang) resolved.push(bang);
            }
        } else {
            const bang = bangMap.get(b);
            if (bang) resolved.push(bang);
        }
    }

    if (!query.lucky && resolved.length === 0) {
        const def = bangMap.get(settings.defaultBang);
        if (def) resolved.push(def);
    }

    query.bangs = resolved;
    return query;
}

function buildRedirectUrls(query, settings) {
    const out = [];

    if (query.lucky && query.text) {
        out.push(getLuckyUrl(settings.luckyEngine, query.text));
    }

    out.push(...query.bangs.map(bang => {
        if (query.text)
            return bang.u.replace('{{{s}}}', encodeURIComponent(query.text));
        return new URL(bang.u).origin;
    }));

    return out;
}

const LUCKY_ENGINES = Object.freeze({
    google: Object.freeze({
        label: 'Google',
        url: text => `https://www.google.com/search?q=${encodeURIComponent(text)}&btnI=1`,
    }),
    duckduckgo: Object.freeze({
        label: 'DuckDuckGo',
        url: text => `https://duckduckgo.com/?q=${encodeURIComponent('\\' + text)}`,
    }),
});

function getLuckyUrl(engineId, text) {
    const engine = LUCKY_ENGINES[engineId] ?? LUCKY_ENGINES[DEFAULT_SETTINGS.luckyEngine];
    return engine.url(text);
}

async function getUrlsFromSearch(queryStr) {
    const parser = new QueryParser(queryStr);
    const query = parser.parse();

    const [settings, bangMap] = await Promise.all([
        getSettings(),
        getBangMap()
    ]);
    await resolveBangs(query, bangMap, settings);

    if (query.bangs.length > 0) {
        const lastBang = query.bangs[query.bangs.length - 1].t;
        await setSaved("last-bang", lastBang);
    }

    return buildRedirectUrls(query, settings);
}
