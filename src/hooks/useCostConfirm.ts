// Canonical billing-confirm wrapper. Any page that calls a paid RHAPI helper
// (callAigcAndPoll / callAiApp(.../run) with a real charge / callLlmWithFallback with a
// paid model) must route that call through `runWithCostConfirm` returned here instead
// of calling the paid helper directly. See vibex_billing_contract.yaml for why this
// exact shape matters: the publish audit treats a call wrapped in
// `runWithCostConfirm(...)` as user-triggered by construction, so using this hook is
// how a normally-developed page passes the audit without any extra onClick plumbing.
//
// Usage:
//   const cc = useCostConfirm()
//   const onGenerateClick = () => {
//     cc.runWithCostConfirm(async () => {
//       await callAigcAndPoll("demo-model", body)
//     }, "预计消耗约 ¥0.76，实际扣费以 RunningHub 为准")
//   }
//   return (
//     <>
//       <button onClick={onGenerateClick}>生成</button>
//       {/* Spread the hook result directly — CostConfirmDialog's prop names are
//           Pick<UseCostConfirmResult, ...>, i.e. they match this hook's fields 1:1.
//           Never hand-name them (open / priceText / onConfirm / onCancel are WRONG
//           and silently pass `undefined`, so the dialog never opens). */}
//       <CostConfirmDialog {...cc} />
//     </>
//   )
//
// Do not add a global "don't remind me" key, and do not fall back to
// `window.confirm`/`alert`/`prompt` — both are explicitly disallowed by the contract.
import { useCallback, useMemo, useRef, useState } from "react"
import { currentVibexAppId, hasCostConfirmedToday, rememberCostConfirmedToday } from "@/lib/costConfirm"

export function useCostConfirm() {
  const appId = useMemo(() => currentVibexAppId(), [])
  const [costConfirmOpen, setCostConfirmOpen] = useState(false)
  const [costConfirmPriceText, setCostConfirmPriceText] = useState("")
  const [dontShowToday, setDontShowToday] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)

  // Call this from a click/submit handler with the action to run once confirmed.
  // If the user already confirmed today for this app, `action` runs immediately —
  // that is still "user-triggered" because the earlier confirmation itself came from
  // an explicit click, and the suppression is scoped to this app for today only.
  const runWithCostConfirm = useCallback(
    (action: () => void, priceText: string) => {
      if (hasCostConfirmedToday(appId)) {
        action()
        return
      }
      pendingActionRef.current = action
      setCostConfirmPriceText(priceText)
      setCostConfirmOpen(true)
    },
    [appId],
  )

  const confirmCostAction = useCallback(() => {
    setCostConfirmOpen(false)
    if (dontShowToday) rememberCostConfirmedToday(appId)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    action?.()
  }, [appId, dontShowToday])

  const cancelCostConfirm = useCallback(() => {
    setCostConfirmOpen(false)
    pendingActionRef.current = null
  }, [])

  return {
    runWithCostConfirm,
    costConfirmOpen,
    costConfirmPriceText,
    dontShowToday,
    setDontShowToday,
    confirmCostAction,
    cancelCostConfirm,
  }
}

export type UseCostConfirmResult = ReturnType<typeof useCostConfirm>
