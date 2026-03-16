# RAG 文件问答不准确问题排查指南

> 💡 **想了解如何切换全文/向量检索？** 请阅读 [RAG快速入门指南](./RAG快速入门指南.md)

---

## 问题描述
对上传的文档提问时，AI回答的内容与文档实际内容不符。

---

## 快速解决方案

### 🎯 方案1：增加检索片段数（已应用）

**原因**：`RAG_TOP_K=5` 只返回5个片段，对于内容丰富的文档可能不够。

**解决**：已将配置改为：
```env
RAG_TOP_K=10  # 增加到10个片段
```

**测试步骤**：
1. 重启服务：
   ```bash
   docker-compose restart api
   ```
   或者如果不是Docker环境：
   ```bash
   npm run backend  # 重启后端
   ```

2. 重新上传文档并提问
3. 观察回答是否更准确

---

### 🎯 方案2：临时使用全文注入（对比测试）

如果方案1效果不佳，可以临时切换为全文注入来验证是否是向量检索的问题。

**步骤1：修改 .env 文件**
```env
# 临时改为全文注入策略
RAG_STRATEGY=full_context
```

**步骤2：重启服务**
```bash
docker-compose restart api
# 或
npm run backend
```

**步骤3：测试**
1. 重新上传相同的文档
2. 提出相同的问题
3. 对比回答是否更准确

**结果判断**：
- ✅ 如果全文注入准确 → 说明是向量检索配置问题，继续方案3
- ❌ 如果仍然不准确 → 可能是其他问题，见"深度排查"部分

---

### 🎯 方案3：调整向量检索阈值

如果你的文档较小但被错误地使用了向量检索，可以提高阈值：

```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=8000      # 从5000提高到8000
RAG_TOP_K=10
```

这样更多文档会使用全文注入。

---

## 🔍 深度排查

### 1. 检查文档是否完成向量化

大文档上传后需要20-30秒完成向量化，过早提问可能导致问题。

**查看日志**：
```bash
# Docker环境
docker-compose logs api | grep -i "vectorization"

# 或直接查看最新日志
docker-compose logs -f api
```

**关键日志**：
```log
# 向量化开始
[parseText] 🔍 Starting vectorization for file_id: xxx

# 向量化完成（应该在20-30秒后出现）
✅ Vectorization complete for xxx
```

**解决**：等待向量化完成后再提问。

---

### 2. 检查RAG API连接状态

**测试连接**：
```bash
# 测试RAG API是否正常
curl http://localhost:8000/health
```

**预期响应**：
```json
{"status": "ok"}
```

**如果失败**：
- 检查 RAG API 服务是否启动
- 确认端口8000是否正确
- 查看防火墙设置

---

### 3. 查看实际使用的策略

**步骤**：
1. 启用详细日志（已默认开启）
2. 上传文档并提问
3. 查看日志：

```bash
docker-compose logs api | grep -i "extractFileContext"
```

**关键日志**：
```log
# 小文档（全文注入）
[extractFileContext] Small file detected: "xxx.pdf" (3200 tokens)
[extractFileContext] Processing 1 small file(s) with full text injection

# 大文档（向量检索）
[extractFileContext] Large file detected: "xxx.pdf" (8500 tokens)  
[extractFileContext] Using vector search for 1 large file(s)
```

---

### 4. 检查向量检索结果质量

**查看检索日志**：
```bash
docker-compose logs api | grep -i "vectorSearch"
```

**关键信息**：
```log
# 成功检索
[vectorSearch] Retrieved 5 chunks for file doc-123

# 检索失败（需要注意）
[vectorSearch] Vector search returned no results
⚠️ Falling back to full text
```

**如果总是fallback**：
- 检查向量化是否成功
- 检查RAG API的向量数据库状态
- 考虑使用全文注入策略

---

## 🎯 推荐配置

根据不同场景选择：

### 场景1：文档较小（< 10页PDF）
```env
RAG_STRATEGY=full_context  # 直接全文注入，最准确
```

### 场景2：文档大小不一（推荐）
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=8000  # 提高阈值，更多文档用全文
RAG_TOP_K=10               # 增加检索片段
```

### 场景3：超大文档（> 50页PDF）
```env
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=15               # 进一步增加检索片段
```

---

## 🧪 测试验证

### 测试步骤
1. **修改配置**（选择上述方案之一）

2. **重启服务**
   ```bash
   docker-compose restart api
   ```

3. **清除缓存**（可选但推荐）
   ```bash
   # Docker环境
   docker-compose exec api npm run flush-cache
   
   # 或重启整个服务
   docker-compose down
   docker-compose up -d
   ```

4. **重新测试**
   - 重新上传文档
   - 等待30秒（确保向量化完成）
   - 提出测试问题
   - 检查答案准确性

### 对比测试表

| 配置 | Token数 | 准确性 | 响应速度 | 成本 |
|------|---------|--------|----------|------|
| **full_context** | 高 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰💰 |
| **hybrid + TOP_K=5** | 低 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 💰 |
| **hybrid + TOP_K=10** | 中 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰 |
| **hybrid + TOP_K=15** | 中高 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 💰💰 |

---

## 🐛 常见问题

### Q1: 为什么有时准确，有时不准确？

**A**: 可能原因：
1. **缓存影响**：相同查询可能返回缓存结果
   - 解决：禁用缓存测试 `RAG_ENABLE_CACHE=false`

2. **向量化未完成**：过早提问
   - 解决：上传后等待30秒

3. **问题表述不同**：不同问法检索到不同片段
   - 解决：使用全文注入或增加TOP_K

### Q2: 如何知道文档用了哪种策略？

**A**: 查看日志：
```bash
docker-compose logs api | tail -100 | grep "file detected"
```
- 显示 "Small file" → 全文注入
- 显示 "Large file" → 向量检索

### Q3: 向量检索总是返回不相关内容怎么办？

**A**: 两个选择：
1. **短期方案**：切换到全文注入
   ```env
   RAG_STRATEGY=full_context
   ```

2. **长期方案**：优化向量化质量
   - 检查嵌入模型配置
   - 调整分块策略（需要修改RAG API配置）
   - 考虑使用更好的嵌入模型

---

## 📊 监控与日志

### 启用详细日志

确保 `.env` 中有：
```env
DEBUG_LOGGING=true
DEBUG_CONSOLE=false
```

### 查看关键日志

```bash
# 查看RAG相关所有日志
docker-compose logs api | grep -E "extractFileContext|vectorSearch|parseText"

# 实时查看
docker-compose logs -f api | grep -E "extractFileContext|vectorSearch"
```

---

## ✅ 当前应用的配置

根据你的情况，已应用：

```env
RAG_API_URL=http://localhost:8000
RAG_USE_FULL_CONTEXT=false
RAG_STRATEGY=hybrid
RAG_VECTOR_THRESHOLD=5000
RAG_TOP_K=10  # ✅ 已从5增加到10
```

**下一步**：
1. 重启服务
2. 重新测试问题文档
3. 如果仍有问题，尝试方案2（全文注入）

---

## 📞 需要更多帮助？

如果以上方案都不能解决问题，请提供：
1. 文档大小和页数
2. 提出的具体问题
3. AI的回答（截图）
4. 文档实际内容（截图）
5. 相关日志片段

这样可以更准确地诊断问题。
