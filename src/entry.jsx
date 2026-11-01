/**
 * 重启与刷新：会话头部最左两个图标按钮（浏览器半边源码）。
 *
 * 落点 `conversation.header.leading`——single 槽，当前由本插件占用（注册者显示为客户端运行时名）。
 * 如果哪天这个座位被别的插件先占住（single 槽同优先级二次注册会抛错），
 * 换到 `conversation.session.header.utilities`（list 槽，自带 id 追加即可）。
 *
 * 刷新＝重载页面；重载会用内核启动时拍的清单快照，改了客户端插件后快照会过期（404 → 白屏 +
 * 恢复框）。所以刷新前先探一遍清单资源：全都取得到就 reload；取不到就说明必须重启，直接走重启，
 * 不再弹一句「先点重启」把人堵住。
 * 重启＝POST 宿主路由 → 桌面端交 assets/restart-app.mjs 关壳再拉起。
 *
 * 打包：npm run build:client（scripts/build-client.mjs）；产物外壳 id 必须等于包名。
 */
import { useState } from 'react'

const ROUTE = '/dsh-reload-buttons/api/restart'

/** 把路由拼成当前页面挂载点下的路径（锚 document.baseURI，兼容子路径部署）。 */
function api(path) {
  const relative = String(path).replace(/^\/+/, '')
  if (typeof document === 'undefined') return '/' + relative
  return new URL(relative, document.baseURI).pathname
}

const wrap = { display: 'inline-flex', alignItems: 'center', gap: '2px' }
const btn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px',
  background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.65,
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function IconPower() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v9" />
      <path d="M18.36 6.64a9 9 0 1 1-12.72 0" />
    </svg>
  )
}

/**
 * 刷新前自检：启动快照里的 bundle 是否都还取得到。
 *
 * 桌面端把客户端插件清单在**内核启动那一刻**拍一次快照（主进程 `dshDesktopBoot.ready()` 返回的
 * injections 就是它），之后改插件产物快照不会跟着变；这时刷新会请求到已下线的旧 rev（404），
 * web boot 整批失败 → 白屏 + 恢复对话框。所以刷之前先把快照里的组合脚本取一遍，取不到就不刷。
 */
async function probeBootBundles() {
  const boot = globalThis.__DSH_BOOT__
  const batches = boot && Array.isArray(boot.batches) ? boot.batches : []
  const urls = batches
    .map((batch) => (batch && typeof batch.url === 'string' ? batch.url : ''))
    .filter((url) => url !== '')
  if (urls.length === 0) return { ok: true, total: 0, bad: [] }
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(new URL(url, document.baseURI), { cache: 'no-store' })
      return { url, ok: res.ok, status: res.status }
    } catch {
      return { url, ok: false, status: 0 }
    }
  }))
  return { ok: results.every((r) => r.ok), total: results.length, bad: results.filter((r) => !r.ok) }
}

