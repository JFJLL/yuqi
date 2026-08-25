import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const assetsDir = path.join(process.cwd(), "dist", "assets")
try {
  const files = readdirSync(assetsDir)
  let count = 0
  for (const file of files) {
    if (file.endsWith(".js") || file.endsWith(".css") || file.endsWith(".svg")) {
      const fullPath = path.join(assetsDir, file)
      const raw = readFileSync(fullPath)
      const gzipped = zlib.gzipSync(raw, { level: 9 })
      writeFileSync(fullPath + ".gz", gzipped)
      count++
    }
  }
  console.log("[compress] 成功预压缩 " + count + " 个静态资源文件 (.gz)")
} catch (e) {
  console.error("[compress] 跳过静态预压缩: " + e.message)
}
