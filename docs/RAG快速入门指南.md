# RAG 快速入门指南

> 📖 本指南帮助您快速了解并配置 LibreChat 的 RAG（检索增强生成）功能

---

## 📚 什么是 RAG？

RAG (Retrieval-Augmented Generation) 允许 AI 在回答问题时引用您上传的文档内容，实现：
- ✅ 基于文档的精准问答
- ✅ 引用具体的文档内容
- ✅ 支持多种文件格式（PDF、DOCX、TXT 等）

---

## 🎯 核心概念：全文检索 vs 向量检索

LibreChat 提供两种文档检索方式，各有优劣：

### 📄 全文检索 (Full Context)

**工作原理**：
- 将整个文档的完整内容传递给 AI
- AI 可以看到文档的所有信息

**优点**：
- ✅ 不会遗漏任何信息
- ✅ AI 可以理解完整上下文
- ✅ 不需要额外配置

**缺点**：
- ❌ 大文档会消耗大量 token（成本高）
- ❌ 可能超出模型 token 限制
- ❌ 响应速度较慢

**适用场景**：
- 📝 小文档（< 5 页 PDF）
- 📝 需要完整理解文档上下文
- 📝 不关心 token 成本

---

### 🔍 向量检索 (Vector Search)

**工作原理**：
- 文档上传时被切分并转换为向量存储
- 查询时只检索最相关的几个片段（通常 5-10 个）
- 只将相关片段传递给 AI

**优点**：
- ✅ 显著降低 token 消耗（节省 60-80%）
- ✅ 支持超大文档（100+ 页）
- ✅ 响应速度快
- ✅ 支持跨多个文档检索

**缺点**：
- ❌ 可能遗漏部分信息
- ❌ 需要配置 RAG API 服务
- ❌ 需要等待文档向量化完成

**适用场景**：
- 📚 大文档（> 10 页 PDF）
- 📚 技术文档、手册、论文
- 📚 需要跨多个文档查询
- 📚 关注性能和成本

---

## ⚙️ 如何切换检索方式？

### 方法一：配置 RAG 策略（推荐）

在 `.env` 文件中配置 `RAG_STRATEGY` 参数：

```env
# === 全文检索模式（所有文档都使用全文） ===
RAG_STRATEGY=full_context

# === 向量检索模式（所有文档都使用向量检索） ===
RAG_STRATEGY=vector_search

# === 智能混合模式（推荐）===
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
```

#### 🌟 推荐配置：智能混合模式

```env
# 混合策略：自动根据文档大小选择最佳方式
RAG_STRATEGY=hybrid

# 阈值：文档超过 5000 tokens 时使用向量检索
RAG_VECTOR_THRESHOLD=5000

# 检索片段数：返回最相关的 5 个片段
RAG_TOP_K=5
```

**工作原理**：
- 📄 **小文档** (< 5000 tokens) → 自动使用全文检索
- 📚 **大文档** (≥ 5000 tokens) → 自动使用向量检索

**优势**：
- ✅ 自动优化，无需手动选择
- ✅ 小文档享受全文检索的完整性
- ✅ 大文档享受向量检索的高效性
- ✅ 平衡性能、成本和准确性

---

### 方法二：调整阈值优化策略

如果使用混合模式，可以通过调整阈值来控制何时切换：

```env
# 保守策略（更多文档使用全文检索）
RAG_VECTOR_THRESHOLD=10000  # 文档超过 10000 tokens 才用向量检索

# 激进策略（更多文档使用向量检索）
RAG_VECTOR_THRESHOLD=3000   # 文档超过 3000 tokens 就用向量检索

# 推荐策略（平衡）
RAG_VECTOR_THRESHOLD=5000   # 约 3-5 页 PDF
```

**参考换算**：
- 1 页 PDF ≈ 500-800 tokens
- 5000 tokens ≈ 3-5 页 PDF
- 10000 tokens ≈ 7-10 页 PDF

---

### 方法三：禁用/启用 RAG API

向量检索依赖 RAG API 服务，通过配置可以控制：

```env
# 启用向量检索（需要 RAG API）
RAG_API_URL=http://rag_api:8000

# 禁用向量检索（只使用全文检索）
# RAG_API_URL=    # 注释掉或留空
```

**注意**：如果 `RAG_API_URL` 未配置，系统会自动回退到全文检索模式。

---

## 🔧 完整配置示例

### 场景 1：只处理小文档（全文检索）

```env
# .env 配置
RAG_STRATEGY=full_context

# 不需要 RAG API，可以注释掉
# RAG_API_URL=http://rag_api:8000
```

**适合**：个人笔记、小型文档、快速测试

---

### 场景 2：只处理大文档（向量检索）

```env
# .env 配置
RAG_STRATEGY=vector_search
RAG_API_URL=http://rag_api:8000
RAG_TOP_K=5

# Docker 方式启动 RAG API
# docker-compose -f rag.yml up -d
```

**适合**：技术文档库、大型手册、研究论文

