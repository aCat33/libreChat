"""
MCP Server 示例 - 支持返回 UI Resource
演示如何在 MCP 响应中嵌入本地页面的 iframe
"""
import asyncio
import json
from datetime import datetime
from mcp.server import Server
from mcp.types import (
    Tool,
    TextContent,
    Resource,
    CallToolResult,
)
from mcp.server.stdio import stdio_server

# 创建 MCP Server 实例
app = Server("oilfield-ui-demo")

# 定义工具列表
TOOLS = [
    Tool(
        name="show_homepage",
        description="打开项目主页 - 显示项目的首页或欢迎页面",
        inputSchema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    ),
    Tool(
        name="show_dashboard",
        description="显示仪表盘 - 打开项目的仪表盘或数据展示页面",
        inputSchema={
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "description": "要显示的页面路径（如 dashboard, list, report 等）",
                }
            },
            "required": [],
        },
    ),
    Tool(
        name="show_details",
        description="显示详情页 - 打开详细信息页面，可以传递 ID 或参数",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "记录ID或标识符",
                },
                "page": {
                    "type": "string",
                    "description": "详情页路径（如 details, view, info 等）",
                }
            },
            "required": [],
        },
    ),
]


@app.list_tools()
async def list_tools() -> list[Tool]:
    """返回可用工具列表"""
    return TOOLS


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> CallToolResult:
    """处理工具调用"""
    
    if name == "show_homepage":
        # 显示项目首页
        iframe_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ height: 100%; width: 100%; }}
        iframe {{
            width: 100%;
            height: 600px;
            border: none;
            display: block;
            overflow: auto;
        }}
    </style>
</head>
<body>
    <iframe src="http://localhost:12309/" title="项目主页" allowfullscreen></iframe>
</body>
</html>"""
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text="正在为您打开项目主页..."
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://homepage-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": iframe_html,
                        "name": "项目主页",
                    }
                }
            ]
        )
    
    elif name == "show_dashboard":
        page = arguments.get("page", "dashboard")
        
        # 构建 URL（如果有指定页面路径）
        url = f"http://localhost:12309/{page}" if page != "dashboard" else "http://localhost:12309/dashboard"
        
        dashboard_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ height: 100%; width: 100%; }}
        iframe {{
            width: 100%;
            height: 600px;
            border: none;
            display: block;
            overflow: auto;
        }}
    </style>
</head>
<body>
    <iframe src="{url}" allowfullscreen></iframe>
</body>
</html>"""
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"正在为您打开 {page} 页面..."
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://dashboard-{page}-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": dashboard_html,
                        "name": f"{page} 页面",
                    }
                }
            ]
        )
    
    elif name == "show_details":
        record_id = arguments.get("id", "")
        page = arguments.get("page", "details")
        
        # 构建 URL（带参数）
        if record_id:
            url = f"http://localhost:12309/{page}?id={record_id}"
        else:
            url = f"http://localhost:12309/{page}"
        
        simple_iframe = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ height: 100%; width: 100%; }}
        iframe {{
            width: 100%;
            height: 600px;
            border: none;
            display: block;
            overflow: auto;
        }}
    </style>
</head>
<body>
    <iframe src=\"{url}\" allowfullscreen></iframe>
</body>
</html>"""
        
        display_text = f"正在为您打开详情页面（ID: {record_id}）..." if record_id else "正在为您打开详情页面..."
        display_name = f"详情 - {record_id}" if record_id else "详情页面"
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=display_text
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://details-{page}-{record_id}-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": simple_iframe,
                        "name": display_name,
                    }
                }
            ]
        )
    
    else:
        raise ValueError(f"Unknown tool: {name}")


async def main():
    """启动 MCP Server"""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    # 注意：stdio 模式下不应该有任何 print 输出到 stdout
    # stdout 是用于 MCP 协议通信的
    # 如果需要日志，请使用 stderr 或文件日志
    import sys
    
    # 可选：将日志输出到 stderr（不干扰 MCP 协议）
    if sys.stderr.isatty():
        # 仅在直接运行时输出（有终端）
        print("MCP Server starting...", file=sys.stderr, flush=True)
    
    asyncio.run(main())
