// PM2 生产环境配置: API / worker / scheduler (端口 9000)
module.exports = {
  apps: [
    {
      name: "yuqi-api",
      cwd: "../..",
      script: "backend/.venv/Scripts/python",
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "9000", "--workers", "2"],
      env: { ENVIRONMENT: "production", ALLOW_DEMO_SEED: "false" },
      max_restarts: 5,
      time: true,
      log_file: "/var/log/yuqi/prod/api.log",
      out_file: "/var/log/yuqi/prod/api.out.log",
      error_file: "/var/log/yuqi/prod/api.err.log",
    },
    {
      name: "yuqi-worker",
      cwd: "../../backend",
      script: "app/workers/worker.py",
      env: { ENVIRONMENT: "production" },
      time: true,
      log_file: "/var/log/yuqi/prod/worker.log",
    },
    {
      name: "yuqi-scheduler",
      cwd: "../../backend",
      script: "app/workers/scheduler.py",
      env: { ENVIRONMENT: "production" },
      time: true,
      log_file: "/var/log/yuqi/prod/scheduler.log",
    },
  ],
}
