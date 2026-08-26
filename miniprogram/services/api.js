const config = require('../config')
const seed = require('./mock-data')

const STORAGE_KEY = 'medical_inspection_demo_state_v2'
const CURRENT_USER_KEY = 'eyang_current_user_v1'
const WISEDIAG_CACHE_KEY = 'wisediag_recommendation_cache_v1'

const PRODUCT_KEYWORDS = {
  苏黄止咳胶囊: ['干咳', '咳嗽', '咽痒', '呛咳'],
  西瓜霜润喉片: ['咽痒', '咽痛', '嗓子疼', '咽喉不适'],
  维生素C咀嚼片: ['维生素', '营养补充']
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getState() {
  const saved = wx.getStorageSync(STORAGE_KEY)
  if (saved) return saved
  const initial = clone(seed)
  wx.setStorageSync(STORAGE_KEY, initial)
  return initial
}

function setState(state) {
  wx.setStorageSync(STORAGE_KEY, state)
}

function mockResult(data, delay) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(data)), delay || 180)
  })
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: config.requestTimeout,
      header: {
        'content-type': 'application/json',
        authorization: wx.getStorageSync('access_token') ? `Bearer ${wx.getStorageSync('access_token')}` : ''
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
        else reject(new Error(res.data && res.data.message ? res.data.message : '请求失败'))
      },
      fail: reject
    })
  })
}

function getCurrentUser() {
  if (!config.useMock) {
    return clone(wx.getStorageSync(CURRENT_USER_KEY) || {
      id: '', name: '', role: '待确认', mobile: '', storeId: '',
      storeName: '', regionName: '', profileCompleted: false
    })
  }
  return clone(getState().currentUser)
}

function isManager(user) {
  return Boolean(user && user.role === '店长')
}

function hasCompletedProfile() {
  return Boolean(getCurrentUser().profileCompleted)
}

function getStoreOptions() {
  if (!config.useMock) return request({ url: '/auth/stores' })
  return mockResult(getState().stores, 240)
}

function hasSession() {
  return Boolean(wx.getStorageSync('access_token'))
}

function loginWithPhone(payload) {
  if (!config.useMock) {
    return request({ url: '/auth/wechat/login', method: 'POST', data: payload }).then((result) => {
      const token = result.token || (result.record && result.record.token) || ''
      const userRecord = result.record || result.user || {}
      const user = {
        id: userRecord.id || '',
        name: userRecord.display_name || userRecord.name || '员工',
        role: userRecord.role_code === 'STORE_MANAGER' ? '店长' : '营业员',
        mobile: userRecord.mobile || payload.phoneCode || '',
        storeId: userRecord.assigned_store || '',
        storeName: userRecord.storeName || '',
        profileCompleted: Boolean(userRecord.display_name || userRecord.name),
      }
      wx.setStorageSync('access_token', token)
      wx.setStorageSync(CURRENT_USER_KEY, user)
      return { token, user, requiresProfile: result.requiresProfile || false }
    })
  }
  wx.setStorageSync('access_token', `mock-token-${Date.now()}`)
  const user = getState().currentUser
  return mockResult({
    token: wx.getStorageSync('access_token'),
    user,
    requiresProfile: !user.profileCompleted
  }, 420)
}

function completeProfile(payload) {
  if (!config.useMock) {
    return request({ url: '/auth/profile', method: 'POST', data: payload }).then((result) => {
      wx.setStorageSync(CURRENT_USER_KEY, result.user)
      return result
    })
  }
  const state = getState()
  const name = String(payload.name || '').trim()
  const store = state.stores.find((item) => item.id === payload.storeId)
  if (!name || !store) return Promise.reject(new Error('请填写姓名并选择所属门店'))

  const binding = state.managerBindings.find((item) => item.storeId === store.id && (
    item.mobile === state.currentUser.mobile || item.name === name
  ))
  let staff = state.staff.find((item) => item.storeId === store.id && item.name === name)
  if (!binding && !staff) {
    staff = {
      id: `EMP-${Date.now()}`,
      name,
      role: '营业员',
      storeId: store.id,
      mobile: state.currentUser.mobile,
      deviceCode: '',
      deviceType: '',
      deviceStatus: '未绑定',
      statusTone: 'gray',
      battery: 0,
      todayRecords: 0,
      highRisk: 0,
      pending: 0,
      lastOnline: '暂无'
    }
    state.staff.push(staff)
  }

  state.currentUser = {
    id: binding ? binding.id : staff.id,
    name,
    role: binding ? '店长' : staff.role,
    mobile: state.currentUser.mobile,
    storeId: store.id,
    storeName: store.name,
    regionName: store.regionName,
    profileCompleted: true
  }
  if (binding) {
    state.device = null
  } else if (staff.deviceCode) {
    state.device = {
      code: staff.deviceCode,
      type: staff.deviceType,
      status: staff.deviceStatus,
      statusTone: staff.statusTone,
      battery: staff.battery,
      lastOnline: staff.lastOnline,
      boundAt: '2026-08-22 09:18',
      todayRecords: staff.todayRecords
    }
  } else {
    state.device = null
  }
  setState(state)
  return mockResult({ user: clone(state.currentUser), roleMatched: Boolean(binding) }, 360)
}

