// PM2 测试环境配置: API / worker / scheduler (端口 9100)
module.exports = {
  apps: [
    {
      name: "yuqi-api-test",
      cwd: "../..",
      script: "backend/.venv/Scripts/python",
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "9100"],
      env: { ENVIRONMENT: "test", ALLOW_DEMO_SEED: "true" },
      max_restarts: 5,
      time: true,
      log_file: "/var/log/yuqi/test/api.log",
      out_file: "/var/log/yuqi/test/api.out.log",
      error_file: "/var/log/yuqi/test/api.err.log",
    },
    {
      name: "yuqi-worker-test",
      cwd: "../../backend",
      script: "app/workers/worker.py",
      env: { ENVIRONMENT: "test" },
      time: true,
      log_file: "/var/log/yuqi/test/worker.log",
    },
    {
      name: "yuqi-scheduler-test",
      cwd: "../../backend",
      script: "app/workers/scheduler.py",
      env: { ENVIRONMENT: "test" },
      time: true,
      log_file: "/var/log/yuqi/test/scheduler.log",
    },
  ],
}
