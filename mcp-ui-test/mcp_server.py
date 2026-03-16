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
        name="get_vessel_report",
        description="获取船舶报表页面 - 返回可交互的 iframe 页面",
        inputSchema={
            "type": "object",
            "properties": {
                "vessel_id": {
                    "type": "string",
                    "description": "船舶ID（可选）",
                }
            },
            "required": [],
        },
    ),
    Tool(
        name="get_drilling_dashboard",
        description="获取公司信息页面 - 返回公司详细信息和数据",
        inputSchema={
            "type": "object",
            "properties": {
                "company_id": {
                    "type": "string",
                    "description": "公司ID（可选）",
                }
            },
            "required": [],
        },
    ),
    Tool(
        name="get_well_details",
        description="获取合同详情页面 - 返回合同的详细信息",
        inputSchema={
            "type": "object",
            "properties": {
                "contract_id": {
                    "type": "string",
                    "description": "合同ID或编号",
                }
            },
            "required": ["contract_id"],
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
    
    if name == "get_vessel_report":
        vessel_id = arguments.get("vessel_id", "default")
        
        # 直接返回 iframe，指向已有的本地服务
        # 修改这里的 URL 为你实际的本地服务地址
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
    <iframe src=\"http://localhost:12308/vessel\" title=\"船舶报表\" allowfullscreen></iframe>
</body>
</html>"""
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"正在为您打开船舶报表系统（船舶ID: {vessel_id}）..."
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://vessel-report-{vessel_id}-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": iframe_html,
                        "name": f"船舶报表 - {vessel_id}",
                    }
                }
            ]
        )
    
    elif name == "get_drilling_dashboard":
        company_id = arguments.get("company_id", "default")
        
        # 直接返回 iframe，指向公司信息页面
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
    <iframe src="http://localhost:12308/company" allowfullscreen></iframe>
</body>
</html>"""
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"正在为您打开公司信息页面（公司ID: {company_id}）..."
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://company-info-{company_id}-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": dashboard_html,
                        "name": f"公司信息 - {company_id}",
                    }
                }
            ]
        )
    
    elif name == "get_well_details":
        contract_id = arguments.get("contract_id", "未知")
        
        # 直接返回 iframe，指向合同详情页面
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
    <iframe src=\"http://localhost:12308/contract\" allowfullscreen></iframe>
</body>
</html>"""
        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"正在为您打开合同详情页面（合同编号: {contract_id}）..."
                ),
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"ui://contract-details-{contract_id}-{int(datetime.now().timestamp())}",
                        "mimeType": "text/html",
                        "text": simple_iframe,
                        "name": f"合同详情 - {contract_id}",
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
