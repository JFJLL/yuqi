module.exports = {
  currentUser: {
    id: '',
    name: '',
    role: '待确认',
    mobile: '138****5621',
    storeId: '',
    storeName: '',
    regionName: '',
    profileCompleted: false
  },
  stores: [
    { id: 'STORE-001', name: '解放路旗舰店', regionName: '华北一区', address: '解放路 118 号' },
    { id: 'STORE-002', name: '长安街中心店', regionName: '华北一区', address: '长安街 66 号' },
    { id: 'STORE-003', name: '经开万达店', regionName: '华北二区', address: '荣华中路 12 号' },
    { id: 'STORE-004', name: '朝阳社区店', regionName: '华北二区', address: '朝阳路 203 号' }
  ],
  managerBindings: [
    { id: 'MGR-0006', name: '王敏', mobile: '138****2836', storeId: 'STORE-001' },
    { id: 'MGR-0012', name: '赵磊', mobile: '139****9012', storeId: 'STORE-002' }
  ],
  staff: [
    { id: 'EMP-00018', name: '李娜', role: '营业员', storeId: 'STORE-001', mobile: '138****5621', deviceCode: 'WF2503Y009b97e8', deviceType: 'WiFi智能工牌', deviceStatus: '在线', statusTone: 'green', battery: 86, todayRecords: 42, highRisk: 1, pending: 2, lastOnline: '刚刚' },
    { id: 'EMP-00021', name: '陈琳', role: '营业员', storeId: 'STORE-001', mobile: '136****1740', deviceCode: 'WF2503Y009c12a4', deviceType: 'WiFi智能工牌', deviceStatus: '在线', statusTone: 'green', battery: 72, todayRecords: 38, highRisk: 1, pending: 1, lastOnline: '2 分钟前' },
    { id: 'EMP-00027', name: '周凯', role: '营业员', storeId: 'STORE-001', mobile: '137****4918', deviceCode: '4G2503Y0018d71', deviceType: '4G智能工牌', deviceStatus: '离线', statusTone: 'red', battery: 18, todayRecords: 21, highRisk: 1, pending: 1, lastOnline: '43 分钟前' },
    { id: 'EMP-00031', name: '孙悦', role: '执业药师', storeId: 'STORE-001', mobile: '135****6682', deviceCode: 'WF2503Y009d88c', deviceType: 'WiFi智能工牌', deviceStatus: '在线', statusTone: 'green', battery: 91, todayRecords: 47, highRisk: 0, pending: 0, lastOnline: '刚刚' },
    { id: 'EMP-00036', name: '吴凡', role: '营业员', storeId: 'STORE-001', mobile: '132****0376', deviceCode: 'WF2503Y009f101', deviceType: 'WiFi智能工牌', deviceStatus: '离线', statusTone: 'red', battery: 0, todayRecords: 0, highRisk: 0, pending: 1, lastOnline: '昨日 21:17' },
    { id: 'EMP-00042', name: '马静', role: '收银员', storeId: 'STORE-001', mobile: '150****1268', deviceCode: '', deviceType: '', deviceStatus: '未绑定', statusTone: 'gray', battery: 0, todayRecords: 0, highRisk: 0, pending: 0, lastOnline: '暂无' }
  ],
  device: {
    code: 'WF2503Y009b97e8',
    type: 'WiFi智能工牌',
    status: '在线',
    statusTone: 'green',
    battery: 86,
    lastOnline: '刚刚',
    boundAt: '2026-08-22 09:18',
    todayRecords: 42
  },
  feedbacks: [
    {
      id: 'ISSUE-20260824-001',
      title: '夸大疗效表达',
      risk: '高风险',
      riskTone: 'red',
      state: '待整改',
      stateTone: 'amber',
      time: '09:42',
      date: '2026-08-24',
      employeeId: 'EMP-00018',
      employeeName: '李娜',
      storeName: '解放路旗舰店',
      quote: '这个药吃了肯定马上就好，您不用再去医院看了。',
      reason: '表达中包含保证疗效和替代就医判断，命中高风险销售话术规则。',
      advice: '说明药品适用范围和规范用法，避免承诺疗效；症状持续或加重时提醒顾客及时就医。',
      learned: false,
      canAppeal: true,
      recordingAvailable: true
    },
    {
      id: 'ISSUE-20260824-002',
      title: '问诊信息不足',
      risk: '中风险',
      riskTone: 'amber',
      state: '待整改',
      stateTone: 'amber',
      time: '14:22',
      date: '2026-08-24',
      employeeId: 'EMP-00021',
      employeeName: '陈琳',
      storeName: '解放路旗舰店',
      quote: '嗓子疼就买这个，大家都用。',
      reason: '推荐前未确认症状时长、年龄、过敏史、是否发热等必要信息。',
      advice: '先完成基础问询，再推荐适配药品，并清楚说明用法、用量和禁忌。',
      learned: false,
      canAppeal: true,
      recordingAvailable: true
    },
    {
      id: 'ISSUE-20260823-009',
      title: '服务态度提醒',
      risk: '低风险',
      riskTone: 'green',
      state: '已完成',
      stateTone: 'green',
      time: '15:40',
      date: '2026-08-23',
      employeeId: 'EMP-00031',
      employeeName: '孙悦',
      storeName: '解放路旗舰店',
      quote: '你自己看说明书就行。',
      reason: '服务表达偏简略，未主动解释重点用药信息。',
      advice: '主动帮助顾客确认重点用法，并提醒按说明书或药师建议使用。',
      learned: true,
      canAppeal: false,
      recordingAvailable: false
    },
    {
      id: 'ISSUE-20260823-006',
      title: '处方药提醒缺失',
      risk: '高风险',
      riskTone: 'red',
      state: '申诉中',
      stateTone: 'blue',
      time: '16:08',
      date: '2026-08-23',
      employeeId: 'EMP-00027',
      employeeName: '周凯',
      storeName: '解放路旗舰店',
      quote: '这个药您直接拿两盒就行。',
      reason: '转写文本中未识别到处方核验及药师审核提醒。',
      advice: '处方药销售前核验处方，并由执业药师完成审核和用药交代。',
      learned: false,
      canAppeal: false,
      recordingAvailable: true
    }
  ],
  appeals: [
    {
      id: 'APPEAL-20260823-003',
      feedbackId: 'ISSUE-20260823-006',
      title: '处方药提醒缺失',
      reason: '顾客已展示电子处方，转写未覆盖前半段沟通。',
      state: '店长复核',
      stateTone: 'amber',
      createdAt: '2026-08-23 17:26'
    }
  ],
  learningTasks: [
    {
      id: 'TASK-001',
      title: '高风险话术替换',
      source: '夸大疗效表达',
      progress: 60,
      state: '学习中',
      stateTone: 'blue',
      deadline: '今天 20:00'
    },
    {
      id: 'TASK-002',
      title: '处方药销售合规',
      source: '处方药销售规范',
      progress: 0,
      state: '待考试',
      stateTone: 'amber',
      deadline: '明天 18:00'
    }
  ],
  recommendation: {
    summary: '干咳咽痒优选组合',
    safety: '低风险',
    safetyTone: 'green',
    products: [
      { name: '苏黄止咳胶囊', brand: '扬子江', stock: 18, price: 56.8, role: '缓解咳嗽症状' },
      { name: '西瓜霜润喉片', brand: '桂林三金', stock: 32, price: 18.8, role: '缓解咽部不适' },
      { name: '维生素C咀嚼片', brand: '养生堂', stock: 25, price: 23, role: '营养补充' }
    ],
    totalPrice: 98.6,
    grossMargin: 45.4,
    rationale: '组合覆盖咳嗽与咽部刺激两个主要诉求，当前门店均有库存，未发现已知成分重复。',
    talk: '您现在主要是干咳和嗓子痒，这个组合里一个侧重缓解咳嗽，一个照顾咽部不适。用之前我还需要确认一下，您有没有高血压、怀孕哺乳、肝肾问题或药物过敏？',
    checks: ['确认年龄与症状持续时间', '确认过敏史和当前用药', '排除孕哺期及肝肾功能异常', '症状持续或加重时建议就医']
  }
}