function resetProfileLink() {
  if (!config.useMock) {
    return request({ url: '/auth/profile/rebind', method: 'POST' }).then((result) => {
      const current = getCurrentUser()
      wx.setStorageSync(CURRENT_USER_KEY, {
        ...current, id: '', name: '', role: '待确认', storeId: '',
        storeName: '', regionName: '', profileCompleted: false
      })
      return result
    })
  }
  const state = getState()
  state.currentUser = {
    ...state.currentUser,
    id: '',
    name: '',
    role: '待确认',
    storeId: '',
    storeName: '',
    regionName: '',
    profileCompleted: false
  }
  state.device = null
  setState(state)
  return mockResult({ success: true })
}

function getDashboard() {
  if (!config.useMock) return request({ url: '/employee/dashboard' })
  const state = getState()
  const user = state.currentUser
  const storeFeedbacks = state.feedbacks.filter((item) => item.storeName === user.storeName)
  const visibleFeedbacks = isManager(user)
    ? storeFeedbacks
    : storeFeedbacks.filter((item) => item.employeeId === user.id)
  const pending = visibleFeedbacks.filter((item) => item.state === '待整改')
  const highRisk = visibleFeedbacks.filter((item) => item.risk === '高风险' && item.state !== '已完成')
  const storeStaff = state.staff.filter((item) => item.storeId === user.storeId)
  const onlineStaff = storeStaff.filter((item) => item.deviceStatus === '在线')
  const boundDevices = storeStaff.filter((item) => item.deviceCode)
  const latestFeedback = visibleFeedbacks[0] || null
  const inspected = isManager(user)
    ? storeStaff.reduce((sum, item) => sum + item.todayRecords, 0)
    : (state.device ? state.device.todayRecords : 0)
  return mockResult({
    user,
    isManager: isManager(user),
    device: state.device,
    metrics: {
      inspected,
      pending: pending.length,
      highRisk: highRisk.length,
      appeals: state.appeals.filter((item) => item.state !== '已完成').length,
      staffCount: storeStaff.length,
      onlineDevices: onlineStaff.length,
      offlineDevices: boundDevices.length - onlineStaff.length
    },
    latestFeedback: pending[0] || latestFeedback,
    staff: storeStaff.slice().sort((left, right) => {
      if (left.deviceStatus === right.deviceStatus) return right.pending - left.pending
      return left.deviceStatus === '在线' ? -1 : 1
    }).map((item) => ({ ...item, avatarText: item.name.slice(0, 1) })),
    learningTask: state.learningTasks[0]
  })
}

function getFeedbacks(filter) {
  if (!config.useMock) return request({ url: '/employee/feedbacks', data: { filter } })
  const state = getState()
  const user = state.currentUser
  const storeItems = state.feedbacks.filter((item) => item.storeName === user.storeName)
  const items = isManager(user) ? storeItems : storeItems.filter((item) => item.employeeId === user.id)
  if (!filter || filter === '全部') return mockResult(items)
  if (filter === '待处理') return mockResult(items.filter((item) => item.state === '待整改'))
  if (filter === '高风险') return mockResult(items.filter((item) => item.risk === '高风险'))
  return mockResult(items.filter((item) => item.state === filter))
}

function getFeedbackDetail(id) {
  if (!config.useMock) return request({ url: `/employee/feedbacks/${id}` })
  return mockResult(getState().feedbacks.find((item) => item.id === id) || null)
}

