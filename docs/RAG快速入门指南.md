# RAG 快速入门指南

> 📖 本指南帮助您快速了解并配置 LibreChat 的 RAG（检索增强生成）功能

---

## 📚 什么是 RAG？

RAG (Retrieval-Augmented Generation) 允许 AI 在回答问题时引用您上传的文档内容，实现：

- ✅ 基于文档的精准问答
- ✅ 支持多种文件格式（PDF、Word、Excel、TXT 等）
- ✅ 大文档向量检索、小文档全文注入，自动优化

---

## 📄 支持的文档类型

### 文档类（自动提取文本 + 向量化）

| 格式 | MIME 类型 | 解析路径 |
|------|-----------|---------|
| PDF | `application/pdf` | document_parser |
| Word (.docx) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | document_parser |
| Excel (.xlsx/.xls 等) | `application/vnd.ms-excel` 及变体 | document_parser |
| ODS 表格 | `application/vnd.oasis.opendocument.spreadsheet` | document_parser |

### 文本类（自动提取文本 + 向量化）

| 格式 | 示例 | 解析路径 |
|------|------|---------|
| 纯文本 | `.txt`, `.md`, `.csv` | parseText |
| 代码文件 | `.py`, `.js`, `.ts`, `.java`, `.cpp` 等 | parseText |
| 结构化 | `.json`, `.xml`, `.yaml`, `.html` | parseText |
| 其他文本 | `.sql`, `.sh`, `.tex` 等 | parseText |

### 图片类（OCR 可选）

| 格式 | 处理方式 |
|------|---------|
| JPEG, PNG, GIF, WebP | 发送给模型直接识别；若配置 OCR 则提取文字 |
| HEIC / HEIF | 同上 |

### 音频类（语音转文字）

| 格式 | 处理方式 |
|------|---------|
| MP3, WAV, OGG, M4A, AAC, FLAC 等 | STT（语音转文字），需配置 STT 服务 |

> **注意**：视频文件目前不支持文本提取。

---

## 🔄 上传文档的两阶段处理

上传一个文档（以 PDF 为例）后，系统会执行两步：

```
上传文档
    │
    ▼
① 文本提取（同步，上传响应等待完成）
    │  使用 document_parser 或 parseText 提取纯文本
    │  文本保存到数据库
    ▼
② 向量化（异步，后台运行，不阻塞响应）
    │  计算 token 数量
    ├─ token < RAG_VECTOR_THRESHOLD → 跳过（小文档，直接全文注入）
    └─ token ≥ RAG_VECTOR_THRESHOLD → 调用 RAG API /embed 生成向量
```

**关键点**：文本提取完成后 API 立即返回，向量化在后台继续运行。**发送消息前请等待向量化完成。**

---

## 🎯 核心概念：全文检索 vs 向量检索

### 📄 全文检索 (Full Context)

**工作原理**：将整个文档文本完整传递给 AI

**优点**：
- ✅ 不遗漏任何信息，AI 看到完整上下文
- ✅ 无需额外向量化等待

**缺点**：
- ❌ 大文档消耗大量 token（成本高）
- ❌ 可能超出模型 token 上下文限制

**适用**：小文档（< `RAG_VECTOR_THRESHOLD` tokens，约 3-5 页 PDF）

---

### 🔍 向量检索 (Vector Search)

**工作原理**：
1. 上传时：文档被切片并生成向量，存入向量数据库
2. 查询时：用用户问题检索最相关的 K 个片段（`RAG_TOP_K`，默认 5）
3. 只将这些片段传递给 AI

**优点**：
- ✅ 大幅降低 token 消耗（节省 60-80%）
- ✅ 支持超大文档（100+ 页）
- ✅ 支持跨多文档检索

**缺点**：
- ❌ 可能遗漏不相关片段中的隐含信息
- ❌ 需要 RAG API 服务
- ❌ 需要等待向量化完成后再查询

**适用**：大文档（≥ `RAG_VECTOR_THRESHOLD` tokens，约 3-5 页以上）

---

## ⚙️ 如何切换检索方式

在 `.env` 文件中配置 `RAG_STRATEGY` 参数：

```env
# 智能混合模式（推荐）—— 自动按文档大小选择最佳方式
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000   # token 阈值，超过则向量检索

# 全文检索模式 —— 所有文档全文注入
RAG_STRATEGY=full_context

# 向量检索模式 —— 所有文档向量检索
RAG_STRATEGY=vector_search
```

