import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '**/templates/**',
    '**/vibex-local/**',
    '**/pocketbase/pb_data/**',
    '**/pocketbase/pb_hooks/**',
    '**/.migration/**',
    '**/scripts/**',
    '**/server/**',
    '**/deploy/**',
    '**/tests/**',
  ]),
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
    },
  },
  {
    // 覆盖规则必须放在 extends 之后, 否则会被 flat config 合并顺序覆盖。
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 本工程页面约定: pages/<Name>/index.tsx 同时导出 useX 业务 Hook 与 XRoute 组件,
      // 该约定与 react-refresh 的 only-export-components 冲突, 关闭该规则避免全量报错。
      'react-refresh/only-export-components': 'off',
      // 既有页面存在 effect 内同步 setState 的模式(历史代码), 降级为警告不阻断。
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
