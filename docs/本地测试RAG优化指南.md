# 本地测试 RAG 优化 - 完整指南

> 💡 **新手？** 建议先阅读 [RAG快速入门指南](./RAG快速入门指南.md) 了解全文检索和向量检索的区别

---

## 🎯 测试目标

验证智能混合 RAG 策略：
- ✅ 小文档（< 5000 tokens）自动使用全文注入
- ✅ 大文档（≥ 5000 tokens）自动使用向量检索
- ✅ LRU 缓存提升响应速度
- ✅ 多文档跨文件检索

---

## 📋 前置条件

### 1. 环境检查

```powershell
# 检查 Node.js 版本（推荐 v18-v20）
node -v

# 检查 MongoDB 状态
# 方法1: 检查服务
Get-Service MongoDB

# 方法2: 尝试连接
mongosh --eval "db.version()"

# 检查依赖安装
Test-Path node_modules/lru-cache  # 应返回 True
```

### 2. 环境变量配置

确认 `.env` 文件已配置：

```env
# MongoDB 连接
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat

# RAG API 地址（向量检索服务）
RAG_API_URL=http://localhost:8000

# RAG 优化配置（已添加）
RAG_USE_FULL_CONTEXT=false
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
```

---

## 🚀 启动服务

### 步骤 1: 启动 RAG API（向量检索后端）

> **重要**：大文档向量检索依赖此服务，小文档可跳过

```powershell
# 新开终端 1 - 启动 RAG API
cd D:\work\rag_api-main

# 激活虚拟环境（如果有）
.\venv\Scripts\Activate.ps1

# 或直接启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 验证服务
# 浏览器访问: http://localhost:8000/docs
```

**启动成功标志**：
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

---

### 步骤 2: 启动 LibreChat 后端

```powershell
# 新开终端 2 - 启动后端 API
cd D:\work\librechat

# 开发模式（推荐，支持热重载）
npm run backend:dev

# 生产模式
# npm run backend
```

**启动成功标志**：
```
Server listening on all interfaces at port 3080
Connected to MongoDB
```

---

### 步骤 3: 启动 LibreChat 前端

```powershell
# 新开终端 3 - 启动前端
cd D:\work\librechat\client

npm run dev
```

**启动成功标志**：
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

> **访问地址**: http://localhost:5173

---

## 🧪 测试场景

### 场景 1: 小文档全文注入（≤10 页）

**测试步骤**：
1. 上传小文档（如 5 页 PDF）
2. **发送消息**："总结这个文档的主要内容"
3. 观察后端日志：

```log
[extractFileContext] Called with 1 attachment(s), userQuery: "总结这个文档的主要内容..."
[extractFileContext] Small file detected: "document.pdf" (3200 tokens)
[extractFileContext] File classification: 1 small, 0 large
[extractFileContext] Processing 1 small file(s) with full text injection
✅ 预期行为：直接使用全文注入，不调用向量检索
```

> **重要**: 必须**点击发送按钮**，日志才会打印！单纯上传文件不会触发 extractFileContext

---

### 场景 2: 大文档向量检索（≥30 页）

**测试步骤**：
1. 上传大文档（如 50 页技术手册）
2. **等待 10-30 秒**（自动向量化需要时间）⏱️
3. **发送消息**："第15章讲了什么内容？"
4. 观察后端日志：

```log
# 📤 上传时（自动触发）
[parseText] RAG API completed successfully (200)
[vectorizeDocumentAsync] Starting vectorization for file: 67b8e...
[vectorizeDocumentAsync] Vectorization completed for 67b8e... (status: 200)

# 💬 查询时
[extractFileContext] Called with 1 attachment(s), userQuery: "第15章讲了什么内容？..."
[extractFileContext] Large file detected: "manual.pdf" (42000 tokens)
[extractFileContext] File classification: 0 small, 1 large
[extractFileContext] Using vector search for 1 large file(s)
[vectorSearch] Searching in file: 64a1b2c3... with query: 第15章讲了什么内容？
✅ [vectorSearch] Retrieved 5 chunks (2,341 tokens) from 42,000 total
✅ [vectorSearch] Token reduction: 94.4%
```

> **重要**：
> - ✅ **已实现自动向量化** - 上传时自动调用 RAG API `/documents` 接口
> - ⏱️ **需要等待** - 50 页文档向量化约需 15-30 秒
> - 📊 **查看日志** - 确认 `[vectorizeDocumentAsync] Vectorization completed` 后再查询

---

### 场景 3: 缓存加速（重复查询）

**测试步骤**：
1. 上传文档后首次提问："介绍一下产品特性"
2. **稍等 2 秒**，再次提问**相同问题**
3. 观察日志：

