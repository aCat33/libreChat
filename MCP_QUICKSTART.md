# 🚀 MCP 集成快速开始指南

## ✅ 已完成的配置

你的油田钻井数据 MCP 服务器已经成功集成到 LibreChat！

### 配置摘要

- **MCP 服务器名称**: `oilfield-data`
- **描述**: 油田钻井数据查询服务
- **Python 脚本**: `d:/work/oilMCP/oilfield_mcp_server.py`
- **数据库**: SQLite (`./oilfield.db`)
- **状态**: ✅ 配置已验证

## 📝 接下来的步骤

### 1. 准备 Python 环境（如果还没有）

```bash
cd d:\work\oilMCP
pip install -r requirements.txt
```

⚠️ **如果遇到依赖冲突错误**（如 langchain-core 版本冲突）：

**快速修复（推荐）**：
```bash
cd d:\work\oilMCP
fix_deps.bat
```

**或手动修复**：
```bash
cd d:\work\oilMCP
pip install --upgrade langchain-core
pip install -r requirements.txt
pip check
```

详细说明请查看：[`fix_dependencies.md`](../gemini-ge/fix_dependencies.md)

### 2. （可选）独立启动 MCP 服务器做排障/调试

如果你只是想在 LibreChat 里使用 MCP（**非独立测试**），一般**不需要手动执行**下面两行。
因为你已经在 `librechat.yaml` 配置了：
- `mcpServers.oilfield-data.command: python`
- `mcpServers.oilfield-data.args: [d:/work/oilMCP/oilfield_mcp_server.py]`

LibreChat 会在需要时自动拉起该 MCP 进程（或在启动/连接阶段拉起，取决于实现）。

只有当你要排查 MCP 本身是否能跑通（例如 Python 依赖/路径/数据库路径问题）时，才建议先独立启动：

```bash
cd d:\work\oilMCP
python oilfield_mcp_server.py
```

⚠️ **注意**:
- 数据库路径以 `librechat.yaml` 里的 `DATABASE_URL` 为准（你当前配置为 `sqlite:///d:/work/oilMCP/oilfield.db`）。
- `python` 必须能在命令行直接运行并指向装好依赖的那个环境（必要时把 `command` 改成 Python 的绝对路径）。

### 3. 启动 LibreChat

#### 方式一：Docker（推荐 - 最简单）

```bash
cd d:\work\libreChat
docker-compose up -d
```

#### 方式二：开发模式（需要两个终端）

**终端 1 - 启动后端**：
```bash
cd d:\work\libreChat
npm install --registry=https://registry.npmmirror.com  # 首次运行需要
npm run build:packages
# 后端会读取 client/dist/index.html；即使你用 frontend:dev，也建议先构建一次生成 dist
npm run build:client
npm run backend:dev
```

**终端 2 - 启动前端**：
```bash
cd d:\work\libreChat
npm run frontend:dev
```

#### 方式三：生产模式（单个进程）

```bash
cd d:\work\libreChat
npm install  # 首次运行需要
npm run backend
```
然后在另一个终端构建并启动前端。

### 4. 访问 LibreChat


- **开发模式**：优先访问前端开发服务器（通常是 `http://localhost:5173`，以终端输出为准）
- **生产/构建模式**：访问 `http://localhost:3080`

## 🎯 如何使用 MCP 服务器

### 1. 登录 LibreChat

使用你的账户登录（如果没有账户，需要先注册）

### 2. 创建新对话

- 点击 "New Chat" 创建新对话
- 选择一个 AI 模型（例如 DeepSeek）

### 3. 启用 MCP 服务器

在对话界面中：
1. 查找 MCP 服务器选项（通常在侧边栏或设置中）
2. 选择 **"oilfield-data"** 服务器
3. 确认启用

### 4. 开始查询

现在你可以向 AI 提问关于油田钻井数据的问题：

**示例查询**：
```
- "查询所有油井的基本信息"
- "显示最近的钻井记录"
- "有多少口油井在生产？"
- "分析钻井深度分布"
- "查找某个区域的油井"
```

AI 会自动通过 MCP 服务器查询数据库并返回结果。

## 🔍 验证安装

运行测试脚本验证配置：

```bash
cd d:\work\libreChat
node test_mcp_integration.js
```

你应该看到所有项目都打上 ✅ 标记。

## ⚠️ 常见问题

### 问题：看不到 MCP 服务器选项

**原因**：
- LibreChat 服务可能需要重启
- 配置文件可能有语法错误

**解决**：
```bash
# 重启服务
docker-compose restart api

# 或者在开发模式下重启
npm run dev
```

### 问题：MCP 服务器连接失败

**原因**：
- Python 环境未配置
- 数据库文件不存在
- 脚本路径错误

**解决**：
1. 检查 Python 是否可用：`python --version`
2. 检查脚本是否存在：`dir d:\work\oilMCP\oilfield_mcp_server.py`
3. 查看 LibreChat 日志：`docker-compose logs -f api`

### 问题：查询返回空结果

**原因**：数据库为空或查询有误

**解决**：
1. 检查数据库是否有数据：
   ```bash
   cd d:\work\gemini-ge
   sqlite3 oilfield.db
   .tables
   SELECT COUNT(*) FROM wells;  # 假设有 wells 表
   .quit
   ```
2. 如果数据库为空，需要先导入数据

## 📊 配置详情

当前的 `librechat.yaml` 配置：

```yaml
# MCP 功能启用
interface:
  mcpServers:
    use: true      # ✅ 已启用
    share: false   # 禁用分享
    create: false  # 禁用用户创建
    public: false  # 禁用公开

# MCP 服务器
mcpServers:
  oilfield-data:
    type: stdio
    command: python
    args:
      - "d:/work/oilMCP/oilfield_mcp_server.py"
    env:
      DATABASE_URL: "sqlite:///./oilfield.db"
    description: "油田钻井数据查询服务"
    timeout: 60000
```

## 🔧 高级配置

### 修改超时时间

编辑 `librechat.yaml`：
```yaml
mcpServers:
  oilfield-data:
    timeout: 120000  # 增加到 2 分钟
```

### 使用虚拟环境

如果需要使用特定的 Python 虚拟环境：
```yaml
mcpServers:
  oilfield-data:
    command: "d:/work/oilMCP/venv/Scripts/python.exe"
```

### 添加日志

在环境变量中添加：
```yaml
mcpServers:
  oilfield-data:
    env:
      DATABASE_URL: "sqlite:///./oilfield.db"
      PYTHONUNBUFFERED: "1"  # 启用实时日志输出
```

## 📚 更多文档

- **详细集成指南**: `MCP_INTEGRATION_GUIDE.md`
- **LibreChat MCP 文档**: https://www.librechat.ai/docs/configuration/mcp
- **MCP 协议**: https://modelcontextprotocol.io/

## ✨ 下一步优化建议

1. **添加更多 MCP 工具**: 可以配置多个 MCP 服务器
2. **权限管理**: 根据需要调整 `share` 和 `create` 权限
3. **监控日志**: 启用详细日志以便调试
4. **性能优化**: 如果查询慢，考虑增加超时或优化数据库

---

**集成完成时间**: 2026-01-26  
**配置状态**: ✅ 验证通过  
**准备就绪**: 可以开始使用！

需要帮助？查看 `MCP_INTEGRATION_GUIDE.md` 获取故障排查指南。
