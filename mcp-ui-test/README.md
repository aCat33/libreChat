# MCP UI Resource 测试示例

演示如何在 MCP Server 中返回 UI Resource，实现 iframe 嵌入本地页面。

## 📁 文件说明

- `mcp_server.py` - MCP Server 实现，支持返回 UI Resource
- `mock_web_server.py` - Mock Web Server，运行在 http://localhost:12308/vessel
- `test_server.py` - 测试工具，验证 MCP Server 响应
- `requirements.txt` - Python 依赖
- `requirements.txt` - Python 依赖
- `使用说明-连接已有服务.md` - 如何连接你自己的本地服务

## 🚀 快速开始

### 1. 安装依赖

```powershell
cd d:\work\librechat\mcp-ui-test
pip install -r requirements.txt
```

### 2. 快速演示（推荐）

最简单的方式 - 直接运行演示脚本：

```powershell
python demo.py
```

这将自动生成3个HTML预览文件，无需启动任何服务器。

### 3. 启动 Mock Web Server（第一个终端）

```powershell
python mock_web_server.py
```

**说明**：
- 如果端口 12308 被占用，程序会自动查找可用端口
- 或者手动指定端口：`python mock_web_server.py 8080`

启动后访问 http://localhost:12308/vessel 应该能看到测试页面。

### 4. 测试 MCP Server（第二个终端）

```powershell
python test_server.py
```

这会测试 MCP Server 的响应，并生成预览 HTML 文件。

### 5. 配置 LibreChat

**重要**：librechat.yaml 已更新，包含必要的配置。

```yaml
# MCP域名白名单（已添加）
mcpSettings:
  allowedDomains:
    - "http://localhost:8081"
    - "http://127.0.0.1:8081"
    - "http://localhost:12308"   # ✅ 已添加
    - "http://127.0.0.1:12308"   # ✅ 已添加

mcpServers:
  # 方式 1：使用 stdio（推荐）
  oilfield-ui-test:
    type: stdio
    command: "python"
    args: ["d:\\work\\librechat\\mcp-ui-test\\mcp_server.py"]
    title: "Oilfield UI Test"
    description: "Test server for UI Resource iframe"
  
  # 方式 2：如果你已有 HTTP MCP Server（保持原配置）
  oilfield-drilling:
    type: http
    url: "http://localhost:8081/sse"
    # ...
```

### 6. 在 LibreChat 中测试
### 2. 准备本地服务

确保你的本地服务正在运行，默认配置为：
- 船舶报表：http://localhost:12308/vessel
- 公司信息：http://localhost:12308/company
- 合同详情：http://localhost:12308/contract

如需连接其他服务地址，请参考 [使用说明-连接已有服务.md](使用说明-连接已有服务.md)。

### 3. 配置 LibreChat

**重要**：librechat.yaml 需要包含必要的配置。

```yaml
# MCP域名白名单
mcpSettings:
  allowedDomains:
    - "http://localhost:12308"   # ✅ MCP UI 测试服务
    - "http://127.0.0.1:12308"   # ✅ 也支持 127.0.0.1
    # 如果你的服务在其他端口，添加你的地址：
    # - "http://localhost:8081"
    # - "http://127.0.0.1:8081"

mcpServers:
  # 使用 stdio 模式
  oilfield-ui-demo:
    type: stdio
    command: "python"
    args: ["d:\\work\\librechat\\mcp-ui-test\\mcp_server.py"]
    title: "Oilfield UI Demo"
    description: "演示 MCP UI Resource - 支持返回 iframe 页面"
```

### 4. 在 LibreChat 中测试

1. 重启 LibreChat
2. 在对话中使用 MCP 工具：
   - "显示船舶报表"
   - "打开钻井仪表盘"
   - "查看井-A-001的详情"
   - "打开公司信息页面"
   - "查看合同详情"

3. LLM 会收到 UI Resource 并使用 `\ui{resource-id}` 标记
4. LibreChat 会自动渲染 iframe

## 📋 可用工具

### 1. get_vessel_report
获取船舶报表页面
获取船舶报表页面 - 返回可交互的 iframe 页面

```json
{
  "vessel_id": "VESSEL-001"  // 可选
}
```

### 2. get_drilling_dashboard
获取钻井数据仪表盘

