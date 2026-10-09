import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"

export interface CustomSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  className?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative select-none text-xs ${className}`}>
      <div
        onClick={() => setOpen(!open)}
        className={`h-9 px-3 border rounded-[6px] bg-white flex items-center justify-between cursor-pointer transition-all ${
          open ? "border-[#1672a8] ring-2 ring-[#1672a8]/15" : "border-[#cfd9e4] hover:border-[#b4c3d3]"
        }`}
      >
        <span className={selected ? "text-[#172033] font-medium truncate" : "text-[#94a3b8]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#65738a] transition-transform ${open ? "rotate-180 text-[#1672a8]" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-[#cfd9e4] rounded-[6px] shadow-lg max-h-56 overflow-y-auto py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-center text-[#94a3b8] text-xs">无匹配选项</div>
          ) : (
            options.map((opt) => {
              const active = opt.value === value
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    active ? "bg-[#e8f1fa] text-[#1672a8] font-semibold" : "text-[#172033] hover:bg-[#f8fafc]"
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && <span className="text-[10px] text-[#65738a] font-normal">{opt.sublabel}</span>}
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-[#1672a8] shrink-0" />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}