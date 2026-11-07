/**
 * 重启与刷新：宿主侧提供一条「重启应用 / 结束内核」的路由。
 * 刷新按钮是纯浏览器侧的事（重载页面即重拉客户端产物），不需要宿主。
 *
 * 落点：客户端半边把两个图标按钮挂进 `conversation.header.leading`（网页界面左上角空位）。
 * 安全：只接受回环请求；POST 才受理。
 *
 * 桌面端为什么要「先关界面壳」而不是自己退出：
 * 桌面端把内核退出一律当致命故障（main.js 里 child.once('close') 无条件 fail → 弹恢复框），
 * 内核自己 exit 就必然弹那张框。反过来，Electron 主进程一消失，
 * 内核的 IPC 断开会触发它自己的优雅收尾（dsh-desktop-host 里 process.once('disconnect')），
 * 且没有任何进程会弹框；随后由 assets/restart-app.mjs 把 exe 重新拉起。
 * 非桌面端（dsh web 等）没有这一层，直接走内核自己的 shutdown。
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Cordis 插件名。 */
export const name = 'dsh-reload-buttons'
/** 需要的服务（路由在 apply 期靠 ctx.inject 等 webServer 到位）。 */
export const inject = []

const ROUTE = '/dsh-reload-buttons/api/restart'
/** 探测路由：客户端点重启前先确认宿主半边在，失败时才能给出可读原因。 */
const PING_ROUTE = '/dsh-reload-buttons/api/ping'
const WORKER = fileURLToPath(new URL('./assets/restart-app.mjs', import.meta.url))

/** 桌面端＝宿主跑在 Electron 的 Node 模式里。 */
function isDesktop() {
  return typeof process.versions?.electron === 'string' && process.versions.electron !== ''
}

function logPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, 'logs')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    return join(tmpdir(), 'dsh-reload-buttons-restart.log')
  }
  return join(dir, 'dsh-reload-buttons-restart.log')
}

/** 内核自己的 shutdown（宿主 index.js 监听的就是这条消息），跑完进程自然退出。 */
function shutdownAndExit() {
  let exited = false
  const hardExit = () => {
    if (exited) return
    exited = true
    process.exit(0)
  }
  try {
    process.emit('message', { type: 'shutdown' }, null)
  } catch {
    hardExit()
    return
  }
  setTimeout(hardExit, 3000)
}

/**
 * 桌面端：把重启交给独立脚本（先关界面壳，再拉起 exe）。
 * 本进程不退出——界面壳一走，宿主会收到 IPC 断开并自行优雅收尾。
 */
function handOffRestart(port) {
  const exe = process.execPath
  const parentPid = process.ppid
  const child = spawn(process.execPath, [
    WORKER,
    String(parentPid),
    exe,
    String(process.pid),
    String(port ?? ''),
    logPath(),
  ], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  return child.pid !== undefined
}

function isLocal(req) {
  const addr = req.socket && req.socket.remoteAddress
  return typeof addr === 'string' && /^(::1|127\.|::ffff:127\.)/.test(addr)
}

function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

/** 注册探测路由与重启路由。 */
export function apply(ctx) {
  const mount = (hostCtx) => {
    const webServer = hostCtx
      && (hostCtx.webServer || (typeof hostCtx.get === 'function' ? hostCtx.get('webServer') : undefined))
    if (!webServer || typeof webServer.register !== 'function') return
    ctx.effect(() => {
      // 探测优先：客户端点重启前先问一句宿主在不在，失败时才能给出可读原因。
      const offPing = webServer.register({
        kind: 'exact',
        path: PING_ROUTE,
        handler: (req, res) => {
          if (!isLocal(req)) return sendJson(res, 403, { ok: false, error: '只接受本机请求' })
          if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: '只支持 GET' })
          sendJson(res, 200, { ok: true })
        },
      })
      const offRestart = webServer.register({
        kind: 'exact',
        path: ROUTE,
        handler: (req, res) => {
          if (!isLocal(req)) return sendJson(res, 403, { ok: false, error: '只接受本机请求' })
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: '只支持 POST' })
          if (isDesktop()) {
            let handedOff = false
            try {
              handedOff = handOffRestart(webServer.port)
            } catch {
              handedOff = false
            }
            sendJson(res, 200, { ok: true, mode: handedOff ? 'relaunch' : 'exit' })
            // 脚本没起来就别干等：退回内核自己退出（会弹恢复框，但至少不会卡死）
            if (!handedOff) setTimeout(shutdownAndExit, 400)
            return
          }
          sendJson(res, 200, { ok: true, mode: 'exit' })
          setTimeout(shutdownAndExit, 400)
        },
      })
      return () => {
        offPing()
        offRestart()
      }
    }, 'dsh-reload-buttons: restart routes')
  }
  // apply 期直接取 ctx.get('webServer') 往往还没就绪，优先放进 inject 回调等它到位；
  // 桩 ctx（冒烟、测试）没有 inject，退回直接取（拿不到就什么也不做，不影响加载）。
  if (typeof ctx.inject === 'function') ctx.inject(['webServer'], mount)
  else mount(ctx)
}
