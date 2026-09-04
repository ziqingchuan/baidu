/**
 * 部署前图片检查：发现「未压缩尺寸（最大边长 >256px）」或「未生成 / 过期 webp」的 png 时，
 * 列出问题并以非 0 退出码终止部署。修复方式：pnpm to-webp
 * 通过 npm/pnpm 的 predeploy / pregh-deploy 钩子自动在部署前执行。
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/assets')
const MAX = 256

function listPngs(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...listPngs(p))
    else if (p.endsWith('.png')) out.push(p)
  }
  return out
}

const issues = []
for (const p of listPngs(assetsDir)) {
  const rel = p.replace(assetsDir + '/', '')
  const webp = p.replace(/\.png$/, '.webp')
  const meta = await sharp(p).metadata()
  if (meta.width > MAX || meta.height > MAX) {
    issues.push(`${rel}：${meta.width}x${meta.height}，超过 ${MAX}px 未压缩`)
  } else if (!existsSync(webp)) {
    issues.push(`${rel}：缺少对应 webp`)
  } else if (statSync(webp).mtimeMs < statSync(p).mtimeMs) {
    issues.push(`${rel}：png 比 webp 新，需要重新生成`)
  }
}

if (issues.length) {
  console.error('❌ 图片检查未通过，请先执行 pnpm to-webp 处理后再部署：')
  for (const i of issues) console.error('   - ' + i)
  process.exit(1)
} else {
  console.log('✅ 图片检查通过：所有 png 已压缩尺寸且 webp 已就绪')
}
