#!/usr/bin/env node
/**
 * 一键重启的「接手脚本」——被宿主进程 detached 起来，独立于 dsh 活着。
 *
 * 背景：桌面端把内核（宿主）退出一律当致命故障（main.js 里 child.once('close') 无条件 fail），
 * 所以内核自己退出必然弹「应用无法使用」那张框，插件侧绕不过去。
 * 但反方向可行：**先关掉界面壳（Electron 主进程）**，内核会收到 IPC 断开并走自己的优雅收尾
 * （dsh-desktop-host/lib/index.js 里 process.once('disconnect', () => stop())），
 * 主进程一死也没有任何东西会弹框；随后本脚本把 exe 重新拉起来。
 *
 * 参数：node restart-app.mjs <主进程PID> <exe路径> <宿主PID> <端口> <日志文件>
 */

import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { appendFileSync } from 'node:fs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const [parentPid, exePath, hostPid, portArg, logPath] = process.argv.slice(2)
const port = Number(portArg || 19387)

function log(line) {
  try {
    appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* 日志写不进去不影响重启 */
  }
}

function portOpen() {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const done = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    setTimeout(() => done(false), 800)
  })
}

function kill(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return
  try {
    process.kill(pid)
  } catch (error) {
    log(`kill ${pid} failed: ${error.message}`)
  }
}

log(`start parent=${parentPid} host=${hostPid} exe=${exePath}`)

// 1) 等宿主把 HTTP 响应交回浏览器（否则按钮会看到连接被掐断）
await sleep(1200)

// 2) 关掉界面壳。主进程一没有，内核的 IPC 断开会自动走优雅收尾，也没有东西能弹恢复框。
kill(Number(parentPid))

// 3) 等端口释放（内核收尾 + 退出）；12 秒还不放就补一刀内核，避免新实例撞端口起不来
let released = false
for (let i = 0; i < 24; i += 1) {
  await sleep(500)
  if (!(await portOpen())) {
    released = true
    break
  }
}
if (!released) {
  log('port still busy after 12s, killing host')
  kill(Number(hostPid))
  for (let i = 0; i < 12; i += 1) {
    await sleep(500)
    if (!(await portOpen())) {
      released = true
      break
    }
  }
}
log(`port ${released ? 'released' : 'STILL BUSY'}`)

// 4) 清一次累积的浏览器会话 Cookie。此刻应用已完全退出，数据库没人占着。
//    DSH 每次启动换端口，Cookie 名里编着「域名:端口」，而 Cookie 按域名存、不区分端口，
//    所以每启动一次多一条；堆到约 70 条、请求头过 16 KB，下次启动会报认证失败。
async function pruneAuthCookies() {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const { join } = await import('node:path')
    const { homedir } = await import('node:os')
    const { existsSync, copyFileSync } = await import('node:fs')
    const dbPath = join(homedir(), 'AppData', 'Roaming', '@deepseek-ai', 'dsh-desktop', 'Network', 'Cookies')
    if (!existsSync(dbPath)) {
      log('cookie db missing, skip')
      return
    }
    const db = new DatabaseSync(dbPath)
    const count = () => db.prepare(
      "select count(*) as n from cookies where host_key = '127.0.0.1' and name like 'dsh-auth-%'",
    ).get().n
    const before = count()
    if (before <= 30) {
      db.close()
      log(`cookies ${before} <= 30, skip`)
      return
    }
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    copyFileSync(dbPath, `${dbPath}.bak-${stamp}`)
    db.exec("delete from cookies where host_key = '127.0.0.1' and name like 'dsh-auth-%'")
    db.exec('vacuum')
    const after = count()
    db.close()
    log(`cookies pruned ${before} -> ${after}`)
  } catch (error) {
    // 清不了不影响重启：重启本身必须先完成。
    log(`cookie prune skipped: ${error.message}`)
  }
}
await pruneAuthCookies()

// 5) 重新拉起应用
if (!exePath) {
  log('no exe path, stop')
  process.exit(1)
}
/**
 * 拉起应用。**必须把 ELECTRON_RUN_AS_NODE 从环境里摘掉**：
 * 本脚本自己就是靠这个变量跑在 Electron 的 Node 模式下的，直接继承下去，
 * 被拉起的 exe 也会以 Node 模式启动（没有脚本参数 → 立刻退出），
 * 症状是「应用关掉了、但一直没回来」。
 */
function launchApp(label) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(exePath, [], { detached: true, stdio: 'ignore', windowsHide: false, env })
  child.unref()
  log(`${label} spawned exe pid=${String(child.pid)}`)
  return child
}

/** 进程还在不在。桌面端每次启动都是**新端口**，用旧端口探活只会得到假失败。 */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 等进程稳定活着：先等 2.5 秒（撞单实例锁的实例这时已经退了），再等到总时限复查一次。 */
async function waitAlive(pid, ms) {
  const early = Math.min(2500, ms)
  await sleep(early)
  if (!alive(pid)) return false
  await sleep(Math.max(0, ms - early))
  return alive(pid)
}

const first = launchApp('first launch')

// 6) 起来了吗？起不来就再试一次（第二次失败只能让用户手动开）
if (await waitAlive(first.pid, 8000)) {
  log(`ok: app is back (pid ${first.pid} alive)`)
  process.exit(0)
}
log('first launch did not stay alive, retry once')
const retry = launchApp('retry')
await sleep(8000)
log(alive(retry.pid) ? `ok after retry (pid ${retry.pid} alive)` : 'FAILED: app did not come back')
