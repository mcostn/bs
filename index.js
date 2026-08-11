"use strict";

// Util
function getElementByIdOrThrow(id) {
    const out = document.getElementById(id);
    if (out === null || out === undefined) {
        throw new Error(`Failed to find element with id ${id}`);
    }

    return out;
}

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
        await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
        console.error("Service worker registration failed", err);
    }
}

// Query
async function search(str) {
    const urls = await getUrlsFromSearch(str);

    const [firstUrl] = urls;
    for (let idx = 1; idx < urls.length; idx++) {
        window.open(urls[idx], "_blank");
    }
    window.location.assign(firstUrl);
}

// UI
class UI {
    onSearch = null;

    async addToPage() {
        const body = document.body;
        if (body === null || body === undefined) {
            throw new Error("could not get body");
        }

        // Render
        const settings = await getSettings();
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
        settingsForm.addEventListener("submit", async e => {
            e.preventDefault();

            const data = new FormData(settingsForm);
            const defaultBang = data.get("default-bang");
            const theme = data.get("theme");

            await updateSettings({ defaultBang, theme });
            this.applyTheme(theme);
            settingsDialog.close();
        })

        this.applyTheme(settings.theme);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        if (theme === "auto") {
            const media = window.matchMedia("(prefers-color-scheme: dark)");
            root.dataset.theme = media.matches ? "dark" : "light";
        } else {
            root.dataset.theme = theme;
        }
    }

    html(settings = DEFAULT_SETTINGS) {
        return `
        <main class="min-h-screen flex flex-column justify-center">
            <div class="flex flex-column align-center">
                <div class="mb-1">
                    <img
                        src="img/logo.svg"
                        alt="logo"
                        class="max-w-lg">
                    <h1 class="text-xl text-center fg-bold mb-1">BangSearch</h1>
                </div>
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
                                    Default Bang
                                </label>
                                <div>
                                    <span>!</span>
                                    <input
                                        value="${settings.defaultBang}"
                                        type="text"
                                        class="input px-0.6 py-0.2"
                                        id="default-bang"
                                        name="default-bang" />
                                </div>
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
    registerServiceWorker();

    const url = new URL(window.location.href);
    const queryStr = url.searchParams.get("query")?.trim();
    if (queryStr) {
        await search(queryStr);
        return;
    }

    const ui = new UI();
    await ui.addToPage();
    ui.onSearch = search;
}

main().catch(e => console.error("Unexpected error\n", e));
