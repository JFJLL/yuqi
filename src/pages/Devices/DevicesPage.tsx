import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeviceFilters } from "@/components/devices/DeviceFilters"
import { DeviceTable } from "@/components/devices/DeviceTable"
import { BindDialog } from "@/components/devices/BindDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import type { DevicesProps } from "./useDevices"

// 设备绑定视图: 只消费 props, 不自调逻辑 hook
export function DevicesPage({
  employees,
  stores,
  rows,
  filters,
  page,
  total,
  totalPages,
  loading,
  saving,
  dialogOpen,
  adjusting,
  setFilters,
  setPage,
  openCreate,
  openAdjust,
  closeDialog,
  handleSave,
  handleUnbind,
}: DevicesProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">设备绑定管理</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">设备码绑定销售人员、门店和使用状态。</p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" />
          新增绑定
        </Button>
      </div>
      <div className="p-4">
        <DeviceFilters filters={filters} stores={stores} onChange={setFilters} />
        <DeviceTable rows={rows} loading={loading} onAdjust={openAdjust} onUnbind={handleUnbind} />
        <TablePagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
      </div>
      <BindDialog
        open={dialogOpen}
        deviceNo={adjusting?.device_code ?? ""}
        employees={employees}
        stores={stores}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSave}
      />
    </section>
  )
}
