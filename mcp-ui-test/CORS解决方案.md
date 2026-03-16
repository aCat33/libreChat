# LibreChat iframe 跨域问题解决方案

## 问题原因

浏览器的安全策略（CORS 和 Private Network Access）阻止了公共页面访问本地服务。

---

## 🎯 **推荐解决方案**

### 方案 1：使用 CORS 服务器（最简单）

#### **步骤 1：创建支持 CORS 的简单服务器**

我已经创建了 `cors_server.py`，它会自动处理 CORS 问题。

#### **步骤 2：启动服务器**

```bash
# 在你的项目目录下运行
cd 你的项目目录
py c:\Users\10211\Desktop\AI Files\LibreChat\mcp-ui-test\cors_server.py 12309
```

或者直接在项目目录运行：
```bash
cd 你的项目目录
py cors_server.py 12309
```

#### **步骤 3：测试**
访问 `http://localhost:12309` 确认服务器正常运行。

---

### 方案 2：配置你现有的服务器支持 CORS

根据你的项目类型添加 CORS 配置：

#### **如果是 Node.js Express：**
```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// 配置 CORS
app.use(cors({
  origin: '*',  // 允许所有来源（或指定 'http://localhost:3080'）
  credentials: true
}));

app.listen(12309, () => {
  console.log('Server running on http://localhost:12309');
});
```

#### **如果是 Python Flask：**
```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

if __name__ == '__main__':
    app.run(port=12309)
```

#### **如果是 Python FastAPI：**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### **如果是 Vite 开发服务器：**
在 `vite.config.js` 中添加：
```javascript
export default {
  server: {
    port: 12309,
    cors: true,  // 启用 CORS
  }
}
```

#### **如果是静态文件，使用 http-server：**
```bash
# 安装 http-server
npm install -g http-server

# 启动服务器（自动支持 CORS）
http-server -p 12309 --cors
```

---

### 方案 3：使用 Nginx 反向代理

如果你有 Nginx，可以配置反向代理：

```nginx
server {
    listen 12309;
    
    location / {
        proxy_pass http://你的实际服务地址;
        
        # 添加 CORS 头
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type';
        
        # 移除 X-Frame-Options
        proxy_hide_header X-Frame-Options;
    }
}
```

---

## ✅ 验证步骤

1. **启动你的服务**（上面任一方案）
2. **打开浏览器控制台**（F12）
3. **访问 LibreChat**
4. **在对话中说**："打开项目主页"
5. **检查控制台**：不应该有 CORS 错误

---

## 🔍 常见问题

### Q1: 仍然显示"连接被阻止"？
**A:** 检查浏览器控制台的具体错误信息，可能是：
- CORS 配置未生效：重启服务器
- 端口被占用：更换端口
- X-Frame-Options：确保服务器没有设置此响应头

### Q2: 我的项目是前后端分离的？
**A:** 只需要配置**前端**服务器支持 CORS 即可，因为 iframe 加载的是前端页面。

### Q3: 使用 Docker？
**A:** 在 docker-compose.yml 中添加：
```yaml
environment:
  - CORS_ORIGIN=*
```

---

## 🎨 最终配置

当一切配置好后，你的 MCP Server 会这样工作：

1. **用户说**："打开项目主页"
2. **MCP 返回** iframe 指向 `http://localhost:12309/`
3. **浏览器加载** iframe 内容（因为 CORS 已配置）
4. **显示成功** ✅

---

## 需要帮助？

告诉我你的项目使用的技术栈，我可以提供更具体的配置方案！
