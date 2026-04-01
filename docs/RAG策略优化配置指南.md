# LibreChat RAG 策略优化配置指南

> 💡 **新手入门？** 建议先阅读 [RAG快速入门指南](./RAG快速入门指南.md) 了解全文检索和向量检索的区别和切换方式

---

## 文档类型与解析路径

LibreChat 根据文件类型自动选择解析路径，所有路径最终都会输出纯文本，并视文档大小决定是否触发向量化。

### Path A — document_parser（结构化文档）

适用类型：

| 文件格式 | MIME 类型 |
|---------|----------|
| PDF | `application/pdf` |
| Word (.docx) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Excel (.xlsx/.xls 及变体) | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 等 |
| ODS 表格 | `application/vnd.oasis.opendocument.spreadsheet` |

**处理流程**：
1. 调用 `document_parser` 策略提取文本
2. 若配置了自定义 OCR（`appConfig.ocr`），优先使用 OCR 引擎
3. 文本保存到数据库
4. 调用 `maybeVectorizeDocument()` 检查 token 数，按需后台向量化

### Path B — parseText（纯文本 / 代码 / 标记语言）

适用类型：

| 类别 | 示例格式 |
|------|---------|
| 纯文本 | `.txt`, `.csv`, `.md` |
| 代码 | `.py`, `.js`, `.ts`, `.java`, `.cpp`, `.c`, `.rb`, `.php` |
| 结构化文本 | `.json`, `.xml`, `.yaml`, `.html`, `.sql` |
| 其他 | `.tex`, `.sh`, `.vtt` 等 |

**处理流程**：
1. 若 `RAG_API_URL` 已配置且 RAG API 健康：调用 RAG API `/text` 端点提取文本
2. 若 RAG API 不可用：回退 `parseTextNative`（原生解析，支持 `.docx` / `.xlsx` / PDF / 纯文本）
3. 文本保存到数据库
4. 调用 `maybeVectorizeDocument()` 检查 token 数，按需后台向量化

### Path C — 图片

- 发送给多模态模型直接识别
- 若配置了 `appConfig.ocr`：提取图片中的文字作为 `text` 字段保存

### Path D — 音频

- 需配置 STT（语音转文字）服务
- 转录文本保存后同样可参与 RAG 检索

---

## 向量化触发逻辑

无论 Path A 还是 Path B，文本提取完成后都会执行同一判断：

```
maybeVectorizeDocument({ text, file, file_id, userId })
  │
  ├─ RAG_API_URL 未配置 → 跳过
  ├─ token 数 < RAG_VECTOR_THRESHOLD → 跳过（小文档，直接全文注入）
  └─ token 数 ≥ RAG_VECTOR_THRESHOLD → 异步调用 RAG API /embed
       ├─ 成功 → 状态更新为 COMPLETED（文件卡显示绿色 ✅）
       └─ 失败 → 状态更新为 FAILED（文件卡显示红色 ⚠️，自动降级全文注入）
```

**token 换算参考**：

| 文档 | 估计 token 数 |
|-----|-------------|
| 1 页 PDF（文字密集） | ~600-1000 |
| 5 页 PDF | ~3000-5000 |
| 10 页 PDF | ~6000-10000 |
| 50 页技术手册 | ~30000-50000 |

---

## RAG_STRATEGY 三种模式详解

### `full_context` — 全文注入

```env
RAG_STRATEGY=full_context
```

**行为**：所有文档，无论大小，均将完整文本注入到 Prompt。

**检索时决策**：`shouldUseVectorSearch` 始终返回 `false`，不调用 RAG API `/query`。

**适用**：
- 小文档为主（< 5 页）
- 不希望等待向量化
- 不关心 token 成本

---

### `vector_search` — 强制向量检索

```env
RAG_STRATEGY=vector_search
```

**行为**：所有文档均使用向量检索，不进行全文注入。

**检索时决策**：`shouldUseVectorSearch` 始终返回 `true`，调用 RAG API `/query` 返回 TOP-K 片段。

