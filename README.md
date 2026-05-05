# 游戏资讯 · Game Research Archive

游戏设计研究文章聚合阅读器。从 Obsidian Vault 扫描 Markdown 文件，提供时间线浏览、全文搜索、文章详情阅读和统计面板。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start
```

浏览器访问 `http://localhost:3000`

## 数据源

启动时自动扫描 Obsidian Vault 中的 Markdown 文件，索引为文章。Vault 路径在 `lib/scanner.js` 中配置：

```js
const VAULT_ROOT = 'C:/Users/jiehuiyang/Documents/Obsidian Vault/游戏设计';
```

修改此路径即可指向你自己的 Vault。

## API

| 端点 | 说明 |
|------|------|
| `GET /api/articles` | 文章列表，支持 `?pipeline=&stage=&sort=date&order=desc&limit=&offset=` |
| `GET /api/articles/:id` | 文章详情，返回渲染后的 HTML |
| `GET /api/search?q=` | 全文搜索 |
| `GET /api/stats` | 统计面板数据 |
| `POST /api/refresh` | 手动刷新索引 |

## 技术栈

- **后端**: Node.js + Express
- **解析**: gray-matter（YAML frontmatter）+ marked（Markdown → HTML）
- **搜索**: MiniSearch（中文全文搜索）
- **图表**: Mermaid（CDN 客户端渲染）
- **前端**: 原生 HTML/CSS/JS，无框架，双主题（亮色/暗色）

## 项目结构

```
web-viewer/
├── server.js          # Express 服务入口
├── lib/
│   ├── scanner.js     # Vault 文件扫描
│   ├── parser.js      # Markdown 解析（支持多种格式）
│   └── search.js      # 全文搜索引擎
└── public/
    ├── index.html     # SPA 主页面
    ├── style.css      # 样式（亮/暗双主题）
    └── app.js         # 前端逻辑
```
