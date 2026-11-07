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
var PING_ROUTE = "/dsh-reload-buttons/api/ping";
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
  let alive = false;
  try {
    const res = await fetch(api(PING_ROUTE), { method: "GET", cache: "no-store" });
    alive = res.ok;
  } catch {
    alive = false;
  }
  if (!alive) return { ok: false, reason: "宿主半边没响应（插件可能没装全，或宿主已停止）" };
  try {
    const res = await fetch(api(ROUTE), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.ok) return { ok: true };
    let reason = "HTTP " + res.status;
    try {
      const data = await res.json();
      if (data && data.error) reason = data.error;
    } catch {
    }
    return { ok: false, reason };
  } catch {
    return { ok: true };
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
  overlay("界面已刷新", 1800);
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
  if (!entries || typeof entries.sync !== "function") return { ok: false, reason: "当前界面不支持就地刷新" };
  const graph = await freshGraph();
  if (!graph) return { ok: false, reason: "没拿到宿主的插件清单" };
  await entries.sync(graph);
  const state = entries.state && typeof entries.state.getSnapshot === "function" ? entries.state.getSnapshot() : null;
  const failure = state && Array.isArray(state.failures) ? state.failures[0] : void 0;
  if (failure) return { ok: false, reason: "插件加载失败：" + (failure.message || failure.id) };
  return { ok: true };
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
      overlay("正在刷新…");
      await new Promise((resolve) => {
        setTimeout(resolve, 180);
      });
      window.location.reload();
      return;
    }
    const hide = overlay("正在刷新…");
    let resynced = { ok: false, reason: "未知原因" };
    try {
      resynced = await resyncPlugins();
    } catch (error) {
      resynced = { ok: false, reason: String(error && error.message || error) };
    }
    hide();
    overlay(resynced.ok ? "界面已刷新" : "刷新失败：" + resynced.reason + "；请用「重启」", 2600);
    setChecking(false);
  }
  async function restart() {
    if (restarting) return;
    if (!window.confirm("重启应用？界面会关掉：桌面版会在几秒后自动重开；命令行启动（dsh web）的进程会直接退出，需要你手动再启动。若弹出「应用无法使用」窗口，点其中的「重启」即可。")) return;
    setRestarting(true);
    const result = await requestRestart();
    setRestarting(false);
    if (result && result.ok === false) overlay("重启失败：" + result.reason, 3200);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: wrap, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        style: Object.assign({}, btn, checking ? { opacity: 0.35, cursor: "default" } : null),
        title: "刷新界面",
        "aria-label": "刷新界面",
        onClick: () => void reload(),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconRefresh, {})
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        style: Object.assign({}, btn, restarting ? { opacity: 0.35, cursor: "default" } : null),
        title: "重启应用（桌面版自动重开；命令行版需手动再启动）",
        "aria-label": "重启应用",
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
