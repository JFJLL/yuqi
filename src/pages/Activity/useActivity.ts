import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  type Employee,
  type Store,
} from "@/lib/admin"
import type { CourseFormValues } from "@/components/activity/CourseDialog"
import type { CreateTaskFormValues } from "@/components/activity/CreateTaskDialog"

export interface RecommendationProduct {
  name: string
  brand?: string
  specification?: string
  dosage?: string
}

export interface RecommendationRecord {
  id: string
  employee: string
  store: string
  query: string
  result_json?: {
    products?: RecommendationProduct[]
    rationale?: string
    contraindications?: string[]
  }
  safety: string
  source_count: number
  sync_status: string
  occurred_at: string
  created?: string
}

export interface RecommendationListItem extends RecommendationRecord {
  employeeName: string
  storeName: string
  productsText: string
}

export interface CourseRecord {
  id: string
  title: string
  category: string
  summary: string
  status: string
  created?: string
}

export interface TrainingTaskRecord {
  id: string
  course: string
  employee: string
  store: string
  source_issue: string
  due_at: string
  status: string
  created?: string
}

export interface LearningProgressRecord {
  id: string
  task: string
  employee: string
  course: string
  unit_index: number
  progress_percent: number
  completed_at: string
  status: string
}

export interface LearningAttemptRecord {
  id: string
  task: string
  employee: string
  score: number
  passed: boolean
  submitted_at: string
}

export interface LearningRow {
  id: string
  employeeName: string
  storeName: string
  courseTitle: string
  sourceIssue: string
  progress: number
  status: string
  score: string | number
  updatedAt: string
}

export interface ActivityFilterState {
  keyword: string
  storeId: string
  safety: string
}