**注意**：若文档尚未向量化完成，向量搜索会返回空结果。当前版本在此情况下**不会**自动降级全文注入（仅 hybrid 有降级兜底）。

**适用**：
- 大文档为主（> 10 页）
- 需要严格控制 token 成本

---

### `hybrid` — 智能混合（推荐）

```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
```

**行为**：根据文档 token 数自动选择策略，并在向量检索失败时自动降级。

**检索时完整决策树**：

```
用户发送消息（附带已上传文档）
         │
         ▼
  extractFileContext()
         │
  对每个文本附件，计算 token 数
         │
    ┌────┴────────────────────────────┐
  token < RAG_VECTOR_THRESHOLD     token ≥ RAG_VECTOR_THRESHOLD
    │                                  │
    ▼                                  ▼
  小文档路径                         大文档路径
  全文注入                          向量检索（RAG API /query）
  （完整文本截断到 fileTokenLimit）    │
                                  ┌───┴───┐
                              有结果     无结果
                                │         │
                                ▼         ▼
                          返回 TOP-K    降级：全文注入
                          相关片段      （兜底保证回答质量）
```

**重要**：只有非空结果才会被缓存（`RAG_ENABLE_CACHE=true`），避免向量化未完成时的空结果毒化缓存。

---

## 环境变量完整参考

```env
# RAG API 服务地址（向量化和向量检索必需）
RAG_API_URL=http://localhost:8000

# 检索策略：hybrid | full_context | vector_search
RAG_STRATEGY=hybrid

# 向量化 / 向量检索的 token 阈值（hybrid 模式下生效）
# 文档超过此 token 数时：上传时触发向量化，查询时使用向量检索
RAG_VECTOR_THRESHOLD=5000

# 向量检索返回的片段数（TOP-K）
RAG_TOP_K=5

# 是否启用查询结果缓存
RAG_ENABLE_CACHE=true

# 缓存有效期（毫秒），默认 10 分钟
RAG_CACHE_TTL=600000
```

---

## 策略对比

| 维度 | full_context | vector_search | hybrid |
|-----|-------------|--------------|--------|
| 小文档处理 | 全文注入 | 向量检索 | 全文注入 |
| 大文档处理 | 全文注入（截断） | 向量检索 | 向量检索 |
| Token 消耗 | 高 | 低 | 自动优化 |
| 需要 RAG API | 否 | 是 | 是（大文档时） |
| 向量化失败降级 | — | 无降级 | 自动降级全文注入 |
| 推荐场景 | 测试 / 小文档 | 严格控制成本 | 生产环境（推荐） |

---

## 使用场景示例

### 小文档问答

**文档**：产品说明书（3 页，约 2000 tokens）

```
上传 → 文本提取完成
     → token(2000) < 5000 → 跳过向量化
     → 发消息
     → full_context 或 hybrid 均使用全文注入
     → AI 看到完整文档回答
```

### 大文档精准检索

**文档**：技术手册（50 页，约 35000 tokens）

```
上传 → 文本提取完成
     → token(35000) ≥ 5000 → 触发后台向量化（/embed）
     → 文件卡显示 🔵 "Indexing..."（约 20-60 秒）
     → 文件卡变为 🟢 "Ready"
     → 发消息："如何配置数据库连接池？"
     → hybrid: token ≥ 5000 → 向量检索
     → RAG API /query 返回 5 个最相关片段（约 2000 tokens）
     → AI 基于精准片段回答
```

### 多文档对比检索

**文档**：v1规格.pdf + v2规格.pdf（各 30 页）

```
上传两个文档 → 分别向量化
             → 两个文件卡都显示 🟢 "Ready"
             → 发消息："两个版本的主要区别？"
             → vectorSearchMultiple()：跨两份文档检索共 TOP-K 片段
             → 按相关性排序后注入
             → AI 对比分析
```

---

## 性能参考

### Token 消耗对比（50 页文档）

| 策略 | Token 消耗 | 说明 |
|-----|-----------|-----|
| full_context | ~40,000 | 完整文档（可能截断） |
| vector_search (K=5) | ~2,000-3,000 | 仅最相关 5 片段 |
| hybrid（大文档） | ~2,000-3,000 | 同 vector_search |
| hybrid（小文档） | 实际大小 | 全文注入 |