function markFeedbackLearned(id) {
  if (!config.useMock) return request({ url: `/employee/feedbacks/${id}/learned`, method: 'POST' })
  const state = getState()
  const target = state.feedbacks.find((item) => item.id === id)
  if (target) {
    target.learned = true
    target.state = '已完成'
    target.stateTone = 'green'
    const staff = state.staff.find((item) => item.id === target.employeeId)
    if (staff) {
      staff.pending = Math.max(0, staff.pending - 1)
      if (target.risk === '高风险') staff.highRisk = Math.max(0, staff.highRisk - 1)
    }
    setState(state)
  }
  return mockResult(target)
}

function submitAppeal(payload) {
  if (!config.useMock) return request({ url: '/employee/appeals', method: 'POST', data: payload })
  const state = getState()
  const feedback = state.feedbacks.find((item) => item.id === payload.feedbackId)
  const appeal = {
    id: `APPEAL-${Date.now()}`,
    feedbackId: payload.feedbackId,
    title: feedback ? feedback.title : '巡检问题申诉',
    reason: payload.reason,
    state: '店长复核',
    stateTone: 'amber',
    requestRecording: payload.requestRecording,
    attachments: payload.attachments || [],
    createdAt: '刚刚'
  }
  state.appeals.unshift(appeal)
  if (feedback) {
    feedback.state = '申诉中'
    feedback.stateTone = 'blue'
  }
  setState(state)
  return mockResult(appeal, 320)
}

function getDevice() {
  if (!config.useMock) return request({ url: '/employee/device' })
  return mockResult(getState().device)
}

function getStoreDeviceOverview() {
  if (!config.useMock) return request({ url: '/manager/store/devices' })
  const state = getState()
  const staff = state.staff.filter((item) => item.storeId === state.currentUser.storeId)
  const bound = staff.filter((item) => item.deviceCode)
  const online = bound.filter((item) => item.deviceStatus === '在线')
  return mockResult({
    storeName: state.currentUser.storeName,
    summary: {
      staffCount: staff.length,
      boundCount: bound.length,
      onlineCount: online.length,
      offlineCount: bound.length - online.length,
      unboundCount: staff.length - bound.length
    },
    staff: staff.map((item) => ({ ...item, avatarText: item.name.slice(0, 1) }))
  })
}

function bindDevice(code) {
  if (!config.useMock) return request({ url: '/employee/device/bind', method: 'POST', data: { code } })
  const state = getState()
  state.device = {
    code,
    type: code.indexOf('4G') === 0 ? '4G智能工牌' : 'WiFi智能工牌',
    status: '在线',
    statusTone: 'green',
    battery: 100,
    lastOnline: '刚刚',
    boundAt: '刚刚',
    todayRecords: 0
  }
  const staff = state.staff.find((item) => item.id === state.currentUser.id)
  if (staff) {
    staff.deviceCode = state.device.code
    staff.deviceType = state.device.type
    staff.deviceStatus = state.device.status
    staff.statusTone = state.device.statusTone
    staff.battery = state.device.battery
    staff.todayRecords = state.device.todayRecords
    staff.lastOnline = state.device.lastOnline
  }
  setState(state)
  return mockResult(state.device, 320)
}

function unbindDevice() {
  if (!config.useMock) return request({ url: '/employee/device/unbind', method: 'POST' })
  const state = getState()
  const staff = state.staff.find((item) => item.id === state.currentUser.id)
  if (staff) {
    staff.deviceCode = ''
    staff.deviceType = ''
    staff.deviceStatus = '未绑定'
    staff.statusTone = 'gray'
    staff.battery = 0
    staff.todayRecords = 0
    staff.lastOnline = '暂无'
  }
  state.device = null
  setState(state)
  return mockResult({ success: true }, 320)
}

function getLearningTasks() {
  if (!config.useMock) {
    return request({ url: '/employee/learning-tasks' }).then((res) => {
      const items = res.items || res || []
      return items.map((t) => ({
        id: t.id,
        title: t.courseTitle || '培训课程',
        category: t.category || '合规规范',
        summary: t.summary || '',
        dueDate: t.dueDate || '2026-09-01',
        progress: Number(t.progressPercent || 0),
        state: t.status === 'COMPLETED' ? '已完成' : (Number(t.progressPercent || 0) > 0 ? '学习中' : '待学习'),
        stateTone: t.status === 'COMPLETED' ? 'green' : 'blue',
        lastExamScore: t.lastExamScore,
        lastExamPassed: t.lastExamPassed,
      }))
    })
  }
  return mockResult(getState().learningTasks)
}