export function useActivity() {
  const [activeTab, setActiveTab] = useState<"recommendation" | "learning" | "courses">("recommendation")
  const [recommendations, setRecommendations] = useState<RecommendationRecord[]>([])
  const [courses, setCourses] = useState<CourseRecord[]>([])
  const [tasks, setTasks] = useState<TrainingTaskRecord[]>([])
  const [progressList, setProgressList] = useState<LearningProgressRecord[]>([])
  const [attempts, setAttempts] = useState<LearningAttemptRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [filters, setFilters] = useState<ActivityFilterState>({ keyword: "", storeId: "", safety: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 弹窗
  const [viewingItem, setViewingItem] = useState<RecommendationListItem | null>(null)
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [recRes, courseRes, taskRes, progRes, attRes, empRes, storeRes] = await Promise.all([
        fetchList<RecommendationRecord>("recommendations", { perPage: 500 }).catch(() => ({ items: [] as RecommendationRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<CourseRecord>("learning_courses", { perPage: 200 }).catch(() => ({ items: [] as CourseRecord[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<TrainingTaskRecord>("learning_tasks", { perPage: 500 }).catch(() => ({ items: [] as TrainingTaskRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<LearningProgressRecord>("learning_progress", { perPage: 500 }).catch(() => ({ items: [] as LearningProgressRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<LearningAttemptRecord>("learning_attempts", { perPage: 500 }).catch(() => ({ items: [] as LearningAttemptRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
      ])

      setRecommendations(recRes.items || [])
      setCourses(courseRes.items || [])
      setTasks(taskRes.items || [])
      setProgressList(progRes.items || [])
      setAttempts(attRes.items || [])
      setEmployees(empRes.items || [])
      setStores(storeRes.items || [])
    } catch {
      toast.error("业务记录加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees])
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores])
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses])

  // 荐药列表项
  const items: RecommendationListItem[] = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return recommendations
      .map((rec) => {
        const employeeName = employeeMap.get(rec.employee) || rec.employee || "-"
        const storeName = storeMap.get(rec.store) || rec.store || "-"
        const products = (rec.result_json?.products || []).map((p) => `${p.name}${p.brand ? `（${p.brand}）` : ""}`).join(" + ") || "未形成推荐"

        return {
          ...rec,
          employeeName,
          storeName,
          productsText: products,
        }
      })
      .filter((rec) => {
        if (filters.storeId && rec.store !== filters.storeId && rec.storeName !== filters.storeId) return false
        if (filters.safety && rec.safety !== filters.safety) return false
        if (q) {
          const text = `${rec.query} ${rec.employeeName} ${rec.storeName} ${rec.productsText}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at || b.created || "").localeCompare(a.occurred_at || a.created || ""))
  }, [recommendations, filters, employeeMap, storeMap])

  // 学习记录行
  const learningRows: LearningRow[] = useMemo(() => {
    return tasks.map((task) => {
      const prog = progressList.find((p) => p.task === task.id || (p.employee === task.employee && p.course === task.course))
      const att = attempts.find((a) => a.task === task.id || a.employee === task.employee)
      const empName = employeeMap.get(task.employee) || task.employee || "-"
      const stName = storeMap.get(task.store) || task.store || "-"
      const cTitle = courseMap.get(task.course) || task.course || "通用合规规范课程"

      const percent = prog ? prog.progress_percent : (task.status === "COMPLETED" ? 100 : 0)
      const score = att ? `${att.score} 分 (${att.passed ? "及格" : "未及格"})` : (percent >= 100 ? "待考试" : "-")
      const status = task.status === "COMPLETED" ? "已完成" : percent > 0 ? "学习中" : "待学习"

      return {
        id: task.id,
        employeeName: empName,
        storeName: stName,
        courseTitle: cTitle,
        sourceIssue: task.source_issue || "-",
        progress: percent,
        status,
        score,
        updatedAt: task.created ? task.created.slice(0, 16) : "-",
      }
    })
  }, [tasks, progressList, attempts, employeeMap, storeMap, courseMap])

  // 创建课程
  async function handleCreateCourse(values: CourseFormValues) {
    setSaving(true)
    try {
      const course = await createRecord<CourseRecord>("learning_courses", {
        title: values.title.trim(),
        category: values.category,
        summary: values.summary.trim(),
        target_issue_types: values.target_issue_types,
        status: values.status,
      })

      // 写入章节
      for (let i = 0; i < values.units.length; i++) {
        const u = values.units[i]
        await createRecord("learning_course_units", {
          course: course.id,
          title: u.title,
          content: u.content,
          duration_seconds: u.duration_seconds || 300,
          sort_order: i + 1,
        })
      }

      // 创建默认考试与试卷快照
      const exam = await createRecord<{ id: string }>("learning_exams", {
        course: course.id,
        title: `${values.title}·结业考核`,
        pass_score: 80,
        max_attempts: 3,
        time_limit_minutes: 30,
        version: 1,
      })

      await createRecord("learning_questions", {
        exam: exam.id,
        type: "single",
        stem: "在向顾客推荐非处方药时，以下哪种做法符合合规要求？",
        options_json: ["详细询问顾客症状与禁忌", "推荐利润最高的药品并夸大疗效", "承诺一周内彻底根治", "隐瞒不良反应"],
        answer: "详细询问顾客症状与禁忌",
        score: 100,
        explanation: "药店营业人员应客观、真实提供用药指导，详细询问禁忌。",
        sort_order: 1,
      })

      await createRecord("learning_exam_versions", {
        exam: exam.id,
        version: 1,
        snapshot_json: {
          title: `${values.title}·结业考核`,
          pass_score: 80,
          questions: [
            {
              stem: "在向顾客推荐非处方药时，以下哪种做法符合合规要求？",
              options: ["详细询问顾客症状与禁忌", "推荐利润最高的药品并夸大疗效", "承诺一周内彻底根治", "隐瞒不良反应"],
              answer: "详细询问顾客症状与禁忌",
              score: 100,
            }
          ]
        }
      })

      toast.success("课程已发布并生成标准考核试卷")
      setCourseDialogOpen(false)
      await loadData()
    } catch {
      toast.error("课程发布失败")
    } finally {
      setSaving(false)
    }
  }

  // 派发培训任务
  async function handleCreateTask(values: CreateTaskFormValues) {
    setSaving(true)
    try {
      await createRecord("learning_tasks", {
        course: values.courseId,
        employee: values.employeeId || "",
        store: values.storeId || "",
        source_issue: values.sourceIssue || "",
        due_at: values.dueAt,
        status: "PENDING",
      })

      toast.success("培训任务已派发至员工端")
      setTaskDialogOpen(false)
      await loadData()
    } catch {
      toast.error("派发任务失败")
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    if (items.length === 0) {
      toast.error("当前没有可导出的荐药记录")
      return
    }
    const head = ["时间", "员工", "门店", "主诉/咨询", "推荐药品", "安全性", "医学依据数", "数据源状态"]
    const lines = items.map((r) =>
      [r.occurred_at || r.created || "-", r.employeeName, r.storeName, r.query, r.productsText, r.safety, r.source_count, r.sync_status || "未接入外部ERP"]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = ["\uFEFF" + head.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "员工荐药记录.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${items.length} 条荐药记录`)
  }

  return {
    activeTab,
    setActiveTab,
    items,
    courses,
    learningRows,
    stores,
    employees,
    filters,
    loading,
    saving,
    setFilters,
    reload: loadData,
    viewingItem,
    openDetail: setViewingItem,
    closeDetail: () => setViewingItem(null),
    courseDialogOpen,
    openCourseDialog: () => setCourseDialogOpen(true),
    closeCourseDialog: () => setCourseDialogOpen(false),
    handleCreateCourse,
    taskDialogOpen,
    openTaskDialog: () => setTaskDialogOpen(true),
    closeTaskDialog: () => setTaskDialogOpen(false),
    handleCreateTask,
    handleExport,
  }
}

export type ActivityProps = ReturnType<typeof useActivity>
