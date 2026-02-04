📋DOCKER方式部署
RAG API 可以在以下几个地方配置：
1. 环境变量配置（.env 文件）
# RAG API 的 URL 地址
RAG_API_URL=http://rag_api:8000

# RAG API 端口（用于 Docker）
RAG_PORT=8000

# 是否使用完整上下文（可选）
RAG_USE_FULL_CONTEXT=false
2. Docker Compose 配置
在 rag.yml 文件中已经配置了 RAG API 服务：
rag_api:
  image: ghcr.io/danny-avila/librechat-rag-api-dev:latest
  environment:
    - DB_HOST=vectordb
    - DB_PORT=5432
    - POSTGRES_DB=mydatabase
    - POSTGRES_USER=myuser
    - POSTGRES_PASSWORD=mypassword
  ports:
    - "${RAG_PORT}:${RAG_PORT}"
  depends_on:
    - vectordb
3. 主要功能
RAG API 用于：
文本文件解析：处理上传的文档并提取文本内容
向量存储：将文档转换为向量并存储到数据库
文档查询：基于用户问题检索相关文档片段
文件搜索：支持智能文件内容搜索

4. 启动方式
使用 Docker Compose 启动 RAG API：
docker-compose -f rag.yml up -d
如果 RAG_API_URL 未配置，系统会自动回退到本地文本解析方式。

📋 非 Docker 方式配置 RAG API

## ⚠️ 重要说明：关于 API Key

### OpenAI API Key 是做什么的？
在 RAG API 中，OpenAI API Key **专门用于文档向量化（Embedding）**，不是用于对话的。

**作用：**
- 将上传的文档转换为向量（数字表示）
- 存储到向量数据库中
- 用于后续的文档检索

### 千问/DeepSeek 的 API Key 能用吗？
**❌ 不能直接替代。**

- **千问 API Key** 和 **DeepSeek API Key** 是用于**对话模型**的
- 它们**不提供 embedding（向量化）服务**
- RAG API 需要的是专门的 **embedding API**

### 可用的 Embedding 提供商

| 提供商 | 环境变量配置 | 说明 |
|--------|---------|------|
| **OpenAI** | `RAG_OPENAI_API_KEY=sk-xxx` | 默认，需要 OpenAI 账号和 key（付费） |
| **Ollama** | `EMBEDDINGS_PROVIDER=ollama` | 本地免费，需要安装 Ollama |
| **Azure OpenAI** | `RAG_AZURE_OPENAI_API_KEY=xxx` | 企业用户，需要 Azure 账号 |
| **Google GenAI** | `RAG_GOOGLE_API_KEY=xxx` | 需要 Google API key |
| **HuggingFace** | `EMBEDDINGS_PROVIDER=huggingface` | 开源模型，可本地运行 |
| **AWS Bedrock** | AWS credentials | 需要 AWS 账号 |

### OpenAI API Key 在哪里配置？

在 **RAG API 项目**的 `.env` 文件中（注意不是 LibreChat 的 .env）：

```env
# RAG API 项目根目录的 .env 文件
RAG_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
# 或者使用别名（会被上面的覆盖）
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```

### 如何获取 OpenAI API Key？

1. 访问 https://platform.openai.com/
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. **注意：** 这个 key 和 ChatGPT Plus 的订阅是分开的，需要单独充值

### 💡 推荐方案

如果你：
- ✅ **不想付费** → 使用 **Ollama**（完全免费，见下方"Ollama 配置 RAG API"）
- ✅ **注重隐私** → 使用 **Ollama** 或 **HuggingFace**（本地运行）
- ✅ **有 OpenAI 账号** → 使用 **OpenAI**（embedding 价格很便宜，约 $0.00002/1K tokens）
- ✅ **企业用户** → 使用 **Azure OpenAI**

---

## 1. 独立部署 RAG API 服务
RAG API 是一个独立的项目，需要单独部署：
GitHub 仓库: https://github.com/danny-avila/rag_api
部署方式: 按照该仓库的文档说明进行独立安装 
2. 安装 PostgreSQL 数据库（带 pgvector 扩展https://blog.csdn.net/weixin_52198151/article/details/156689306）
RAG API 需要 PostgreSQL 数据库和 pgvector 扩展来存储向量数据：
# Windows 上安装 PostgreSQL
# 1. 下载并安装 PostgreSQL 15 或更高版本
# 2. 安装 pgvector 扩展

# 创建数据库
CREATE DATABASE mydatabase;

# 在数据库中启用 pgvector 扩展
CREATE EXTENSION vector;

3. 配置 RAG API 的环境变量
在 RAG API 项目中配置数据库连接：
DB_HOST=localhost
DB_PORT=5432
POSTGRES_DB=mydatabase
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
RAG_PORT=8000

4. 启动 RAG API 服务
# 进入 RAG API 项目目录
cd path/to/rag_api

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000