function getLearningTaskDetail(id) {
  if (!config.useMock) return request({ url: `/employee/learning-tasks/${id}` })
  const state = getState()
  const target = state.learningTasks.find((item) => item.id === id) || state.learningTasks[0]
  return mockResult({
    task: { id: target.id, status: target.state === '已完成' ? 'COMPLETED' : 'IN_PROGRESS', dueDate: target.dueDate },
    course: { id: 'c1', title: target.title, category: target.category, summary: target.summary },
    units: [{ id: 'u1', title: '第一章：合规问诊与适应症核对', content: '严格遵循处方药销售规范...', durationSeconds: 300, sortOrder: 1 }],
    progress: { progressPercent: target.progress, completedUnits: [] }
  })
}

function updateLearningUnitProgress(taskId, unitId) {
  if (!config.useMock) {
    return request({ url: `/employee/learning-tasks/${taskId}/progress`, method: 'POST', data: { completedUnitId: unitId } })
  }
  const state = getState()
  const target = state.learningTasks.find((item) => item.id === taskId)
  if (target) {
    target.progress = 100
    target.state = '已完成'
    target.stateTone = 'green'
    setState(state)
  }
  return mockResult({ ok: true, progressPercent: 100, status: 'COMPLETED' })
}

function getExamPaper(taskId) {
  if (!config.useMock) return request({ url: `/employee/learning-tasks/${taskId}/exam` })
  return mockResult({
    examId: 'exam_demo',
    title: '结业考核试卷',
    passScore: 80,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    usedAttempts: 0,
    remainingAttempts: 3,
    questions: [
      { id: 'q1', stem: '以下哪种降压药联用属于高风险禁忌？', questionType: 'SINGLE', options: [{ label: 'A', text: 'ACEI + ARB 联合使用' }, { label: 'B', text: 'CCB + ACEI 联合使用' }], score: 100 }
    ]
  })
}

function submitExam(taskId, answers, attemptId) {
  if (!config.useMock) {
    return request({ url: `/employee/learning-tasks/${taskId}/exam/submit`, method: 'POST', data: { answers, attemptId } })
  }
  return mockResult({ ok: true, score: 100, passScore: 80, passed: true, remainingAttempts: 2 })
}

function getExamAttempts(taskId) {
  if (!config.useMock) return request({ url: `/employee/learning-tasks/${taskId}/exam/attempts` })
  return mockResult({ items: [] })
}

function getProfile() {
  if (!config.useMock) return request({ url: '/employee/profile' })
  const state = getState()
  const storeStaff = state.staff.filter((item) => item.storeId === state.currentUser.storeId)
  const manager = state.managerBindings.find((item) => item.storeId === state.currentUser.storeId) || null
  const visibleAppeals = state.appeals.filter((appeal) => {
    const feedback = state.feedbacks.find((item) => item.id === appeal.feedbackId)
    if (!feedback || feedback.storeName !== state.currentUser.storeName) return false
    return isManager(state.currentUser) || feedback.employeeId === state.currentUser.id
  })
  return mockResult({
    user: state.currentUser,
    isManager: isManager(state.currentUser),
    manager,
    device: state.device,
    appeals: visibleAppeals,
    storeSummary: {
      staffCount: storeStaff.length,
      onlineCount: storeStaff.filter((item) => item.deviceStatus === '在线').length,
      pendingCount: storeStaff.reduce((sum, item) => sum + item.pending, 0)
    }
  })
}

function onlyChinese(value) {
  return String(value || '').replace(/[^\u3400-\u9fff]/g, '')
}

function symptomSubject(value) {
  const symptoms = String(value || '')
    .split(/[，,。；;、\s]+/)
    .map((item) => onlyChinese(item))
    .filter((item) => item && !/^(无|没有|未见|否认)/.test(item))
  return symptoms.slice(0, 2).join('') || onlyChinese(value)
}

