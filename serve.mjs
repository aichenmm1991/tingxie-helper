// 听写小助手 · 局域网静态服务器（无需安装任何依赖）
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const PORT = 8000
const ROOT = fileURLToPath(new URL('./dist', import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (path === '/') path = '/index.html'
    const file = normalize(join(ROOT, path))
    if (!file.startsWith(ROOT)) throw new Error('forbidden')
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // 单页应用兜底：找不到的文件返回首页
    try {
      const data = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
})

server.listen(PORT, '0.0.0.0', () => {
  const nets = networkInterfaces()
  const ips = []
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address)
    }
  }
  console.log('')
  console.log('  ✏️  听写小助手已启动！')
  console.log('')
  console.log('  这台电脑上打开：  http://localhost:' + PORT)
  for (const ip of ips) {
    console.log('  手机/平板上打开： http://' + ip + ':' + PORT + '   ← 同一 Wi-Fi 下用这个')
  }
  console.log('')
  console.log('  用完后直接关闭这个窗口即可。')
  console.log('')
})
