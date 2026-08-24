import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmployeeFilters } from "@/components/org/EmployeeFilters"
import { EmployeeTable } from "@/components/org/EmployeeTable"
import { EmployeeDialog } from "@/components/org/EmployeeDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import type { OrgProps } from "./useOrg"

// 门店员工视图: 只消费 props, 不自调逻辑 hook
export function OrgPage({
  regions,
  stores,
  rows,
  filters,
  page,
  total,
  totalPages,
  loading,
  saving,
  dialogOpen,
  editing,
  setFilters,
  setPage,
  openCreate,
  openEdit,
  closeDialog,
  handleSave,
  handleExport,
}: OrgProps) {
  return (
    <section
      className="bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
      style={{ boxShadow: "var(--elev-ring)" }}
    >
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="m-0 text-base font-semibold">门店与员工管理</h2>
            <p className="mt-0.5 mb-0 text-muted-foreground text-xs">维护组织、门店、岗位、员工档案和账号状态。</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
          onClick={openCreate}
        >
          <UserPlus className="w-4 h-4" />
          新增员工
        </Button>
      </div>
      <div className="p-4">
        <EmployeeFilters filters={filters} regions={regions} onChange={setFilters} onExport={handleExport} />
        <EmployeeTable rows={rows} loading={loading} onEdit={openEdit} />
        <TablePagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
      </div>
      <EmployeeDialog
        open={dialogOpen}
        initial={editing}
        stores={stores}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSave}
      />
    </section>
  )
}
