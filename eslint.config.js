import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist 构建产物、scaffold 模板(含 {{PLACEHOLDER}} 非 JS 语法)、嵌套 worktree 均不参与 lint
  globalIgnores(['dist', 'templates/scaffold', '.worktrees']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // 仓库内嵌了 worktree (含独立 tsconfig) 时, 显式固定 tsconfig 根目录,
        // 避免 '@typescript-eslint' 解析到多个候选 TSConfigRootDirs。
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 项目既有约定: hooks 与组件同文件导出; 多处刻意在 effect 内同步本地编辑状态。
      // 这两条是新版插件规则, 与既有代码风格冲突, 关闭以免误报。
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