---

## 🌟 推荐配置：Hybrid 智能混合模式

```env
RAG_API_URL=http://localhost:8000
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000   # 约 3-5 页 PDF
RAG_TOP_K=5                 # 向量检索返回的片段数
```

### Hybrid 模式的完整流程

```
用户发送消息（附带文档）
         │
         ▼
计算文档 token 数
         │
    ┌────┴────┐
token < 5000  token ≥ 5000
    │              │
    ▼              ▼
全文注入       向量检索
（完整文本）   （RAG API /query，返回 TOP-K 片段）
                   │
               无结果时降级
               ↓
           全文注入（兜底）
```

**参考换算**：

| 文档大小 | 估计 token 数 | Hybrid 策略 |
|---------|-------------|------------|
| 1-3 页 PDF | ~500-2000 | 全文注入 |
| 3-5 页 PDF | ~2000-5000 | 接近阈值，取决于内容密度 |
| 5-20 页 PDF | ~5000-20000 | **向量检索** |
| 20 页以上 | >20000 | **向量检索** |

---

## 📊 向量化状态指示器

上传大文档后，文件卡会显示实时向量化状态：

| 指示器 | 含义 | 建议操作 |
|-------|------|---------|
| 🔵 蓝色边框 + 旋转图标 "Indexing..." | 向量化进行中 | **等待完成再发消息** |
| 🟢 绿色边框 + ✅ "Ready" | 向量化完成 | 可以发送消息，向量检索生效 |
| 🔴 红色边框 + ⚠️ "Failed" | 向量化失败 | 系统自动降级为全文注入 |
| 无指示器 | 小文档（无需向量化）| 直接发消息即可 |

> ⚠️ **重要**：看到绿色 ✅ 后再发消息，否则向量搜索会返回空结果（系统会自动降级为全文注入，但会错过向量检索的精准性）。

---

## 🔧 完整配置示例

### 场景 1：只处理小文档

```env
RAG_STRATEGY=full_context
# 不需要 RAG API
```

适合：个人笔记、小型文档、快速测试

### 场景 2：只处理大文档

```env
RAG_STRATEGY=vector_search
RAG_API_URL=http://localhost:8000
RAG_TOP_K=5
```

适合：技术手册、大型文档库、研究论文

### 场景 3：混合使用（推荐）

```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
RAG_API_URL=http://localhost:8000
RAG_ENABLE_CACHE=true
RAG_CACHE_TTL=600000          # 查询缓存 10 分钟
```

---

## 🚀 快速开始

### 步骤 1：配置环境变量

编辑 `.env` 文件：

```env
RAG_API_URL=http://localhost:8000
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
```

### 步骤 2：启动 RAG API

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

1. 上传小文档（< 3 页）→ 立即发消息，全文注入生效
2. 上传大文档（> 5 页）→ **等待文件卡出现绿色 ✅** → 再发消息，向量检索生效

---

## ⚠️ 常见问题

### 1. 上传大文档后立即提问，回答基于错误内容？

**原因**：向量化尚未完成，系统自动降级为全文注入（文本过长可能被截断）。

**解决**：等待文件卡出现绿色 ✅ 后再发消息。

### 2. 向量检索没有结果？

**可能原因**：
- 文档尚未完成向量化（等待 20-60 秒）
- RAG API 服务未运行

**解决**：
```bash
# 检查 RAG API 健康状态
curl http://localhost:8000/health
```

查看后端日志确认向量化是否完成：
```
✅ [向量化完成] 文档名.pdf | 文档已就绪，可进行向量检索
```

### 3. 向量检索结果不够准确？

```env
RAG_TOP_K=10   # 增加检索片段数
```

### 4. Token 超出模型限制？

```env
RAG_VECTOR_THRESHOLD=3000  # 降低阈值，更多文档走向量检索
RAG_TOP_K=3                # 减少检索片段数
```

---

## 📖 进阶阅读

- **策略详解**: [RAG策略优化配置指南.md](./RAG策略优化配置指南.md)
- **问题排查**: [RAG问题排查指南.md](./RAG问题排查指南.md)
- **本地测试**: [本地测试RAG优化指南.md](./本地测试RAG优化指南.md)
