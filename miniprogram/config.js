const ENV = 'test' // 'development' | 'test' | 'production'

const ENV_CONFIGS = {
  development: {
    useMock: true,
    isTestEnv: true,
    apiBaseUrl: 'http://127.0.0.1:8090/api/yuqi',
    requestTimeout: 15000,
  },
  test: {
    useMock: false,
    isTestEnv: true,
    apiBaseUrl: 'http://127.0.0.1:8090/api/yuqi',
    requestTimeout: 15000,
  },
  production: {
    useMock: false,
    isTestEnv: false,
    apiBaseUrl: 'https://api.yuqi.local/api/yuqi',
    requestTimeout: 15000,
  },
}

module.exports = {
  env: ENV,
  ...ENV_CONFIGS[ENV],
}
