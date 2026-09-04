/**
 * 把 src/assets 下所有 PNG 批量转成 WebP（保留 png 源文件）。
 * 用途：勋章图等体积较大的图转 webp 后加载更快；Vite 只打包被引用的文件，
 * 未被引用的 png 源文件不会进 dist。新增图片后执行：pnpm to-webp
 */
import { readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/assets')

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

const pngs = listPngs(assetsDir)
let ok = 0
for (const p of pngs) {
  const webp = p.replace(/\.png$/, '.webp')
  await sharp(p).webp({ quality: 80, effort: 4 }).toFile(webp)
  const before = (statSync(p).size / 1024).toFixed(1)
  const after = (statSync(webp).size / 1024).toFixed(1)
  console.log(`${p.replace(assetsDir + '/', '')}: ${before}KB -> ${after}KB`)
  ok++
}
console.log(`done: ${ok} png -> webp`)