function buildWiseDiagQueries(payload) {
  const subject = payload.mode === '按药品' ? onlyChinese(payload.query) : symptomSubject(payload.query)
  const normalized = subject || '常见不适症状'
  if (payload.mode === '按药品') {
    return [
      `${normalized}的适应症是什么`,
      `${normalized}的禁忌是什么`,
      `${normalized}的用法用量是什么`
    ]
  }

  const catalog = getState().recommendation.products
  const candidates = catalog.filter((product) => {
    const keywords = PRODUCT_KEYWORDS[product.name] || []
    return keywords.some((keyword) => normalized.includes(keyword))
  })
  const query = candidates.length
    ? `${normalized}适合使用什么药物`
    : `${normalized}的常用药物有哪些`
  return [query]
}

function extractSection(content, names) {
  const source = String(content || '')
  for (const name of names) {
    const marker = `# ${name}\n`
    const start = source.indexOf(marker)
    if (start < 0) continue
    const valueStart = start + marker.length
    const next = source.indexOf('\n# ', valueStart)
    const value = source.slice(valueStart, next < 0 ? source.length : next).trim()
    if (value) return value.replace(/\n+/g, ' ').slice(0, 180)
  }
  return ''
}

function uniqueWiseDiagSources(results) {
  const seen = {}
  return (results || [])
    .filter((item) => item && item.title && item.content)
    .sort((left, right) => (left.tag === '药典/说明书' ? -1 : 1) - (right.tag === '药典/说明书' ? -1 : 1))
    .filter((item) => {
      const key = item.title.replace(/-\d+/g, '').trim()
      if (seen[key]) return false
      seen[key] = true
      return true
    })
    .slice(0, 8)
}

function formatWiseDiagResult(payload, recall) {
  const base = clone(getState().recommendation)
  const evidence = uniqueWiseDiagSources(recall.results)
  const products = base.products.map((product) => {
    const source = evidence.find((item) => `${item.title}\n${item.content}`.includes(product.name))
    if (!source) return null
    return {
      ...product,
      indication: extractSection(source.content, ['用途/适应症/功能主治', '功能主治', '适应症']) || source.abstract || '',
      contraindication: extractSection(source.content, ['禁忌']) || '未检索到明确禁忌信息，需由执业药师复核',
      dosage: extractSection(source.content, ['用法用量']) || extractSection(source.content, ['其他补充信息']),
      evidenceTitle: source.title,
      evidenceTag: source.tag || '医学资料',
      evidenceUrl: source.url
    }
  }).filter(Boolean)
  const reviewRequired = payload.ageGroup !== '成人'
    || (payload.conditions || []).length > 0
    || Boolean(payload.currentMedication)
    || products.length === 0
  const sourceCount = Number(recall.count || (recall.results || []).length)

  return {
    ...base,
    summary: products.length ? `${payload.query}候选组合` : `${payload.query}医学依据`,
    safety: reviewRequired ? '需药师复核' : '未发现明确冲突',
    safetyTone: reviewRequired ? 'amber' : 'green',
    reviewRequired,
    products,
    totalPrice: Number(products.reduce((sum, item) => sum + item.price, 0).toFixed(2)),
    grossMargin: products.length
      ? Number((products.reduce((sum, item) => sum + (item.grossMargin || 45), 0) / products.length).toFixed(1))
      : 0,
    rationale: products.length
      ? `WiseDiag 返回 ${sourceCount} 条医学资料，已与当前门店 ERP 商品目录匹配出 ${products.length} 个有货商品。最终组合仍需结合顾客完整情况确认。`
      : `WiseDiag 返回 ${sourceCount} 条医学资料，但当前门店 ERP 商品目录中没有匹配到有货商品。`,
    talk: reviewRequired
      ? '我先根据您的情况查到了相关用药资料，不过还有年龄、基础疾病或正在用药等信息需要核对。我请药师确认后，再帮您确定具体品种。'
      : `根据您说的${payload.query}，目前门店有这组候选商品。使用前我再确认一下您的过敏史和正在使用的药，避免成分重复或相互影响。`,
    checks: [
      '确认症状持续时间和严重程度',
      '确认年龄过敏史和当前用药',
      '核对检索资料中的禁忌和注意事项',
      '症状持续或加重时建议及时就医'
    ].concat(reviewRequired ? ['执业药师完成禁忌和相互作用复核'] : []),
    provider: 'WiseDiag 医学知识检索',
    queryCount: (recall.queries || []).length,
    sourceCount,
    sources: evidence.map((item) => ({
      title: item.title,
      tag: item.tag || '医学资料',
      abstract: item.abstract || extractSection(item.content, ['用途/适应症/功能主治', '功能主治']) || '查看原始资料了解详情',
      url: item.url
    })),
    retrievedAt: new Date().toISOString()
  }
}

