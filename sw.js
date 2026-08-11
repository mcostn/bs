"use strict";

importScripts("./common.js");

const BANGS_CACHE = "bangsearch-bangs-v1";
const BANGS_URL = "./bangs/ddg.json";

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        try {
            const res = await fetch(BANGS_URL);
            if (res.ok) {
                const cache = await caches.open(BANGS_CACHE);
                await cache.put(BANGS_URL, res.clone());
            }
        } catch (err) {
            console.error("Failed to warm bangs cache", err);
        }
    })());
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

let _swBangMapPromise = null;
async function getBangMapFast() {
    if (!_swBangMapPromise) {
        _swBangMapPromise = (async () => {
            const cache = await caches.open(BANGS_CACHE);
            let res = await cache.match(BANGS_URL);
            if (!res) {
                res = await fetch(BANGS_URL);
                if (res.ok) await cache.put(BANGS_URL, res.clone());
            }
            const bangs = await res.json();
            return new Map(bangs.map(b => [b.t, b]));
        })().catch(err => {
            _swBangMapPromise = null;
            throw err;
        });
    }
    return _swBangMapPromise;
}

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.mode !== "navigate") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const queryStr = url.searchParams.get("query")?.trim();
    if (!queryStr) return;

    event.respondWith(handleSearchNavigation(queryStr, request));
});

async function handleSearchNavigation(queryStr, request) {
    try {
        const urls = await getUrlsFromSearch(queryStr);
        if (urls.length === 1) return Response.redirect(urls[0], 302);
        return fetch(request);
    } catch (err) {
        console.error("SW search redirect failed, falling back to page", err);
        return fetch(request);
    }
}