---

### 场景 3：混合使用（推荐）

```env
# .env 配置
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
RAG_API_URL=http://rag_api:8000

# 可选：启用缓存提升性能
RAG_ENABLE_CACHE=true
RAG_CACHE_TTL=600000  # 10 分钟
```

**适合**：大部分场景，自动优化

---

## 📊 性能对比

### 处理 50 页技术文档

| 检索方式 | Token 消耗 | 响应时间 | 单次成本 | 准确性 |
|---------|-----------|---------|---------|--------|
| **全文检索** | 40,000 | 2.5s | $0.40 | ⭐⭐⭐⭐⭐ |
| **向量检索** | 3,000 | 0.5s | $0.03 | ⭐⭐⭐⭐ |
| **混合模式** | 自动优化 | 0.5-2.5s | $0.03-0.40 | ⭐⭐⭐⭐⭐ |

---

## 🚀 快速开始

### 步骤 1：配置环境变量

编辑 `.env` 文件：

```env
# 基础配置
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat

# RAG 配置（推荐混合模式）
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
RAG_API_URL=http://localhost:8000
```

### 步骤 2：启动 RAG API（如果使用向量检索）

**Docker 方式**：
```bash
docker-compose -f rag.yml up -d
```

**本地方式**：
```bash
cd rag_api
uvicorn app.main:app --reload --port 8000
```

### 步骤 3：启动 LibreChat

```bash
npm run backend:dev
```

### 步骤 4：测试

1. 上传一个小文档（< 5 页）
   - ✅ 应自动使用全文检索
   - ✅ 立即可以查询

2. 上传一个大文档（> 10 页）
   - ✅ 应自动使用向量检索
   - ⏳ 等待 20-30 秒向量化完成
   - ✅ 然后可以查询

---

## 🔍 如何判断当前使用哪种检索？

### 方法 1：查看后端日志

```bash
# 全文检索的日志
[extractContext] 🔹 Using FULL CONTEXT for file: document.pdf

# 向量检索的日志
[extractContext] 🔍 Using VECTOR SEARCH for file: document.pdf
[vectorSearch] Query embedding match: 0.85
```

### 方法 2：观察响应时间

- **向量检索**：通常 < 1 秒（快）
- **全文检索**：通常 2-5 秒（较慢）

### 方法 3：检查文档状态

上传大文档后，如果看到：
- 🔄 **蓝色边框** → 正在向量化，等待完成
- ✅ **绿色边框** → 向量化完成，可以查询

说明使用的是向量检索模式。

---

## ⚠️ 常见问题

### 1. 大文档回答不准确？

**可能原因**：向量检索只返回 5 个片段，可能不够

**解决方案**：增加检索片段数
```env
RAG_TOP_K=10  # 增加到 10 个片段
```

### 2. 向量检索没有结果？

**可能原因**：文档尚未完成向量化

**解决方案**：
1. 查看日志确认向量化是否完成
2. 等待 20-30 秒后再查询
3. 检查 RAG API 是否正常运行

### 3. 想临时切换到全文检索测试？

**解决方案**：
```env
# 临时切换
RAG_STRATEGY=full_context

# 重启服务
npm run backend:dev
```

### 4. 如何完全禁用 RAG？

**解决方案**：
```env
# 注释掉 RAG API URL
# RAG_API_URL=http://localhost:8000
```

---

## 📖 进阶阅读

- **配置详解**: [配置RAG指南.md](./配置RAG指南.md)
- **策略优化**: [RAG策略优化配置指南.md](./RAG策略优化配置指南.md)
- **原理分析**: [LibreChat_RAG原理与向量化策略分析.md](./LibreChat_RAG原理与向量化策略分析.md)
- **问题排查**: [RAG问题排查指南.md](./RAG问题排查指南.md)
- **本地测试**: [本地测试RAG优化指南.md](./本地测试RAG优化指南.md)

---

## 💡 最佳实践建议

1. **新手推荐**：
   ```env
   RAG_STRATEGY=hybrid
   RAG_VECTOR_THRESHOLD=5000
   ```
   让系统自动优化，无需关心细节

2. **成本敏感用户**：
   ```env
   RAG_STRATEGY=vector_search
   RAG_VECTOR_THRESHOLD=3000
   ```
   尽可能使用向量检索，降低 token 消耗

3. **追求准确性**：
   ```env
   RAG_STRATEGY=hybrid
   RAG_VECTOR_THRESHOLD=8000
   RAG_TOP_K=10
   ```
   提高阈值和检索片段数，平衡准确性和成本

4. **测试环境**：
   ```env
   RAG_STRATEGY=full_context
   ```
   使用全文检索，简化配置，快速验证

---

## 📞 需要帮助？

如果遇到问题，请参考：
- 📋 [RAG问题排查指南](./RAG问题排查指南.md)
- 🧪 [本地测试RAG优化指南](./本地测试RAG优化指南.md)
- 📚 [RAG文档索引](./RAG文档索引.md)
