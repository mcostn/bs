"use strict"

// Constants
const DEFAULT_SETTINGS = {
    defaultBang: 'g',
};

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
                out.bangs.push(bang);
                continue;
            }

            out.text += ch;
            this.next();
        }
        out.text = out.text.trim();

        if (out.bangs.length <= 0) {
            console.log(DEFAULT_SETTINGS.defaultBang);
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
    let openFn = (str) => window.location.replace(str);
    if (urls.length > 1) {
        openFn = (str) => window.open(str, "_blank");
    }

    for (const url of urls) {
        openFn(url);
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

    const queryForm = getElementByIdOrThrow("query-form");
    queryForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const data = new FormData(queryForm);
        const queryStr = data.get("query")?.trim();
        if (queryStr) {
            const params = new URLSearchParams({ query: queryStr });
            window.location.replace(`?${params.toString()}`);
        }
    });
}

main().catch(e => console.error("Unexpected error\n", e));