5. 在 LibreChat 中配置 RAG API URL
在 LibreChat 项目的 .env 文件中添加：
# RAG API 服务地址（根据实际部署情况调整）
RAG_API_URL=http://localhost:8000

# 可选：是否使用完整上下文
RAG_USE_FULL_CONTEXT=false

6. 验证配置
启动 LibreChat 后，检查日志：

✅ 如果看到 RAG API is running and reachable at http://localhost:8000，说明配置成功
⚠️ 如果看到警告信息，说明 RAG API 未正常运行
7. RAG API 的主要功能
配置成功后，RAG API 将提供以下功能：

文本解析: /text - 解析上传的文档文件
向量嵌入: /embed - 将文档转换为向量存储
文档查询: /query - 基于查询检索相关文档
健康检查: /health - 服务健康状态检查
完整上下文: /documents/{file_id}/context - 获取文档完整内容
🔍 注意事项
数据库要求: 必须安装带 pgvector 扩展的 PostgreSQL
端口配置: 确保 8000 端口未被占用（可修改为其他端口）
回退机制: 如果 RAG API 不可用，LibreChat 会自动回退到本地文本解析
性能考虑: 独立部署可以更好地扩展和优化 RAG 服务
如果你需要更详细的 RAG API 安装步骤，建议访问其 GitHub 仓库查看官方文档。

📋 Ollama 配置 RAG API

## 🔄 与"非 Docker 方式"的区别

### 功能层面
| 对比项 | 非 Docker 方式（通用） | Ollama 配置方式 |
|--------|----------------------|----------------|
| **Embedding 提供商** | 默认使用 OpenAI API 或其他云服务 | 使用本地 Ollama 模型 |
| **成本** | 需要 API key，按调用量付费 | 完全免费，本地运行 |
| **隐私性** | 文档内容会发送到第三方 API | 所有数据都在本地处理 |
| **网络依赖** | 需要稳定的外网连接 | 仅需本地网络 |
| **向量质量** | 取决于 API 提供商（如 OpenAI） | 取决于 Ollama 模型（nomic-embed-text） |

### 部署层面
| 对比项 | 非 Docker 方式（通用） | Ollama 配置方式 |
|--------|----------------------|----------------|
| **依赖服务** | PostgreSQL + pgvector + RAG API | PostgreSQL + pgvector + RAG API + **Ollama** |
| **配置复杂度** | 中等（需配置数据库和 API key） | 较高（额外需要安装配置 Ollama） |
| **启动顺序** | 1. PostgreSQL<br>2. RAG API | 1. PostgreSQL<br>2. Ollama<br>3. RAG API |
| **资源占用** | 较低（主要是数据库和 API） | 较高（Ollama 需要 GPU/CPU 资源运行模型） |

### 💡 选择建议
- **选择通用方式**：如果你已有 OpenAI API key，希望快速部署，且不在意少量成本。
- **选择 Ollama 方式**：如果你注重隐私、希望完全离线运行、或有 GPU 资源可以本地跑模型。

---

## 1. 本地准备
已安装 Ollama 并已拉取模型：
ollama pull nomic-embed-text
Ollama 服务已在本地运行（默认端口 11434）：
ollama serve

2. 启动 RAG API（非 Docker）
克隆并进入 RAG API 项目（https://github.com/danny-avila/rag_api）
安装依赖并启动（假设用 Python）：
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

3. 配置 RAG API 环境变量
在 RAG API 项目根目录下新建或编辑 .env 文件，添加：
```env
# 数据库配置（与通用方式相同）
DB_HOST=localhost
DB_PORT=5432
POSTGRES_DB=mydatabase
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword

# RAG API 配置
RAG_API_URL=http://localhost:8000
RAG_PORT=8000

# 关键区别：指定使用 Ollama 作为 embedding 提供商
EMBEDDINGS_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDINGS_MODEL=nomic-embed-text
```

**⚠️ 重要说明：**
- 如果**不配置** `EMBEDDINGS_PROVIDER=ollama`，RAG API 会尝试使用默认的 OpenAI API（需要 `OPENAI_API_KEY`）。
- 配置了 Ollama 后，embedding（向量化）过程完全在本地完成，无需任何外部 API key。

4. 配置 LibreChat
在 LibreChat 的 .env 文件中，添加或确认：
RAG_API_URL=http://localhost:8000

5. 启动 LibreChat
正常启动 LibreChat 即可，RAG API 会通过本地 Ollama 提供 embedding 服务。

总结
- **核心区别**：`EMBEDDINGS_PROVIDER=ollama` 这一行配置决定了使用本地模型还是云 API
- 不用 Docker 也能本地结合 Ollama 和 RAG API
- **成本优势**：完全免费，无需任何 API key
- **隐私优势**：所有文档处理和向量化都在本地完成
- **硬件要求**：Ollama 运行需要一定的 CPU/GPU 资源（建议 8GB+ RAM）
- 保证 Ollama 和 RAG API 都在本地运行，端口对应即可

如需详细 RAG API 配置，可参考其官方文档或 README。