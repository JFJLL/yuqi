import { TasksPage } from "./TasksPage"
import { useTasks } from "./useTasks"

// 整改任务页入口: 组装逻辑与视图
export function TasksRoute() {
  const tasksProps = useTasks()
  return <TasksPage {...tasksProps} />
}
