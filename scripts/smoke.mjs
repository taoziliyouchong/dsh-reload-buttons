#!/usr/bin/env node
/**
 * 本机冒烟：不起应用、不发网络请求、不改任何东西。
 *
 * 四关：
 *   1. 包结构      —— files 声明的必需文件都在（含已提交的 lib/client.js）
 *   2. 宿主半边    —— 桩 ctx 跑 apply，确认注册了一条路由、且路由路径与包名一致
 *   3. 路由鉴权    —— 非回环请求 403、非 POST 405
 *   4. 客户端产物  —— 外壳 id == 包名，且带上了源码里的路由与刷新标记
 *
 * 用法：node scripts/smoke.mjs   （任一条失败退出码 1）
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const problems = []

const ok = (label, extra = '') => console.log('ok   ' + label + (extra ? '  ' + extra : ''))
const fail = (label, why) => {
  problems.push(label + ': ' + why)
  console.log('FAIL ' + label + '  ' + why)
}

/** 1. 包结构 */
const REQUIRED = [
  'index.js',
  'cordis.patch.yml',
  'assets/restart-app.mjs',
  'src/entry.jsx',
  'lib/client.js',
  'README.md',
  'README.en.md',
  'LICENSE',
]
const missing = REQUIRED.filter((rel) => !existsSync(join(root, rel)))
if (missing.length > 0) fail('结构', '缺 ' + missing.join('、'))
else ok('结构', REQUIRED.length + ' 个必需文件齐全')

/** 2. 宿主半边：桩 ctx 跑 apply */
const mod = await import(pathToFileURL(join(root, 'index.js')).href)
if (mod.name !== pkg.name) fail('宿主半边', 'index.js 导出的 name 是 ' + mod.name + '，不等于包名 ' + pkg.name)
else ok('宿主半边', "name = " + mod.name)

const routes = []
const effects = []
const webServer = {
  port: 0,
  register(route) {
    routes.push(route)
    return () => {}
  },
}
// inject 回调收到的是宿主 ctx（webServer 挂在它上面），不是服务本身
const hostCtx = { webServer }
const ctx = {
  inject(names, fn) {
    if (!Array.isArray(names) || !names.includes('webServer')) throw new Error('宿主半边要求注入 webServer')
    fn(hostCtx)
  },
  effect(fn) {
    effects.push(typeof fn === 'function' ? fn() : fn)
  },
}

try {
  mod.apply(ctx)
} catch (error) {
  fail('宿主半边', 'apply 抛错：' + error.message)
}

const ROUTE = '/' + pkg.name + '/api/restart'
const PING = '/' + pkg.name + '/api/ping'
const routeOf = (path) => routes.find((route) => route.path === path)
if (routes.length !== 2) fail('宿主半边', '应注册 2 条路由，实际 ' + routes.length)
else if (!routeOf(PING)) fail('宿主半边', '缺探测路由 ' + PING)
else if (!routeOf(ROUTE)) fail('宿主半边', '缺重启路由 ' + ROUTE)
else if (routeOf(PING).kind !== 'exact' || routeOf(ROUTE).kind !== 'exact') fail('宿主半边', '路由 kind 应为 exact')
else if (effects.length !== 1) fail('宿主半边', '应登记 1 个 effect，实际 ' + effects.length)
else ok('宿主半边', 'GET ' + PING + '、POST ' + ROUTE + ' 已注册（kind=exact）')

/** 3. 路由鉴权 */
function call(handler, req) {
  const res = {
    status: 0,
    headers: null,
    body: '',
    writeHead(code, headers) {
      res.status = code
      res.headers = headers
    },
    end(body) {
      res.body = String(body ?? '')
    },
  }
  handler(req, res)
  return res
}

if (routes.length === 2) {
  const restart = routeOf(ROUTE).handler
  const ping = routeOf(PING).handler
  const cases = [
    { label: '非回环地址被拒', handler: restart, req: { socket: { remoteAddress: '10.1.2.3' }, method: 'POST' }, want: 403 },
    { label: 'GET 打重启被拒', handler: restart, req: { socket: { remoteAddress: '127.0.0.1' }, method: 'GET' }, want: 405 },
    { label: '::1 本机照常走 POST 分支', handler: restart, req: { socket: { remoteAddress: '::1' }, method: 'GET' }, want: 405 },
    { label: 'IPv4 映射地址被认作本机', handler: restart, req: { socket: { remoteAddress: '::ffff:127.0.0.1' }, method: 'GET' }, want: 405 },
    { label: '探测路由非回环被拒', handler: ping, req: { socket: { remoteAddress: '10.1.2.3' }, method: 'GET' }, want: 403 },
    { label: '探测路由 POST 被拒', handler: ping, req: { socket: { remoteAddress: '127.0.0.1' }, method: 'POST' }, want: 405 },
    { label: '探测路由本机 GET 放行', handler: ping, req: { socket: { remoteAddress: '127.0.0.1' }, method: 'GET' }, want: 200 },
  ]
  let passed = 0
  for (const item of cases) {
    let res
    try {
      res = call(item.handler, item.req)
    } catch (error) {
      fail('路由鉴权', item.label + '：handler 抛错 ' + error.message)
      continue
    }
    if (res.status !== item.want) fail('路由鉴权', item.label + '：返回 ' + res.status + '，应为 ' + item.want)
    else passed += 1
  }
  if (passed === cases.length) ok('路由鉴权', passed + ' 条全部符合')
}

/** 4. 客户端产物 */
const client = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const idMatch = /^\s*id:\s*"([^"]+)"/m.exec(client)
if (!idMatch) fail('客户端产物', '外壳里找不到 id')
else if (idMatch[1] !== pkg.name) fail('客户端产物', '外壳 id 是 ' + idMatch[1] + '，应等于包名 ' + pkg.name)
else if (!client.includes(ROUTE)) fail('客户端产物', '产物里没有路由 ' + ROUTE + '（源码改了但没重新构建）')
else if (!client.includes(PING)) fail('客户端产物', '产物里没有探测路由 ' + PING + '（源码改了但没重新构建）')
else if (!client.includes(pkg.name + ':refreshed')) fail('客户端产物', '产物里没有刷新标记（源码改了但没重新构建）')
else if (!client.includes('getSnapshot')) fail('客户端产物', '产物里没有读取替换结果（源码改了但没重新构建）')
else if (!client.includes('命令行启动')) fail('客户端产物', '产物里没有区分命令行版的文案（源码改了但没重新构建）')
else if (client.includes('关掉界面，几秒后自动重开')) fail('客户端产物', '产物里还带着旧的确认框文案')
else ok('客户端产物', 'id=' + pkg.name + '，' + Buffer.byteLength(client, 'utf8') + ' 字节')

console.log('')
if (problems.length > 0) {
  console.error('冒烟失败 ' + problems.length + ' 项')
  process.exit(1)
}
console.log('冒烟通过')
