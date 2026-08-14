import { BarChart3, ChartNoAxesCombined, FileBarChart, UserRoundCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ReportSummary {
  key: string
  title: string
  desc: string
  points: string[]
}

interface ReportCardsProps {
  reports: ReportSummary[]
  onView: (report: ReportSummary) => void
}

const ICONS: Record<string, typeof FileBarChart> = {
  monthly: FileBarChart,
  growth: UserRoundCheck,
  category: ChartNoAxesCombined,
}

export function ReportCards({ reports, onView }: ReportCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
      {reports.map((report) => {
        const Icon = ICONS[report.key] ?? BarChart3
        return (
          <article key={report.key} className="bg-card border border-border rounded-lg p-3.5 grid gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <strong className="text-[15px]">{report.title}</strong>
            </div>
            <p className="m-0 text-muted-foreground text-sm leading-relaxed">{report.desc}</p>
            <div>
              <Button
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => onView(report)}
              >
                查看报表
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
