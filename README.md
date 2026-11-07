# dsh-reload-buttons

<img src="assets/icon-180.png" width="96" align="right" alt="dsh-reload-buttons">

**中文** | [English](README.en.md)

在 DSH 界面左上角放两个图标按钮：**刷新界面**、**重启应用**。改完插件或配置不用再手动关掉整个应用。

## 两个按钮各自做什么

| 按钮 | 桌面端 | `dsh web` |
|---|---|---|
| 刷新 | 清单没过期 → 整页重载；清单过期 → 就地按宿主当前图对齐客户端插件，不重载、不关应用 | 同左 |
| 重启 | 关掉界面壳（Electron 主进程）→ 内核随 IPC 断开优雅收尾 → 独立脚本把 exe 拉起来，起不来再试一次 | 结束内核进程，重开交给你的启动方式 |

### 刷新为什么分两路

桌面端重载页面用的是**内核启动那一刻**拍的客户端插件清单快照（主进程只认那一份）。改过客户端插件后，快照里的 bundle 地址已经 404，整页重载就是白屏加恢复框。

按钮的做法：先探一遍快照里的 bundle 是否都还取得到。全都取得到就真重载；取不到就改为就地重同步——从宿主 `/plugins/events` 首帧取当前图，用 `entries.sync` 对齐客户端插件条目，成功时不提示、不关应用（重同步本身失败才会提示改用「重启」）。彻底重来仍走「重启」。

### 重启为什么先关界面壳

桌面端把内核退出一律当致命故障：内核自己 exit，主进程会弹「应用无法使用」。反过来，Electron 主进程一消失，内核的 IPC 断开会触发它自己的优雅收尾，此时也没有进程能弹框；随后独立脚本把 exe 重新拉起。

## 安装

```sh
dsh plugin --profile desktop add github:taoziliyouchong/dsh-reload-buttons
```

发布到 npm 之后也可以：

```sh
dsh plugin --profile desktop add dsh-reload-buttons
```

装完重启 DSH。用别的 profile 就把 `desktop` 换成你的 profile 名。

要求：DSH 桌面端（重启按钮要关壳重开）。`dsh web` 下刷新可用，重启等于结束内核进程。Node 版本跟随 DSH，不需要额外运行时。

兼容：DSH 0.2.2-rc.1 验证通过；更高版本未验证。

## 界面位置

按钮挂在会话头部最左的 `conversation.header.leading`——一个 single 槽，当前由本插件占用。同优先级二次注册会抛错，不能和同样占这个座位的插件一起装。要换位置见 `src/entry.jsx` 顶部注释（`conversation.session.header.utilities` 是 list 槽）。

## 机制

- 宿主半边注册一条 `POST /dsh-reload-buttons/api/restart`：只接受回环地址（`127.*`、`::1`、`::ffff:127.*`），只接受 POST。远程访问的 DSH 上点重启会被 403 拒绝。
- 桌面端把重启交棒给 `assets/restart-app.mjs`（detached spawn）：等 1.2 秒让 HTTP 响应交回浏览器 → 关掉 Electron 主进程 → 等端口释放（12 秒不放就结束内核）→ 拉起 exe 并按新进程 pid 探活（8 秒不稳就再试一次）。
- 桌面端每次启动端口都不同，探活只看进程 pid，不看端口。
- 重启日志写在 `$DSH_HOME/logs/dsh-reload-buttons-restart.log`。
- 刷新按钮是纯浏览器侧行为，不需要宿主。
- 不联网、不上传任何内容。

## 已知限制

- 非桌面端没有界面壳可关，重启按钮只结束进程，重开取决于你的启动方式。
- 重启时界面会关掉，几秒后自动回来；若同时弹出带「重启」按钮的恢复框，点它也可以。
- 只对单机有效：回环地址以外的请求不处理。

## 开发

源码分两半：

- `index.js` —— 宿主半边（路由、交棒、退出）
- `src/entry.jsx` —— 浏览器半边（两个按钮、刷新自检、就地重同步）

改过 `src/entry.jsx` 必须重新打包。`lib/client.js` 是提交进仓库的构建产物，缺了它界面不会加载：

```sh
npm install
npm run build:client    # 重新生成 lib/client.js
npm run check:client    # 比对新产物与已提交产物是否一致
npm run smoke           # 结构 / 注册 / 鉴权 / 产物 四关
```

打包要求：`react` 与 `react/jsx-runtime` 保持 external（由 DSH 客户端模块表提供）；产物外壳 `window.__ModuleLoader__.load({ id, factory })` 里的 `id` 必须等于包名。

## 反馈

插件有问题，按这个顺序：

1. 开 Issue：https://github.com/taoziliyouchong/dsh-reload-buttons/issues —— 能留痕、能搜历史，别人也可能已经遇过；
2. 急着问或不想开 Issue，QQ 号：**2171960697**（加好友请注明装的是哪个插件）。

反馈时带上：DSH 版本、插件版本、报错原文、截图。少一样多半要再问一轮。

## 许可

MIT
