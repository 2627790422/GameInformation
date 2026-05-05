# TODO

## 运维

- [ ] **文件变更自动刷新** — 监听 reference 目录变更，自动 `git pull` + `refresh`。方案二选一：
  1. 用 `chokidar` 监听 reference 目录，检测到变更时自动 refresh
  2. 在 server.js 中用 `setInterval` 定时（如 5 分钟）执行 `git pull` + refresh
