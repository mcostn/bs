# BangSearch

A minimal, self-hostable "bang" search redirector, inspired by DuckDuckGo's !Bang feature.

## Using it

Add BangSearch as a custom search engine in your browser, pointing at:

```
https://your-domain/?query=%s
```

Then type searches straight into your address bar:

| Query | Result |
|---|---|
| `cats` | Searches your default bang (set in Settings) |
| `!g cats` or `g! gats` | Searches Google |
| `!yt !g cats` | Opens both YouTube and Google in separate tabs |
| `\cats` | Jumps to the first result via your lucky engine |
| `cats !!` | Repeats the last bang you used |

## Running locally

This is a static site, which means no build step and no server required beyond serving
the files.

```sh
python3 -m http.server 8000
# or: npx serve
```

Then open `http://localhost:8000`