```bash
# 第一次查询
[vectorSearch] Calling RAG API... (耗时 800ms)
[vectorSearch] Retrieved 5 chunks

# 第二次查询（命中缓存）
[vectorSearch] Cache hit for query hash: a3d5e... (耗时 < 10ms)
✅ 预期行为：缓存命中，响应速度提升 80x+
```

---

### 场景 4: 多文档联合检索

**测试步骤**：
1. 同时上传 3 个大文档（如产品手册 + API文档 + FAQ）
2. 提问："如何集成支付功能？"（跨文档问题）
3. 观察日志：

```
[extractFileContext] Using vector search for 3 large file(s)
[vectorSearchMultiple] Searching across 3 documents...
[vectorSearchMultiple] Retrieved 15 chunks (5 per file)
[vectorSearchMultiple] Total tokens: 4,523 (from 120,000+)
✅ 预期行为：从多个文档中提取相关段落组合回答
```

---

### 场景 5: 向量检索降级（RAG API 不可用）

**测试步骤**：
1. **停止** RAG API 服务（Ctrl+C 终端 1）
2. 上传大文档并提问
3. 观察日志：

```
[vectorSearch] Error calling RAG API: connect ECONNREFUSED 127.0.0.1:8000
[extractFileContext] Vector search failed, falling back to full context
[extractFileContext] Using full context for large file (fallback mode)
⚠️ 预期行为：自动降级到全文注入，保证功能可用
```

---

## 📊 性能对比验证

使用 50 页技术文档测试：

| 指标 | 全文注入 | 向量检索 | 对比 |
|------|---------|---------|------|
| **传输 Token** | 40,000 | 3,000 | ↓ 92.5% |
| **响应时间（首次）** | 2.5s | 0.8s | ↑ 3x |
| **响应时间（缓存）** | 2.5s | 0.05s | ↑ 50x |
| **API 成本（GPT-4）** | $0.40 | $0.03 | ↓ 92.5% |

---

## 🐛 常见问题排查

### ❌ 问题 0: 上传文件后没有日志输出

**症状**：上传PDF后，后端日志没有打印 `[extractFileContext]`

**原因**：
- ✅ **这是正常现象**！
- `extractFileContext` 只在**发送消息时**被调用
- 文件上传只是将文件存储到数据库，不会提取内容

**解决方案**：
```
1. 确认文件已上传（输入框上方显示文件图标）
2. 输入问题："总结这个文档"
3. 点击发送按钮 ⬅️ 关键步骤
4. 观察后端日志（此时才会打印）
```

**预期日志**：
```log
[extractFileContext] Called with 1 attachment(s), userQuery: "总结这个文档..."
[extractFileContext] Small file detected: "xxx.pdf" (500 tokens)
[extractFileContext] Processing 1 small file(s) with full text injection
```

---

### ❌ 问题 1: 向量检索返回空结果

**症状**：大文档上传后立即查询，日志显示：
```log
[extractFileContext] Using vector search for 1 large file(s)
[vectorSearch] Retrieved 0 chunks
[extractFileContext] Vector search returned no results, falling back to full text
```

**原因**：
- 📤 **向量化还在进行中** - 文档刚上传，向量化还未完成
- ⏱️ **处理需要时间** - 50 页文档需要 15-30 秒，100 页需要 30-60 秒

**解决方案**：
```
✅ 方案 1: 等待向量化完成（推荐）
1. 上传文档后，观察后端日志
2. 等待看到：
   [vectorizeDocumentAsync] Vectorization completed for xxx (status: 200)
3. 稍等 2-3 秒（确保数据已写入数据库）
4. 再发送查询

✅ 方案 2: 使用全文注入（临时）
在 .env 中设置：
RAG_STRATEGY=full_context
重启后端，系统将直接使用全文而不尝试向量检索
```

**向量化时间参考**：
| 文档大小 | 页数 | 预计时间 |
|---------|-----|---------|
| 1 MB | ~10 页 | 5-10 秒 |
| 5 MB | ~50 页 | 15-30 秒 |
| 10 MB | ~100 页 | 30-60 秒 |

---

### ❌ 问题 2: 向量检索不生效

**症状**：大文档仍使用全文注入

**排查步骤**：
```powershell
# 1. 检查 RAG API 状态
curl http://localhost:8000/health
# 或浏览器访问: http://localhost:8000/docs

# 2. 确认环境变量
$env:RAG_STRATEGY        # 应为 hybrid
$env:RAG_API_URL         # 应为 http://localhost:8000

# 3. 检查文档是否真的够大
# 后端日志应显示 token 数量 ≥ 5000
```

