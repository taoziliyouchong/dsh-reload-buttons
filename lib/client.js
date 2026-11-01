window.__ModuleLoader__.load({
	id: "dsh-reload-buttons",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/entry.jsx
var entry_exports = {};
__export(entry_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(entry_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var ROUTE = "/dsh-reload-buttons/api/restart";
function api(path) {
  const relative = String(path).replace(/^\/+/, "");
  if (typeof document === "undefined") return "/" + relative;
  return new URL(relative, document.baseURI).pathname;
}
var wrap = { display: "inline-flex", alignItems: "center", gap: "2px" };
var btn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  padding: 0,
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  opacity: 0.65
};
function IconRefresh() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })
      ]
    }
  );
}
function IconPower() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3v9" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18.36 6.64a9 9 0 1 1-12.72 0" })
      ]
    }
  );
}
async function probeBootBundles() {
  const boot = globalThis.__DSH_BOOT__;
  const batches = boot && Array.isArray(boot.batches) ? boot.batches : [];
  const urls = batches.map((batch) => batch && typeof batch.url === "string" ? batch.url : "").filter((url) => url !== "");
  if (urls.length === 0) return { ok: true, total: 0, bad: [] };
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(new URL(url, document.baseURI), { cache: "no-store" });
      return { url, ok: res.ok, status: res.status };
    } catch {
      return { url, ok: false, status: 0 };
    }
  }));
  return { ok: results.every((r) => r.ok), total: results.length, bad: results.filter((r) => !r.ok) };
}
async function requestRestart() {
  try {
    await fetch(api(ROUTE), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  } catch (e) {
  }
}
function overlay(text, ms) {
  if (typeof document === "undefined" || document.body === null) return () => {
  };
  const box = document.createElement("div");
  box.textContent = text;
  box.style.position = "fixed";
  box.style.top = "16px";
  box.style.left = "50%";
  box.style.transform = "translateX(-50%)";
  box.style.zIndex = "2147483647";
  box.style.padding = "8px 16px";
  box.style.borderRadius = "8px";
  box.style.background = "rgba(24, 24, 27, 0.88)";
  box.style.color = "#fff";
  box.style.fontSize = "13px";
  box.style.lineHeight = "18px";
  box.style.pointerEvents = "none";
  box.style.fontFamily = "inherit";
  document.body.appendChild(box);
  const remove = () => {
    box.remove();
  };
  if (ms) setTimeout(remove, ms);
  return remove;
}
var REFRESH_FLAG = "dsh-reload-buttons:refreshed";
function announceRefreshed() {
  let stamp = 0;
  try {
    stamp = Number(sessionStorage.getItem(REFRESH_FLAG) ?? 0);
    sessionStorage.removeItem(REFRESH_FLAG);
  } catch {
    return;
  }
  if (!stamp || Date.now() - stamp > 2e4) return;
  overlay("\u754C\u9762\u5DF2\u5237\u65B0", 1800);
}
var modulesRef;
function moduleSystem() {
  return modulesRef;
}
function freshGraph() {
  return new Promise((resolve) => {
    let source;
    let timer;
    const finish = (value) => {
      clearTimeout(timer);
      try {
        source?.close();
      } catch {
      }
      resolve(value);
    };
    try {
      source = new EventSource(new URL("plugins/events", document.baseURI));
    } catch {
      resolve(null);
      return;
    }
    timer = setTimeout(() => finish(null), 3e3);
    source.addEventListener("message", (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame && frame.type === "graph" && frame.graph) finish(frame.graph);
      } catch {
      }
    });
  });
}
async function resyncPlugins() {
  const modules = moduleSystem();
  const entries = modules && modules.entries;
  if (!entries || typeof entries.sync !== "function") return false;
  const graph = await freshGraph();
  if (!graph) return false;
  await entries.sync(graph);
  return true;
}
function HeaderButtons() {
  const [restarting, setRestarting] = (0, import_react.useState)(false);
  const [checking, setChecking] = (0, import_react.useState)(false);
  async function reload() {
    if (checking) return;
    setChecking(true);
    let probe = { ok: true, total: 0, bad: [] };
    try {
      probe = await probeBootBundles();
    } catch {
      probe = { ok: true, total: 0, bad: [] };
    }
    if (probe.ok) {
      try {
        sessionStorage.setItem(REFRESH_FLAG, String(Date.now()));
      } catch {
      }
      overlay("\u6B63\u5728\u5237\u65B0\u2026");
      await new Promise((resolve) => {
        setTimeout(resolve, 180);
      });
      window.location.reload();
      return;
    }
    const hide = overlay("\u6B63\u5728\u5237\u65B0\u2026");
    let resynced = false;
    try {
      resynced = await resyncPlugins();
    } catch {
      resynced = false;
    }
    hide();
    overlay(resynced ? "\u754C\u9762\u5DF2\u5237\u65B0" : "\u5237\u65B0\u5931\u8D25\uFF1A\u6E05\u5355\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u7528\u300C\u91CD\u542F\u300D", 2200);
    setChecking(false);
  }
  async function restart() {
    if (restarting) return;
    if (!window.confirm("\u91CD\u542F\u5E94\u7528\uFF1F\u754C\u9762\u4F1A\u5173\u6389\uFF0C\u51E0\u79D2\u540E\u81EA\u52A8\u91CD\u5F00\uFF1B\u82E5\u5F39\u51FA\u300C\u5E94\u7528\u65E0\u6CD5\u4F7F\u7528\u300D\u7A97\u53E3\uFF0C\u70B9\u5176\u4E2D\u7684\u300C\u91CD\u542F\u300D\u5373\u53EF\u3002")) return;
    setRestarting(true);
    await requestRestart();
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: wrap, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        style: Object.assign({}, btn, checking ? { opacity: 0.35, cursor: "default" } : null),
        title: "\u5237\u65B0\u754C\u9762",
        "aria-label": "\u5237\u65B0\u754C\u9762",
        onClick: () => void reload(),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconRefresh, {})
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        style: Object.assign({}, btn, restarting ? { opacity: 0.35, cursor: "default" } : null),
        title: "\u91CD\u542F\u5E94\u7528\uFF08\u5173\u6389\u754C\u9762\uFF0C\u51E0\u79D2\u540E\u81EA\u52A8\u91CD\u5F00\uFF09",
        "aria-label": "\u91CD\u542F\u5E94\u7528",
        onClick: () => void restart(),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconPower, {})
      }
    )
  ] });
}
var inject = ["slots", "modules"];
var SLOT = "conversation.header.leading";
function apply(ctx) {
  modulesRef = ctx.modules;
  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT }, HeaderButtons));
  if (typeof setTimeout === "function") setTimeout(announceRefreshed, 600);
}

		return module.exports;
	}
});