/** 请求宿主重启。界面随壳一起关掉，所以连接断掉是预期，不当错误。 */
async function requestRestart() {
  try {
    await fetch(api(ROUTE), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  } catch (e) { /* 界面壳被关掉时连接会断，属预期 */ }
}

/** 顶部浮层：先提示「正在刷新…」，重载回来后再给一句「界面已刷新」，让人知道这一下确实生效了。 */
function overlay(text, ms) {
  if (typeof document === 'undefined' || document.body === null) return () => {}
  const box = document.createElement('div')
  box.textContent = text
  box.style.position = 'fixed'
  box.style.top = '16px'
  box.style.left = '50%'
  box.style.transform = 'translateX(-50%)'
  box.style.zIndex = '2147483647'
  box.style.padding = '8px 16px'
  box.style.borderRadius = '8px'
  box.style.background = 'rgba(24, 24, 27, 0.88)'
  box.style.color = '#fff'
  box.style.fontSize = '13px'
  box.style.lineHeight = '18px'
  box.style.pointerEvents = 'none'
  box.style.fontFamily = 'inherit'
  document.body.appendChild(box)
  const remove = () => { box.remove() }
  if (ms) setTimeout(remove, ms)
  return remove
}

/** 刷新标记：重载前写下，重载后本插件加载时读到它就报一句「已刷新」。 */
const REFRESH_FLAG = 'dsh-reload-buttons:refreshed'

/** 重载回来后确认一句（20 秒内有效，避免误报）。 */
function announceRefreshed() {
  let stamp = 0
  try {
    stamp = Number(sessionStorage.getItem(REFRESH_FLAG) ?? 0)
    sessionStorage.removeItem(REFRESH_FLAG)
  } catch {
    return
  }
  if (!stamp || Date.now() - stamp > 20000) return
  overlay('界面已刷新', 1800)
}

/** 客户端模块系统（就地重载插件条目用）；apply 时取，声明成依赖保证一定在。 */
let modulesRef

/** 客户端模块系统句柄。 */
function moduleSystem() {
  return modulesRef
}

/** 从宿主 SSE 抓当前启动图（一连接就推全量图）。 */
function freshGraph() {
  return new Promise((resolve) => {
    let source
    let timer
    const finish = (value) => {
      clearTimeout(timer)
      try { source?.close() } catch { /* 已关就算了 */ }
      resolve(value)
    }
    try {
      source = new EventSource(new URL('plugins/events', document.baseURI))
    } catch {
      resolve(null)
      return
    }
    timer = setTimeout(() => finish(null), 3000)
    source.addEventListener('message', (event) => {
      try {
        const frame = JSON.parse(event.data)
        if (frame && frame.type === 'graph' && frame.graph) finish(frame.graph)
      } catch { /* 坏帧忽略，等超时 */ }
    })
  })
}

/** 清单过期时：按宿主当前图就地对齐插件条目——不重载整页、不关应用。 */
async function resyncPlugins() {
  const modules = moduleSystem()
  const entries = modules && modules.entries
  if (!entries || typeof entries.sync !== 'function') return false
  const graph = await freshGraph()
  if (!graph) return false
  await entries.sync(graph)
  return true
}

/** 左上一行两个按钮。 */
function HeaderButtons() {
  const [restarting, setRestarting] = useState(false)
  const [checking, setChecking] = useState(false)

  async function reload() {
    if (checking) return
    setChecking(true)
    let probe = { ok: true, total: 0, bad: [] }
    try {
      probe = await probeBootBundles()
    } catch {
      probe = { ok: true, total: 0, bad: [] }
    }
    if (probe.ok) {
      try { sessionStorage.setItem(REFRESH_FLAG, String(Date.now())) } catch { /* 隐私模式忽略 */ }
      overlay('正在刷新…')
      // 留一帧让浮层看得见，再整页重载
      await new Promise((resolve) => { setTimeout(resolve, 180) })
      window.location.reload()
      return
    }
    // 清单过期：整页重载会白屏（旧 rev 已 404）。改为就地重载插件，同行样给可见反馈。
    const hide = overlay('正在刷新…')
    let resynced = false
    try {
      resynced = await resyncPlugins()
    } catch {
      resynced = false
    }
    hide()
    overlay(resynced ? '界面已刷新' : '刷新失败：清单已过期，请用「重启」', 2200)
    setChecking(false)
  }

  async function restart() {
    if (restarting) return
    if (!window.confirm('重启应用？界面会关掉，几秒后自动重开；若弹出「应用无法使用」窗口，点其中的「重启」即可。')) return
    setRestarting(true)
    await requestRestart()
  }

  return (
    <span style={wrap}>
      <button
        type="button"
        style={Object.assign({}, btn, checking ? { opacity: 0.35, cursor: 'default' } : null)}
        title="刷新界面"
        aria-label="刷新界面"
        onClick={() => void reload()}
      >
        <IconRefresh />
      </button>
      <button
        type="button"
        style={Object.assign({}, btn, restarting ? { opacity: 0.35, cursor: 'default' } : null)}
        title="重启应用（关掉界面，几秒后自动重开）"
        aria-label="重启应用"
        onClick={() => void restart()}
      >
        <IconPower />
      </button>
    </span>
  )
}

/** 需要的客户端服务。 */
export const inject = ['slots', 'modules']

/** 左上角全局面包屑前的空位（single 槽）。 */
const SLOT = 'conversation.header.leading'

/** 把两个按钮挂进左上角。 */
export function apply(ctx) {
  modulesRef = ctx.modules
  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT }, HeaderButtons))
  // 如果是「刷新」刚把页面重载回来的，晚一点给一句「界面已刷新」
  if (typeof setTimeout === 'function') setTimeout(announceRefreshed, 600)
}
