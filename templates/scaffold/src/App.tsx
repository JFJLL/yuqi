import { Routes, Route } from "react-router-dom"

function ProjectReady() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0c0e",
        color: "#f5f7f2",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 520, textAlign: "center" }}>
        <div style={{ color: "#d8ff43", fontSize: 12, letterSpacing: ".16em" }}>
          VIBEX PROJECT READY
        </div>
        <h1 style={{ margin: "16px 0 10px", fontSize: 36 }}>项目已准备好</h1>
        <p style={{ margin: 0, color: "#8d9298", lineHeight: 1.7 }}>
          页面代码生成后会显示在这里。当前预览不会跳转到平台首页。
        </p>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      {/* rh-kiki-page-code 在 src/pages/<Name>/ 下生成页面后, 在这里挂路由:
          <Route path="/" element={<HomePage />} /> */}
      <Route path="*" element={<ProjectReady />} />
    </Routes>
  )
}