### 响应时间参考

| 策略 | 无缓存 | 缓存命中 |
|-----|-------|---------|
| full_context | ~100-200ms | ~50ms |
| vector_search | ~300-800ms | ~50-100ms |
| hybrid | 100-800ms（自动） | 50-100ms |

---

## 推荐配置（按场景）

### 个人使用 / 测试

```env
RAG_STRATEGY=full_context
```

### 小团队

```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
RAG_ENABLE_CACHE=true
```

### 企业生产（大文档为主）

```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=3000   # 更激进，更多文档走向量检索
RAG_TOP_K=8                 # 更多片段，提高覆盖率
RAG_ENABLE_CACHE=true
RAG_CACHE_TTL=1800000       # 30 分钟缓存
```

---

## 故障排查

### 向量检索不生效（大文档仍用全文注入）

**检查步骤**：

```bash
# 1. 确认 RAG API 可访问
curl http://localhost:8000/health

# 2. 确认策略配置
grep RAG_STRATEGY .env   # 应为 hybrid 或 vector_search

# 3. 查看后端日志
# 上传时应有：
# 📝 [文档上传] xxx.pdf | Tokens: XXXX | 策略: 向量检索 | 状态: 开始向量化
# 完成时应有：
# ✅ [向量化完成] xxx.pdf | 文档已就绪，可进行向量检索

# 查询时应有：
# [extractFileContext] Using vector search for 1 large file(s)
```

**常见原因**：
- RAG API 未启动或健康检查超时（`parseText` 降级到 native 路径，但向量化不受影响）
- 文档 token 数低于 `RAG_VECTOR_THRESHOLD`
- 发消息时向量化尚未完成（文件卡未显示 🟢 "Ready"）

### 向量检索返回空结果

**可能原因**：
1. 向量化尚未完成 → 等待文件卡显示 🟢 "Ready"
2. RAG API `/embed` 调用失败 → 查看日志 `❌ [向量化失败]`
3. `file_id` 不匹配 → 检查上传响应中的 `file_id`

**Hybrid 模式**会在向量搜索返回空时自动降级全文注入，查看日志：
```
⚠️ [extractFileContext] Vector search returned no results for xxx.pdf. Falling back to full text.
```

### 缓存导致旧内容返回

```env
# 禁用缓存（临时排查）
RAG_ENABLE_CACHE=false

# 或缩短缓存时间
RAG_CACHE_TTL=60000   # 1 分钟
```

> **注意**：只有非空的向量检索结果才会被缓存，不会出现"空结果缓存"问题。

### Token 超出模型上下文限制

```env
RAG_VECTOR_THRESHOLD=2000  # 降低阈值，更多文档走向量检索
RAG_TOP_K=3                # 减少检索片段
```

或在 `librechat.yaml` 中调整：
```yaml
fileConfig:
  fileTokenLimit: 4000
```

---

## 关键日志参考

```log
# 上传阶段
📝 [文档上传] report.pdf | 大小: 2048.00KB | Tokens: 35000 | 策略: 向量检索 | 状态: 开始向量化
✅ [向量化完成] report.pdf | 文档已就绪，可进行向量检索
❌ [向量化失败] report.pdf - Connection refused   ← RAG API 不可用

# 查询阶段
[extractFileContext] Large file detected: "report.pdf" (35000 tokens)
[extractFileContext] Using vector search for 1 large file(s)
[vectorSearch] Retrieved 5 chunks for file <file_id>
[vectorSearch] Cache hit for query                          ← 缓存命中

# 降级日志
⚠️ [extractFileContext] Vector search returned no results for report.pdf. Falling back to full text.
```

---

## 相关文档

- [RAG快速入门指南](./RAG快速入门指南.md)
- [RAG问题排查指南](./RAG问题排查指南.md)
- [本地测试RAG优化指南](./本地测试RAG优化指南.md)
- [LibreChat 官方文档](https://docs.librechat.ai/)