**解决方案**：
```powershell
# 重启后端服务
cd D:\work\librechat
npm run backend:dev
```

---

### ❌ 问题 3: 后端启动失败

**症状**：
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**解决方案**：
```powershell
# 启动 MongoDB 服务
net start MongoDB

# 或使用 MongoDB Compass 检查连接
```

---

### ❌ 问题 4: 前端无法访问后端

**症状**：前端请求 404/500 错误

**排查**：
```powershell
# 检查后端端口
netstat -ano | Select-String ":3080"

# 确认 .env 配置
# HOST=127.0.0.1
# PORT=3080
```

---

### ❌ 问题 5: lru-cache 导入错误

**症状**：
```
Error: Cannot find module 'lru-cache'
```

**解决方案**：
```powershell
# 重新安装依赖
npm install lru-cache --legacy-peer-deps

# 重启后端
npm run backend:dev
```

---

## 📝 日志监控命令

### 实时查看关键日志

```powershell
# Windows PowerShell（在后端终端执行）
npm run backend:dev | Select-String "vector search|Cache hit|extractFileContext"

# 或在启动后查看完整日志
# 确保 .env 中设置了 DEBUG_LOGGING=true
```

### 关键日志标识

✅ **成功标志**：
```log
# 函数调用
[extractFileContext] Called with N attachment(s), userQuery: "..."

# 文件分类
[extractFileContext] Small file detected: "doc.pdf" (3200 tokens)
[extractFileContext] Large file detected: "manual.pdf" (42000 tokens)
[extractFileContext] File classification: 1 small, 1 large

# 处理策略
[extractFileContext] Processing N small file(s) with full text injection
[extractFileContext] Using vector search for N large file(s)

# 向量检索
[vectorSearch] Retrieved X chunks (Y tokens)
[vectorSearch] Cache hit for query
```

⚠️ **警告标志**：
```log
[extractFileContext] Skipping file "xxx": source=..., hasText=false
[extractFileContext] Text truncated for "large.pdf" due to token limit
[vectorSearch] Error calling RAG API
[extractFileContext] Vector search failed, falling back to full text
```

❌ **错误标志**：
```
Error: connect ECONNREFUSED
Cannot read property 'content' of undefined
```

---

## 🎮 完整测试流程

### 快速测试（5 分钟）

```powershell
# 终端 1: 启动 RAG API
cd D:\work\rag_api-main
uvicorn app.main:app --reload --port 8000

# 终端 2: 启动后端
cd D:\work\librechat
npm run backend:dev

# 终端 3: 启动前端
cd D:\work\librechat\client
npm run dev

# 浏览器访问
# http://localhost:5173

# 测试步骤
# 1. 上传 30+ 页 PDF
# 2. 提问相关问题
# 3. 观察终端 2 的日志输出
```

---

### 完整测试（15 分钟）

按顺序执行所有 5 个测试场景，记录每个场景的：
- ✅ 日志输出是否符合预期
- ✅ 响应时间对比
- ✅ Token 消耗对比
- ✅ 答案准确性

---

## 📊 测试报告模板

```markdown
## RAG 优化测试报告

**测试时间**: 2026-03-10
**测试环境**: 本地开发环境（非 Docker）

### 测试结果

| 场景 | 状态 | Token 消耗 | 响应时间 | 备注 |
|------|------|-----------|---------|------|
| 小文档全文 | ✅ | 3,200 | 1.2s | 按预期全文注入 |
| 大文档向量 | ✅ | 2,800 | 0.7s | Token 降低 93% |
| 缓存加速 | ✅ | 2,800 | 0.05s | 速度提升 14x |
| 多文档检索 | ✅ | 4,500 | 1.1s | 跨文档准确 |
| 降级策略 | ✅ | 42,000 | 2.3s | 自动降级成功 |

### 性能提升

- **Token 节省**: 92.5% ↓ （大文档场景）
- **响应速度**: 5x ↑（首次）/ 50x ↑（缓存）
- **成本降低**: $0.37 节省（单次查询）

### 问题记录

无

### 结论

✅ RAG 优化策略工作正常，达到预期效果
```

---

## 🎉 测试完成后

### 停止服务

```powershell
# 按顺序停止（每个终端按 Ctrl+C）
# 1. 停止前端 (终端 3)
# 2. 停止后端 (终端 2)
# 3. 停止 RAG API (终端 1)
```

### 生产部署

测试通过后，可使用 Docker Compose 部署：
```powershell
docker-compose up -d
```

---

**祝测试顺利！** 🚀

如有问题，请查看 [完整文档](./docs/RAG优化更新说明.md)
