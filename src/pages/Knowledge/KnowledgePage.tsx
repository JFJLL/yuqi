import { Plus, Search, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RuleTable } from "@/components/knowledge/RuleTable"
import { RuleDialog } from "@/components/knowledge/RuleDialog"
import { RuleVersionsDialog } from "@/components/knowledge/RuleVersionsDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import type { KnowledgeProps } from "./useKnowledge"

// 规则库视图: 合规风险规则维护 (新增/编辑/启停/版本历史)
export function KnowledgePage({
  rows,
  loading,
  stats,
  keyword,
  page,
  total,
  totalPages,
  setKeyword,
  setPage,
  dialogOpen,
  editing,
  saving,
  setDialogOpen,
  setEditing,
  handleSubmit,
  versionsRule,
  versions,
  versionsLoading,
  closeVersions,
}: KnowledgeProps) {
  return (
    <div>
      <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
        <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">合规规则库</h2>
            <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
              共 {stats.ruleTotal} 条规则 · 已启用 {stats.ruleEnabled} 条 · 每次修改自动生成版本
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="min-h-9 w-56 border border-border rounded-lg bg-background text-foreground outline-none pl-8 pr-2.5 text-sm focus:border-primary"
                placeholder="搜索规则编码/名称"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              新增规则
            </Button>
            <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <RuleTable rows={rows} />
          {loading && rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          )}
          <TablePagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      </section>
      <RuleDialog
        open={dialogOpen}
        editing={editing}
        saving={saving}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
      {versionsRule && (
        <RuleVersionsDialog
          ruleName={versionsRule.name}
          versions={versions}
          loading={versionsLoading}
          onClose={closeVersions}
        />
      )}
    </div>
  )
}
