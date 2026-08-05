# api-test-frontend

Vue 3 + Vite 管理后台前端，与后端仓库 `api-test` 分离维护、单独打包。

## 技术栈

- Vue 3
- Vue Router
- Vite

## 本地开发

1. 先启动后端（`api-test` 仓库的 `apitest-system`，默认 `http://localhost:8080`）
2. 安装依赖并启动前端：

```bash
npm install
npm run dev
```

浏览器打开：http://localhost:5173

开发环境已通过 Vite 把 `/api` 代理到 `http://localhost:8080`。

## 打包

```bash
npm run build
```

产物在 `dist/`，可部署到 Nginx 等静态服务器。生产环境请把接口地址配成真实后端（或由网关反代 `/api`）。

## 演示账号

- 用户名：`admin`
- 密码：`123456`
