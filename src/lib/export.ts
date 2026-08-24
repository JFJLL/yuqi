// 客户端导出工具

// 导出 CSV (带 BOM, Excel 直接打开不乱码)
export function exportCsv(filename: string, head: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => `"${String(cell ?? "").replace(/"/g, '""')}"`
  const csv = ["\uFEFF" + head.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
