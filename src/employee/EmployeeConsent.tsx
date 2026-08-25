import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { submitConsent } from "./employeeApi"

export function EmployeeConsent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleAgree() {
    setLoading(true)
    try {
      await submitConsent("v1")
      toast.success("已确认录音知情同意")
      navigate("/employee/home", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">录音知情同意</h2>
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3 text-sm leading-relaxed">
          <p>为确保销售服务合规，工作期间佩戴的智能工牌将对销售对话进行录音，并由系统进行转写与合规分析。请您知悉并确认：</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-muted-foreground">
            <li>录音仅用于合规巡检与问题复核，不用于其他用途；</li>
            <li>转写与规则分析结果仅为疑似风险提示，最终判断由授权管理人员完成；</li>
            <li>如对识别结果有异议，可通过员工端发起申诉。</li>
          </ol>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button onClick={handleAgree} disabled={loading} className="flex-1">
          {loading ? "提交中…" : "我已知晓并同意"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/employee/home")}>暂不确认</Button>
      </div>
    </div>
  )
}
