# dsh-reload-buttons

<img src="assets/icon-180.png" width="96" align="right" alt="dsh-reload-buttons">

[中文](README.md) | **English**

Two icon buttons in the top-left corner of the DSH header: **reload the UI** and **restart the app**. No more closing the whole application by hand after changing a plugin or a config.

## What each button does

| Button | Desktop app | `dsh web` |
|---|---|---|
| Reload | Manifest still valid → full page reload; manifest stale → re-align client plugins in place against the host's current graph, no reload, no closing the app | Same |
| Restart | Close the shell (the Electron main process) → the kernel shuts down cleanly when its IPC disconnects → a detached script relaunches the exe, retrying once if it does not stay up | End the kernel process; bring-up is up to your process manager |

### Why reload has two paths

On the desktop app, a page reload uses the client-plugin manifest **snapshotted when the kernel started** — the main process only knows that copy. After a client plugin changes, the bundle URLs in that snapshot 404, so a full reload ends in a blank page plus a recovery dialog.

The button therefore probes every bundle in the snapshot first: if all of them still resolve, it reloads; if not, it re-aligns the client plugin entries in place — it takes the current graph from the first frame of the host's `/plugins/events` and calls `entries.sync`, without any prompt and without closing the app (only a failed re-sync tells you to use Restart). A full teardown still goes through Restart.

### Why restart closes the shell first

The desktop app treats any kernel exit as a fatal failure: if the kernel exits on its own, the main process shows the "app is unusable" dialog. The other direction works — once the Electron main process is gone, the kernel's IPC disconnect triggers its own graceful shutdown, and nothing is left to show a dialog; the detached script then relaunches the exe.

## Install

```sh
dsh plugin --profile desktop add github:taoziliyouchong/dsh-reload-buttons
```

Once published to npm, this also works:

```sh
dsh plugin --profile desktop add dsh-reload-buttons
```

Restart DSH afterwards. Replace `desktop` with your own profile name if you use another one.

Requirements: the DSH desktop app (the restart button needs the shell to close and relaunch). On `dsh web` the reload button works and restart just ends the kernel process. Node follows DSH; no extra runtime is needed.

Requires DSH >= 0.2.1-alpha.1 (lower bound inferred from the services and slots the plugin uses, all present in alpha.1); verified on 0.2.1-alpha.3 and 0.2.2-rc.1, later versions untested.

## Where the buttons live

They are mounted at `conversation.header.leading` — the left-most slot of the conversation header, a `single` slot currently owned by this plugin. Registering the same slot twice at the same priority throws, so this plugin cannot be installed alongside another one that claims that exact slot. To move them, see the comment at the top of `src/entry.jsx` (`conversation.session.header.utilities` is a `list` slot).

## How it works

- The host half registers `POST /dsh-reload-buttons/api/restart`: loopback addresses only (`127.*`, `::1`, `::ffff:127.*`) and POST only. On a DSH reachable from other machines, the restart call is rejected with 403.
- On the desktop app the restart is handed to `assets/restart-app.mjs` (detached spawn): wait 1.2 s so the HTTP response reaches the browser → close the Electron main process → wait for the port to be released (kill the kernel if it is not, after 12 s) → launch the exe and watch its new process pid (retry once if it does not stay up for 8 s).
- The desktop app uses a different port on every start, so liveness is checked by process pid, never by port.
- The restart log is written to `$DSH_HOME/logs/dsh-reload-buttons-restart.log`.
- The reload button is purely client-side; it needs no host support.
- No network access, nothing uploaded.

## Known limits

- Non-desktop installs have no shell to close: restart only ends the kernel process, and bringing it back depends on how you start it.
- The window closes during a restart and comes back a few seconds later. If a recovery dialog with a "Restart" button shows up at the same time, using it works too.
- Local only: requests from anything other than loopback are not handled.

## Development

The source has two halves:

- `index.js` — host side (route, hand-off, shutdown)
- `src/entry.jsx` — browser side (the two buttons, the reload probes, the in-place re-sync)

Editing `src/entry.jsx` requires rebuilding. `lib/client.js` is a build artifact committed to the repository; without it the UI does not load:

```sh
npm install
npm run build:client    # regenerate lib/client.js
npm run check:client    # verify the committed artifact matches the source
npm run smoke           # structure / registration / authorization / artifact
```

Build rules: keep `react` and `react/jsx-runtime` external (the DSH client module table provides them); the `id` inside the `window.__ModuleLoader__.load({ id, factory })` envelope must equal the package name.

## Feedback

- Open an issue: https://github.com/taoziliyouchong/dsh-reload-buttons/issues — searchable, and others can help.
- Or reach me on QQ: **2171960697** (mention which plugin you installed when adding the contact).

Please include: DSH version, plugin version, the exact error text, and a screenshot.

## License

MIT