```json
{
  "date": "2026-02-27"  // 可选，默认今天
}
获取公司信息页面 - 返回公司详细信息和数据

```json
{
  "company_id": "COMPANY-001"  // 可选
}
```

### 3. get_well_details
获取油井详情

```json
{
  "well_name": "井-A-001"  // 必填
}
获取合同详情页面 - 返回合同的详细信息

```json
{
  "contract_id": "CONTRACT-001"  // 必填
}
```

## 🔍 工作原理

1. **MCP Server 返回 UI Resource**
   ```python
   {
       "type": "resource",
       "resource": {
           "uri": "ui://vessel-report-xxx",  # 以 ui:// 开头
           "mimeType": "text/html",
           "text": "<iframe src='http://localhost:12308/vessel'>...",
           "name": "船舶报表"
       }
   }
   ```

2. **LibreChat 解析并分配 resourceId**
   ```
   UI Resource ID: abc123
   UI Resource Marker: \ui{abc123}
   ```

3. **LLM 在回答中使用标记**
   ```
   这是您要的船舶报表：
   
   \ui{abc123}
   
   报表显示了当前的运行状态...
   ```

4. **前端渲染 iframe**
   - 自动将 `\ui{abc123}` 替换为 `<UIResourceRenderer>`
   - 使用 `@mcp-ui/client` 渲染 HTML
   - 支持 iframe 自动调整大小

## ⚠️ 安全注意事项

1. **域名白名单**：必须在 `mcpSettings.allowedDomains` 中配置
2. **SSRF 保护**：LibreChat 会阻止访问内部服务（如 localhost、私有IP）
3. **需要显式配置**：本地地址必须在白名单中才能访问

## 🧪 测试场景

### 场景 1：单个 iframe
```
用户: "显示船舶报表"
LLM: "这是船舶报表系统：\ui{vessel-001}"
→ 显示一个 iframe
```

### 场景 2：多个 iframe 轮播
```
用户: "对比三个钻井平台的数据"
LLM: "以下是三个平台的对比：\ui{platform-a,platform-b,platform-c}"
→ 显示轮播组件，可切换查看
```

### 场景 3：混合内容
```
LLM: "数据概览：
- 总井数：123 口
- 活跃井：45 口

详细报表：\ui{detailed-report}

建议采取以下措施..."
→ 文本 + iframe + 文本
```

### 场景 2：混合内容
```
LLM: "这是您要的船舶报表：

\ui{vessel-report}

报表显示了以下信息：
- 船舶状态：正常运行
- 位置：东海某海域
- 作业情况：钻井作业中

如需查看更多详情，请告诉我。"
→ 文本 + iframe + 文本
```

### 场景 3：多个工具调用
```
用户: "分别显示船舶报表和公司信息"
LLM: 调用两个工具，返回两个 UI Resource
→ 显示两个独立的 iframe
```

## 🎨 自定义样式

在返回的 HTML 中可以自定义样式：

```python
iframe_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {{ margin: 0; padding: 0; }}
        .header {{ background: #667eea; padding: 10px; color: white; }}
        iframe {{ width: 100%; height: 600px; border: none; }}
    </style>
</head>
<body>
    <div class="header">船舶报表系统</div>
    <iframe src="http://localhost:12308/vessel" allowfullscreen></iframe>
</body>
</html>
"""
```

## 🐛 常见问题

### Q1: iframe 不显示
- 检查 Mock Web Server 是否运行
- 确认白名单配置正确
- 查看浏览器控制台错误

### Q2: CORS 错误
- Mock Server 已设置 `Access-Control-Allow-Origin: *`
- 如果还有问题，检查浏览器安全设置
- 检查本地服务是否正常运行（浏览器直接访问 http://localhost:12308/vessel）
- 确认白名单配置正确（librechat.yaml 中的 allowedDomains）
- 查看浏览器控制台错误
- 确认 LibreChat 后端已重启

### Q2: CORS 错误
- 确保你的本地服务支持 CORS（设置 `Access-Control-Allow-Origin`）
- 检查浏览器安全设置
- 如果是 localhost，确保在白名单中同时添加了 localhost 和 127.0.0.1

### Q3: LLM 没有使用 \ui 标记
- 检查 MCP Server 是否返回了 UI Resource
- 确认 resource.uri 以 `ui://` 开头
- 查看 LibreChat 后端日志

## 📚 参考资料

- [MCP 协议文档](https://modelcontextprotocol.io/)
- [LibreChat MCP 集成](https://docs.librechat.ai/features/mcp)
- [@mcp-ui/client 文档](https://github.com/modelcontextprotocol/ui-client)
