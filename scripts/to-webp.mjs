/**
 * 把 src/assets 下所有 PNG 压缩尺寸（最大边长超 256px 的缩到 256px 内）并转为 WebP。
 * 会同时覆盖原 png（压成小尺寸作为源文件）并生成同名 .webp。
 * 新增/更换图片后执行：pnpm to-webp
 */
import { readdirSync, statSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/assets')
// 勋章等展示尺寸小，最大边长压到 256 足够清晰
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

let ok = 0
for (const p of listPngs(assetsDir)) {
  const meta = await sharp(p).metadata()
  const needResize = !!meta.width && !!meta.height && (meta.width > MAX || meta.height > MAX)
  const pipeline = needResize
    ? sharp(p).resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    : sharp(p)

  const tmpPng = `${p}.tmp.png`
  // 先写压缩后的 png（覆盖原源文件），再基于它生成 webp，保证 webp 比 png 新
  await pipeline.png({ compressionLevel: 9 }).toFile(tmpPng)
  renameSync(tmpPng, p)
  await sharp(p).webp({ quality: 80, effort: 4 }).toFile(p.replace(/\.png$/, '.webp'))

  const dim = `${meta.width}x${meta.height}${needResize ? ` → 缩至 ${MAX}x${MAX} 内` : ''}`
  const pngKB = (statSync(p).size / 1024).toFixed(1)
  const webpKB = (statSync(p.replace(/\.png$/, '.webp')).size / 1024).toFixed(1)
  console.log(`${p.replace(assetsDir + '/', '')}: ${dim} | png ${pngKB}KB / webp ${webpKB}KB`)
  ok++
}
console.log(`done: ${ok} png 已压缩并生成 webp`)
