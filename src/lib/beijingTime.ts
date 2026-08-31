// PocketBase 中的业务时间字段 (occurred_at 等) 统一以 UTC 字符串存储，
// 展示层需要转换成北京时间 (UTC+8, 无夏令时) 后再显示。

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 解析 PocketBase 时间字符串 ("YYYY-MM-DD HH:mm:ss(.sss)Z" 或 ISO)，失败返回 null。 */
export function parsePbDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = String(value)
    .trim()
    .replace(" ", "T")
    .replace(/Z$/i, "+00:00")
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function pbDateMs(value: string | null | undefined): number | null {
  return parsePbDate(value)?.getTime() ?? null
}

/**
 * 把 PocketBase UTC 时间格式化为北京时间。
 * 默认返回 "HH:mm:ss"；withDate 时返回 "YYYY-MM-DD HH:mm:ss"。
 */
export function formatBeijingTime(
  value: string | null | undefined,
  options?: { withDate?: boolean },
): string {
  const ms = pbDateMs(value)
  if (ms === null) return "-"
  // 中国不实行夏令时，固定 +8 小时后直接取 UTC 分量即为北京时间分量。
  const shifted = new Date(ms + BEIJING_OFFSET_MS).toISOString()
  const time = shifted.slice(11, 19)
  return options?.withDate ? `${shifted.slice(0, 10)} ${time}` : time
}

/**
 * 把 "YYYY-MM-DD" (北京时间日历日) 换算成 UTC 毫秒区间 [start, end)。
 * 无效输入返回 null。
 */
export function beijingDayRangeMs(date: string): [number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim())
  if (!match) return null
  const start = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`)
  if (Number.isNaN(start.getTime())) return null
  const startMs = start.getTime()
  return [startMs, startMs + 24 * 60 * 60 * 1000]
}