function directWiseDiagRecommendation(payload) {
  const queryList = buildWiseDiagQueries(payload)
  const cache = wx.getStorageSync(WISEDIAG_CACHE_KEY) || {}
  const cacheKey = queryList.join('|')
  const cached = cache[cacheKey]
  if (cached && Date.now() - cached.createdAt < 600000) return Promise.resolve(cached.data)

  function recall(attempt) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: config.wiseDiagServiceUrl,
        method: 'POST',
        timeout: config.wiseDiagTimeout,
        header: {
          Authorization: `Bearer ${config.wiseDiagApiKey}`,
          'Content-Type': 'application/json'
        },
        data: { query_list: queryList },
        success(response) {
          if (response.statusCode === 401) {
            reject(new Error('WiseDiag Key 无效或已过期'))
            return
          }
          if (response.statusCode < 200 || response.statusCode >= 300 || !response.data || response.data.success !== true) {
            reject(new Error(`医学知识检索失败：HTTP ${response.statusCode}`))
            return
          }
          resolve(response.data)
        },
        fail(error) {
          const timedOut = error && error.errMsg && error.errMsg.includes('timeout')
          reject(new Error(timedOut ? '医学知识检索超时，请稍后重试' : 'WiseDiag 服务暂时不可用'))
        }
      })
    }).catch((error) => {
      if (attempt < (config.wiseDiagRetryCount || 0)) return recall(attempt + 1)
      throw error
    })
  }

  return recall(0).then((recallResult) => {
    const result = formatWiseDiagResult(payload, recallResult)
    cache[cacheKey] = { data: result, createdAt: Date.now() }
    wx.setStorageSync(WISEDIAG_CACHE_KEY, cache)
    return result
  })
}

function generateRecommendation(payload) {
  if (config.useWiseDiag) {
    if (config.wiseDiagTransport === 'direct') return directWiseDiagRecommendation(payload)
    return new Promise((resolve, reject) => {
      if (!wx.cloud) {
        reject(new Error('当前基础库不支持云函数'))
        return
      }
      wx.cloud.callFunction({
        name: config.wiseDiagCloudFunction,
        data: { payload },
        success(response) {
          const result = response.result || {}
          if (result.success && result.data) resolve(result.data)
          else reject(new Error(result.message || '医学知识检索失败'))
        },
        fail(error) {
          const message = error && error.errMsg && error.errMsg.includes('FUNCTION_NOT_FOUND')
            ? '荐药云函数尚未部署'
            : '荐药服务暂时不可用'
          reject(new Error(message))
        }
      })
    })
  }
  if (!config.useMock) return request({ url: '/recommendations', method: 'POST', data: payload })
  const result = clone(getState().recommendation)
  const hasRiskContext = payload.ageGroup !== '成人' || payload.conditions.length > 0 || Boolean(payload.currentMedication)
  if (hasRiskContext) {
    result.safety = '需药师复核'
    result.safetyTone = 'amber'
    result.reviewRequired = true
    result.rationale = `${result.rationale} 顾客存在特殊年龄、基础疾病或正在用药信息，采用前需由执业药师进一步核验。`
    result.talk = '我先根据您的症状和门店库存整理了一个候选组合。因为您还有其他健康或用药情况，我请药师再帮您核对一下，确认没有冲突后再决定。'
    result.checks = result.checks.concat(['执业药师完成相互作用和禁忌复核'])
  } else {
    result.reviewRequired = false
  }
  result.query = payload
  return mockResult(result, 620)
}

module.exports = {
  getCurrentUser,
  hasCompletedProfile,
  getStoreOptions,
  hasSession,
  loginWithPhone,
  completeProfile,
  resetProfileLink,
  getDashboard,
  getFeedbacks,
  getFeedbackDetail,
  markFeedbackLearned,
  submitAppeal,
  getDevice,
  getStoreDeviceOverview,
  bindDevice,
  unbindDevice,
  getLearningTasks,
  getLearningTaskDetail,
  updateLearningUnitProgress,
  getExamPaper,
  submitExam,
  getExamAttempts,
  getProfile,
  generateRecommendation
}
