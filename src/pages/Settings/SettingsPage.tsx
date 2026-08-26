import { Save, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SettingsProps } from "./useSettings"

export function SettingsPage({
  activeTab,
  setActiveTab,
  rules,
  knowledgeItems,
  engineForm,
  setEngineForm,
  saving,
  handleToggleRule,
  handleSaveEngineSettings,
}: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">系统参数与合规知识库配置</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">
              配置 ASR 转写、通用 AI 分析模型、数据保留周期与合规巡检规则库。
            </p>
          </div>
          {activeTab === "engine" && (
            <Button
              size="sm"
              onClick={handleSaveEngineSettings}
              disabled={saving}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5"
            >
              <Save className="w-4 h-4" />
              {saving ? "保存中…" : "保存系统参数"}
            </Button>
          )}
        </div>

        {/* 标签栏 */}
        <div className="px-4 pt-3 pb-0 border-b border-[#edf1f5] flex items-center gap-1 bg-[#f8fafc]">
          <button
            onClick={() => setActiveTab("engine")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "engine"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            服务与引擎参数
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "rules"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            合规巡检规则
          </button>
          <button
            onClick={() => setActiveTab("knowledge")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "knowledge"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            医药知识词库
          </button>
        </div>

        {/* 1. 服务与引擎参数 Tab */}
        {activeTab === "engine" && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">本地 ASR 接口地址</label>
                <Input
                  value={engineForm.local_asr_url}
                  onChange={(e) => setEngineForm({ ...engineForm, local_asr_url: e.target.value })}
                  placeholder="http://127.0.0.1:8000/api/asr"
                  className="h-9 border-[#cfd9e4] font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">备用 ASR 接口地址</label>
                <Input
                  value={engineForm.backup_asr_url}
                  onChange={(e) => setEngineForm({ ...engineForm, backup_asr_url: e.target.value })}
                  placeholder="https://dashscope.aliyuncs.com/api/v1/services/audio/asr"
                  className="h-9 border-[#cfd9e4] font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">通用 AI 分析接口地址</label>
                <Input
                  value={engineForm.analysis_api_url}
                  onChange={(e) => setEngineForm({ ...engineForm, analysis_api_url: e.target.value })}
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  className="h-9 border-[#cfd9e4] font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">AI 分析模型名称</label>
                <Input
                  value={engineForm.analysis_model}
                  onChange={(e) => setEngineForm({ ...engineForm, analysis_model: e.target.value })}
                  placeholder="qwen-plus"
                  className="h-9 border-[#cfd9e4] font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">队列回退阈值 (条)</label>
                <Input
                  type="number"
                  value={engineForm.asr_fallback_queue_threshold}
                  onChange={(e) => setEngineForm({ ...engineForm, asr_fallback_queue_threshold: Number(e.target.value) })}
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">ASR 响应超时时间 (秒)</label>
                <Input
                  type="number"
                  value={engineForm.asr_timeout_seconds}
                  onChange={(e) => setEngineForm({ ...engineForm, asr_timeout_seconds: Number(e.target.value) })}
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">音频录音保留周期 (天)</label>
                <Input
                  type="number"
                  value={engineForm.recording_retention_days}
                  onChange={(e) => setEngineForm({ ...engineForm, recording_retention_days: Number(e.target.value) })}
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">转写文本保留周期 (天)</label>
                <Input
                  type="number"
                  value={engineForm.transcript_retention_days}
                  onChange={(e) => setEngineForm({ ...engineForm, transcript_retention_days: Number(e.target.value) })}
                  className="h-9 border-[#cfd9e4]"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#167a5b]" />
                <span className="text-xs text-[#172033] font-medium">敏感鉴权令牌脱敏保护已开启（所有 API Key 仅在服务端持久化，绝不回显至浏览器前端）</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. 合规巡检规则 Tab */}
        {activeTab === "rules" && (
          <div className="p-4 flex flex-col gap-2.5">
            {rules.length === 0 ? (
              <div className="py-12 text-center text-[#65738a]">暂无巡检规则</div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 bg-white border border-[#dbe3ec] rounded-[6px] flex items-center justify-between gap-3 shadow-2xs hover:border-[#1672a8] transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-[#172033]">{rule.name}</strong>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        rule.risk === "高" ? "bg-[#fae9e9] text-[#a83434]" : rule.risk === "中" ? "bg-[#fff2dc] text-[#946013]" : "bg-[#e6f4ef] text-[#147054]"
                      }`}>
                        {rule.risk}风险
                      </span>
                    </div>
                    <span className="text-[#65738a] text-[11px] leading-relaxed">{rule.description}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => handleToggleRule(rule, e.target.checked)}
                      className="w-4 h-4 rounded text-[#1672a8] focus:ring-[#1672a8]"
                    />
                    <span className="text-xs font-semibold text-[#172033]">
                      {rule.enabled ? "已启用" : "已停用"}
                    </span>
                  </label>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. 医药知识词库 Tab */}
        {activeTab === "knowledge" && (
          <div className="p-4 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            {knowledgeItems.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-[#65738a]">暂无知识词库数据</div>
            ) : (
              knowledgeItems.map((item) => (
                <article key={item.id} className="p-3.5 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-[#172033]">{item.name}</strong>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[#e5f1f9] text-[#176d9e]">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#65738a] m-0 leading-relaxed">{item.rule}</p>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  )
}
