# LibreChat RAG 策略优化配置指南

> 💡 **新手入门？** 建议先阅读 [RAG快速入门指南](./RAG快速入门指南.md) 了解全文检索和向量检索的区别和切换方式

本文档说明如何配置和使用 LibreChat 的增强 RAG 功能。

---

## 🔄 快速切换检索方式

### 方法一：选择 RAG 策略

在 `.env` 文件中配置：

```env
# 智能混合模式（推荐）- 自动选择最佳方式
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000

# 全文检索模式 - 所有文档使用全文
RAG_STRATEGY=full_context

# 向量检索模式 - 所有文档使用向量检索
RAG_STRATEGY=vector_search
```

**详细说明**: 参考 [RAG快速入门指南 - 如何切换检索方式](./RAG快速入门指南.md#⚙️-如何切换检索方式)

---

## ✨ 新增功能

### 1. 混合 RAG 策略
- **小文档**：自动使用全文注入（快速、完整）
- **大文档**：自动使用向量检索（精准、高效）
- **智能切换**：根据文档大小和 token 数量自动选择最佳策略

### 2. 智能缓存
- **查询缓存**：相同查询 5 分钟内复用结果
- **上下文缓存**：文档上下文 10 分钟内复用
- **自动过期**：防止内存溢出

### 3. 向量检索增强
- **单文档检索**：精准定位相关段落
- **多文档检索**：跨文档智能检索
- **相关性排序**：按分数排序结果

## ⚙️ 环境变量配置

### 必需配置

```env
# RAG API 服务地址（必需）
RAG_API_URL=http://rag_api:8000
```

### 可选配置（新增）

```env
# RAG 策略选择
# - full_context: 所有文档使用全文注入（原始行为）
# - vector_search: 所有文档使用向量检索
# - hybrid: 智能混合策略（推荐）
RAG_STRATEGY=hybrid

# 向量检索阈值（tokens）
# 文档超过此大小将使用向量检索
RAG_VECTOR_THRESHOLD=5000

# 检索结果数量
# 向量检索时返回的 Top-K 结果
RAG_TOP_K=5

# 是否启用缓存
RAG_ENABLE_CACHE=true

# 缓存有效期（毫秒）
RAG_CACHE_TTL=600000  # 10 分钟
```

## 📊 策略对比

### Full Context 策略
```env
RAG_STRATEGY=full_context
```

**适用场景**：
- ✅ 文档较小（< 5 页 PDF）
- ✅ 需要完整上下文
- ✅ 不关心 token 消耗

**特点**：
- 传输完整文档内容
- AI 可以看到所有信息
- Token 消耗较高

### Vector Search 策略
```env
RAG_STRATEGY=vector_search
```

**适用场景**：
- ✅ 文档很大（> 20 页 PDF）
- ✅ 只需要相关片段
- ✅ 关注 token 成本

**特点**：
- 只传输最相关的片段
- Token 消耗低
- 可能遗漏部分信息

### Hybrid 策略（推荐）
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
```

**适用场景**：
- ✅ 文档大小不一
- ✅ 希望自动优化
- ✅ 平衡性能和效果

**特点**：
- 小文档全文注入
- 大文档向量检索
- 自动选择最佳策略
- **推荐用于生产环境**

## 🎯 使用示例

### 场景 1：小文档问答

**配置**：
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
```

**用户操作**：
```
用户：[上传 产品说明.pdf (3页)]
用户：这个产品的保修期是多久？
```

**系统行为**：
1. 检测文档大小 ≈ 2000 tokens < 5000
2. 使用 **全文注入** 策略
3. 将完整文档内容附加到消息
4. AI 从完整文档中找到答案

### 场景 2：大文档检索

**配置**：
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
```

**用户操作**：
```
用户：[上传 技术手册.pdf (50页)]
用户：如何配置数据库连接池？
```

**系统行为**：
1. 检测文档大小 ≈ 35000 tokens > 5000
2. 使用 **向量检索** 策略
3. 调用 RAG API 检索最相关的 5 个片段
4. 只传输相关片段（≈ 2000 tokens）
5. AI 基于相关片段回答

### 场景 3：多文档对比

**配置**：
```env
RAG_STRATEGY=hybrid
RAG_TOP_K=10
```

**用户操作**：
```
用户：[上传 v1规格.pdf, v2规格.pdf (各30页)]
用户：两个版本的主要区别是什么？
```

**系统行为**：
1. 检测两个文档都是大文档
2. 使用 **多文档向量检索**
3. 跨两个文档检索共 10 个相关片段
4. 按相关性排序
5. AI 对比分析

## 🔧 高级配置

### 1. 调整检索精度

```env
# 提高检索结果数量（更全面但消耗更多 token）
RAG_TOP_K=10

# 降低向量检索阈值（更多文档使用检索）
RAG_VECTOR_THRESHOLD=3000
```

### 2. 优化缓存策略

```env
# 延长缓存时间（减少重复计算）
RAG_CACHE_TTL=1800000  # 30 分钟

# 禁用缓存（确保始终是最新结果）
RAG_ENABLE_CACHE=false
```

### 3. 强制使用特定策略

```env
# 测试环境：使用全文注入
RAG_STRATEGY=full_context

# 生产环境：使用向量检索（节省成本）
RAG_STRATEGY=vector_search
RAG_TOP_K=3  # 减少结果数量
```

## 📈 性能优化建议

### Token 消耗对比

| 策略 | 10页文档 | 50页文档 | 100页文档 |
|-----|---------|---------|----------|
| **Full Context** | 8K tokens | 40K tokens | 80K tokens |
| **Vector Search (K=5)** | 2K tokens | 3K tokens | 3K tokens |
| **Hybrid** | 8K tokens | 3K tokens | 3K tokens |

### 响应时间对比

| 策略 | 首次查询 | 缓存命中 |
|-----|---------|---------|
| **Full Context** | ~200ms | ~50ms |
| **Vector Search** | ~500ms | ~100ms |
| **Hybrid** | ~200-500ms | ~50-100ms |

### 推荐配置（按场景）

#### 个人使用
```env
RAG_STRATEGY=full_context  # 简单直接
RAG_ENABLE_CACHE=true
```

#### 小团队
```env
RAG_STRATEGY=hybrid  # 平衡性能
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
RAG_ENABLE_CACHE=true
```

#### 企业生产
```env
RAG_STRATEGY=hybrid  # 智能优化
RAG_VECTOR_THRESHOLD=3000  # 更激进的检索策略
RAG_TOP_K=3  # 减少 token 消耗
RAG_ENABLE_CACHE=true
RAG_CACHE_TTL=1800000  # 30 分钟
```

## 🐛 故障排查

### 1. 向量检索不生效

**症状**：大文档仍然使用全文注入

**检查**：
```bash
# 确认 RAG_API_URL 已配置
echo $RAG_API_URL

# 测试 RAG API 连接
curl http://rag_api:8000/health

# 检查策略配置
echo $RAG_STRATEGY  # 应该是 hybrid 或 vector_search
```

**解决方案**：
- 确保 RAG API 正常运行
- 检查 `RAG_VECTOR_THRESHOLD` 设置
- 查看日志：`[extractFileContext] Using vector search`

### 2. 检索结果不相关

**症状**：返回的文档片段与问题无关

**调整**：
```env
# 增加检索结果数量
RAG_TOP_K=10

# 或切换回全文注入
RAG_STRATEGY=full_context
```

### 3. Token 超限

**症状**：模型报错 token 超出限制

**调整**：
```env
# 降低向量检索阈值（更多文档使用检索）
RAG_VECTOR_THRESHOLD=2000

# 减少检索结果数量
RAG_TOP_K=3

# 或在 librechat.yaml 中调整
fileConfig:
  fileTokenLimit: 4000  # 降低单文件限制
```

### 4. 缓存问题

**症状**：修改文档后，仍然返回旧内容

**解决**：
```env
# 方案 1：缩短缓存时间
RAG_CACHE_TTL=300000  # 5 分钟

# 方案 2：禁用缓存
RAG_ENABLE_CACHE=false

# 方案 3：重启服务清除缓存
docker-compose restart api
```

## 📝 监控与日志

### 启用详细日志

```env
DEBUG_RAG_API=true
```

### 关键日志信息

```log
# 策略选择
[extractFileContext] Using vector search for 2 large file(s)

# 检索结果
[vectorSearch] Retrieved 5 chunks for file doc-123

# 缓存命中
[vectorSearch] Cache hit for query

# 降级处理
[extractFileContext] Vector search returned no results, falling back to full text
```

## 🔄 迁移指南

### 从旧版本升级

1. **添加新的环境变量**（可选）：
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=5
```

2. **重启服务**：
```bash
docker-compose restart api
```

3. **测试**：
- 上传小文档 → 应该使用全文注入
- 上传大文档 → 应该使用向量检索

### 回退到旧版本

如果遇到问题，可以临时回退：

```env
RAG_STRATEGY=full_context
```

这将恢复到原始的全文注入行为。

## 🎓 最佳实践

1. **生产环境优先使用 Hybrid 策略**
   ```env
   RAG_STRATEGY=hybrid
   ```

2. **根据模型上下文窗口调整阈值**
   - GPT-4 (128K): `RAG_VECTOR_THRESHOLD=10000`
   - Claude 3 (200K): `RAG_VECTOR_THRESHOLD=15000`
   - GPT-3.5 (16K): `RAG_VECTOR_THRESHOLD=3000`

3. **启用缓存提高性能**
   ```env
   RAG_ENABLE_CACHE=true
   ```

4. **监控日志优化配置**
   - 观察 token 消耗
   - 调整 `RAG_TOP_K` 和阈值

5. **定期清理缓存**
   - 重启服务
   - 或禁用缓存后重新启用

---

## 📚 相关文档

- [LibreChat RAG 原理分析](./LibreChat_RAG原理与向量化策略分析.md)
- [RAG API 技术实现](../rag_api-main/RAG技术实现原理分析.md)
- [LibreChat 官方文档](https://docs.librechat.ai/)

---

**优化后的 RAG 策略让 LibreChat 更智能、更高效！** 🚀
