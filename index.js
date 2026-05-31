"use strict"

// Settings
const DEFAULT_SETTINGS = Object.freeze({
    defaultBang: 'g',
    theme: "auto",
});

function getSettings() {
    let out = localStorage.getItem("settings");
    if (!out) {
        out = DEFAULT_SETTINGS;
        localStorage.setItem("settings", JSON.stringify(out));
    } else {
        out = JSON.parse(out);
    }
    return out;
}

function updateSettings(newSettings) {
    const settings = getSettings();
    for (const [key, value] of Object.entries(newSettings)) {
        if (key in settings) {
            settings[key] = value;
        }
    }

    localStorage.setItem("settings", JSON.stringify(settings));
}

// Util
function getElementByIdOrThrow(id) {
    const out = document.getElementById(id);
    if (out === null || out === undefined) {
        throw new Error(`Failed to find element with id ${id}`);
    }

    return out;
}

function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// Query
let _allBangsPromise = null;
async function getAllBangs() {
    if (!_allBangsPromise) {
        _allBangsPromise = fetch("./bangs/ddg.json")
            .then(r => {
                if (!r.ok) {
                    throw new Error(`Failed to fetch bangs: ${r.status}`);
                }
                return r.json();
            })
            .catch(err => {
                _allBangsPromise = null;
                throw err;
            })
    }

    return _allBangsPromise;
}

class QueryParser {
    buff;
    cursor;

    constructor(str) {
        this.buff = str;
        this.cursor = 0;
    }

    async parse() {
        const out = { text: "", bangs: [] };

        while (!this.isEOF()) {
            let ch = this.top();
            if (ch == '!') {
                const bang = this.getBang();
                if (bang !== null) out.bangs.push(bang);
                else out.text += '!';
                continue;
            }

            out.text += ch;
            this.next();
        }
        out.text = out.text.trim();

        if (out.bangs.length <= 0) {
            out.bangs.push(DEFAULT_SETTINGS.defaultBang);
        }

        const allBangs = await getAllBangs();
        out.bangs = out.bangs.map(b => {
            for (const bang of allBangs) {
                if (bang.t === b) {
                    return bang;
                }
            }

            return null;
        });

        out.bangs = out.bangs.filter(b => b !== null);

        return out;
    }

    getBang() {
        if (this.top() != '!') return null;

        this.next();
        if (this.top() == '!') {
            this.next();
            return "!";
        }

        let out = "";
        while (!this.isEOF()) {
            const ch = this.top();
            if (isWhitespace(ch) || ch === '!') break;
            out += ch;
            this.next();
        }

        if (out === undefined || out.length === 0) {
            return null;
        }
        return out.toLowerCase();
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

async function search(str) {
    const parser = new QueryParser(str);
    const query = await parser.parse();
    const urls = query.bangs.map(bang => bang.u.replace("{{{s}}}", query.text));

    const settings = getSettings();

    const [firstUrl] = urls;
    for (let idx = 1; idx < urls.length; idx++) {
        window.open(urls[idx], "_blank");
    }
    window.location.assign(firstUrl);
}

// UI
class UI {
    onSearch = null;

    addToPage() {
        const body = document.body;
        if (body === null || body === undefined) {
            throw new Error("could not get body");
        }

        // Render
        const settings = getSettings();
        body.innerHTML = this.html(settings);
        const themeSelect = getElementByIdOrThrow("theme");
        themeSelect.value = settings.theme;

        // Events
        const queryForm = getElementByIdOrThrow("query-form");
        queryForm.addEventListener("submit", e => {
            e.preventDefault();

            const data = new FormData(queryForm);
            const queryStr = data.get("query")?.trim();
            if (queryStr && queryStr.length > 0) {
                this.onSearch && this.onSearch(queryStr);
            }
        });

        const settingsDialog = getElementByIdOrThrow("settings-dialog");
        const settingsForm = getElementByIdOrThrow("settings-form");
        settingsForm.addEventListener("submit", e => {
            e.preventDefault();

            const data = new FormData(settingsForm);
            const defaultBang = data.get("default-bang");
            const theme = data.get("theme");

            updateSettings({ defaultBang, theme });
            settingsDialog.close();
        })
    }

    html(settings = DEFAULT_SETTINGS) {
        return `
        <main class="min-h-screen flex flex-column justify-center">
            <div class="flex flex-column align-center">
                <h1 class="text-xl fg-bold mb-1">BangSearch</h1>
                <form class="w-full px-0.6 flex justify-center" id="query-form">
                    <input
                      type="text"
                      name="query"
                      class="input w-full max-w-xl px-1.2 py-0.8"
                      placeholder="Search something"
                      minlength="2"
                      autofocus />
                </form>
                <div class="mt-1 space-x">
                    <button
                        class="button"
                        command="show-modal"
                        commandfor="settings-dialog">
                        Settings
                    </button>
                    <a
                        class="button"
                        href="https://github.com/mcostn/bs"
                        target="_blank">
                        Source Code
                    </a>
                </div>
            </div>
            <div>
                <dialog class="popup" id="settings-dialog">
                    <h2 class="fg-bold mb-1 text-lg">Settings</h2>

                    <form id="settings-form">
                        <div class="space-y">
                            <div class="setting">
                                <label
                                    for="default-bang"
                                    class="fg-muted">
                                    Default Bangs
                                </label>
                                <input
                                    value="${settings.defaultBang}"
                                    type="text"
                                    class="input px-0.6 py-0.2"
                                    id="default-bang"
                                    name="default-bang" />
                            </div>
                            <div class="setting">
                                <label for="theme" class="fg-muted">Theme</label>
                                <select
                                    class="input px-0.6 py-0.2"
                                    id="theme"
                                    name="theme">
                                    <option value="auto">Auto</option>
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </div>
                        </div>

                        <div class="mt-1 space-x">
                            <button
                                    type="button"
                                    class="button"
                                    command="close"
                                    commandfor="settings-dialog">
                                Cancel
                            </button>
                            <button
                                    type="submit"
                                    class="button">
                                Save
                            </button>
                        </div>
                    </form>
                </dialog>
            </div>
        </main>`;
    }
}

// Entry Point
async function main() {
    const url = new URL(window.location.href);
    const queryStr = url.searchParams.get("query")?.trim();
    if (queryStr) {
        search(queryStr);
        return;
    }

    const ui = new UI();
    ui.addToPage();
    ui.onSearch = search;
}

main().catch(e => console.error("Unexpected error\n", e));
