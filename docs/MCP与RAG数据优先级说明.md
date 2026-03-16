# MCP与RAG数据优先级处理说明

## 📋 概述

本功能确保LLM在处理来自多个数据源的信息时，能够正确处理数据优先级，特别是当MCP工具返回的结构化数据与文件搜索(RAG)数据存在冲突时。

## 🎯 核心原则

**数据源优先级：MCP > RAG/文件上下文**

- **MCP工具返回的结构化数据**：PRIMARY（主要）数据源，最高优先级
- **RAG/文件搜索数据**：SUPPLEMENTARY（补充）数据源，辅助参考

## 🔧 技术实现

### 1. MCP工具响应优先级标记

**文件**：`packages/api/src/mcp/parsers.ts`

在MCP工具调用返回结果时，自动添加数据优先级说明：

```typescript
IMPORTANT - Data Source Priority:
- The structured data provided above (from MCP tool calls) is the PRIMARY and most authoritative source
- If you have access to file search results or document context, use them as SUPPLEMENTARY information only
- When there are conflicts between MCP tool results and file search/document data, ALWAYS prioritize the MCP tool results
- MCP tool data is more accurate, up-to-date, and specifically retrieved for the current query
- Combine both sources intelligently: use MCP data as the foundation and enhance with relevant file context where appropriate
```

### 2. 文件上下文数据标记

**文件**：`packages/api/src/files/context.ts`

在文件上下文（RAG检索结果）的末尾添加说明：

```
--- Document Context Note ---
This context is from uploaded files. If MCP tool calls provide structured data during conversation, 
prioritize MCP data over this document context when conflicts arise.
```

### 3. Agent客户端增强指令

**文件**：`api/server/controllers/agents/client.js`

在AgentClient的`buildMessages`方法中，为文件上下文添加详细的使用指南：

```javascript
--- Data Source Usage Guidelines ---
The document context above is retrieved from uploaded files (RAG/vector search).
IMPORTANT: If you receive structured data from MCP tool calls during this conversation:
- Treat MCP tool results as the PRIMARY and most authoritative source
- Use the file/document context above as SUPPLEMENTARY background information
- When conflicts arise between MCP data and document data, prioritize MCP tool results
- Combine both sources intelligently: use MCP data as foundation, enhance with relevant file context
- If no MCP tools are called, use the document context as the primary source
```

## 📊 数据流程

```
┌─────────────────────────────────────────────────────────────┐
│                    用户发起查询                              │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
             ↓                       ↓
    ┌────────────────┐      ┌────────────────┐
    │  MCP工具调用    │      │  RAG文件搜索    │
    │  (主要数据源)   │      │  (补充数据源)   │
    └────────┬───────┘      └───────┬────────┘
             │                      │
             │  带优先级说明         │  带优先级说明
             ↓                      ↓
    ┌─────────────────────────────────────┐
    │         传递给LLM处理                │
    │  - MCP数据：PRIMARY source          │
    │  - RAG数据：SUPPLEMENTARY source    │
    └──────────────┬──────────────────────┘
                   │
                   ↓
         ┌──────────────────────┐
         │  LLM生成回答          │
         │  优先使用MCP数据      │
         │  RAG数据作为补充      │
         └──────────────────────┘
```

## 🎮 使用场景示例

### 场景1：MCP和RAG数据一致

**用户查询**："项目的最新状态是什么？"

- **MCP工具**返回：当前sprint进度75%
- **RAG文档**包含：上周sprint进度60%

**LLM行为**：
```
根据最新的项目数据，当前sprint进度为75%。
文档中显示上周进度为60%，说明本周取得了15%的进展。
```

### 场景2：MCP和RAG数据冲突

**用户查询**："数据库连接字符串是什么？"

- **MCP工具**返回：`postgresql://prod.db.example.com:5432/mydb`
- **RAG文档**包含：`postgresql://localhost:5432/testdb`（旧文档）

**LLM行为**：
```
当前生产环境的数据库连接字符串是：
postgresql://prod.db.example.com:5432/mydb

注意：文档中提到的localhost连接可能是开发环境的配置。
```

### 场景3：仅有RAG数据

**用户查询**："项目架构设计原则是什么？"

- **MCP工具**：未调用
- **RAG文档**：包含详细架构说明

**LLM行为**：
```
根据项目文档，主要的架构设计原则包括：
1. 微服务架构
2. 事件驱动设计
3. ...
```

## ✅ 验证方法

### 测试步骤

1. **上传一个文档**到对话中（包含某些信息A）
2. **配置MCP工具**，使其能返回与文档冲突的信息B
3. **发起查询**，触发MCP工具调用
4. **检查LLM回答**：应优先使用MCP返回的信息B

### 预期行为

- ✅ LLM明确使用MCP返回的数据作为主要答案
- ✅ LLM可能提及文档中的信息作为背景或历史参考
- ✅ LLM在回答中说明数据来源和优先级

## 📝 注意事项

1. **数据新鲜度**：MCP工具通常返回实时或最新数据，RAG文档可能包含历史信息
2. **上下文理解**：LLM会智能理解何时需要结合两种数据源
3. **透明度**：建议在回答中说明数据来源，提高用户信任度
4. **兜底机制**：如果MCP工具调用失败，LLM会自动依赖RAG数据

## 🔍 相关文件

- `packages/api/src/mcp/parsers.ts` - MCP响应解析和优先级标记
- `packages/api/src/files/context.ts` - 文件上下文提取（含RAG向量搜索）
- `api/server/controllers/agents/client.js` - Agent客户端消息构建
- `packages/api/src/files/ragRetrieval.ts` - RAG向量检索

## 🚀 扩展建议

### 未来优化方向

1. **冲突检测**：自动检测MCP和RAG数据的冲突并高亮
2. **数据时间戳**：在每个数据源添加时间戳，辅助LLM判断
3. **可配置优先级**：允许用户或agent配置自定义数据源优先级
4. **数据来源标注**：在前端UI中明确标注信息来源

---

**更新日期**：2026-03-12
**版本**：1.0.0
