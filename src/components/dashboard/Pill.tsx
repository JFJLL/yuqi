import type { ReactNode } from "react"

export type PillTone = "red" | "amber" | "green" | "blue" | "violet" | "gray"

const TONE_CLASSES: Record<PillTone, string> = {
  red: "text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.08)] border-[hsl(var(--destructive)/0.28)]",
  amber: "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.3)]",
  green: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.28)]",
  blue: "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.08)] border-[hsl(var(--info)/0.28)]",
  violet: "text-[hsl(var(--violet))] bg-[hsl(var(--violet)/0.08)] border-[hsl(var(--violet)/0.28)]",
  gray: "text-muted-foreground bg-muted border-border",
}

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none border whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

export function riskTone(risk: string): PillTone {
  if (risk === "高") return "red"
  if (risk === "中") return "amber"
  return "green"
}

const STATE_TONE: Record<string, PillTone> = {
  待整改: "amber",
  申诉中: "violet",
  已完成: "green",
  在线: "green",
  录音中: "blue",
  离线: "gray",
  在职: "green",
  停用: "gray",
  有问题: "red",
  无问题: "green",
  进行中: "blue",
  逾期: "red",
  待复核: "amber",
  已通过: "green",
  已驳回: "red",
  成功: "green",
  失败: "red",
  重试中: "amber",
  已启用: "green",
  优化中: "amber",
  // v1 英文状态值
  APPEALING: "violet",
  APPEAL_APPROVED: "green",
  APPEAL_REJECTED: "red",
  PENDING: "amber",
  DISMISSED: "red",
  CONFIRMED: "green",
  SUBMITTED: "blue",
  OVERDUE: "red",
  ESCALATED: "red",
  CLOSED: "green",
}

export function stateTone(state: string): PillTone {
  return STATE_TONE[state] ?? "gray"
}

// v1 状态值 → 中文展示 (用于直接渲染英文状态字段的场合)
export const STATE_LABELS: Record<string, string> = {
  APPEALING: "申诉中",
  APPEAL_APPROVED: "申诉通过",
  APPEAL_REJECTED: "申诉驳回",
  PENDING: "待复核",
  DISMISSED: "已驳回",
  CONFIRMED: "已完成",
  SUBMITTED: "已提交",
  OVERDUE: "已逾期",
  ESCALATED: "已升级",
  CLOSED: "已关闭",
}
