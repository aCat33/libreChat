"""
简单的 HTTP 服务器，支持 CORS
用于解决 LibreChat iframe 跨域问题

使用方法：
1. 将你的项目文件放在当前目录下
2. 运行：py cors_server.py
3. 访问：http://localhost:12309
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os


class CORSRequestHandler(SimpleHTTPRequestHandler):
    """支持 CORS 的 HTTP 请求处理器"""
    
    def end_headers(self):
        # 添加 CORS 响应头
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # 允许在 iframe 中加载
        # 移除 X-Frame-Options 限制
        
        super().end_headers()
    
    def do_OPTIONS(self):
        """处理 OPTIONS 预检请求"""
        self.send_response(200)
        self.end_headers()


def run_server(port=12309, directory='.'):
    """启动支持 CORS 的 HTTP 服务器"""
    os.chdir(directory)
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    
    print(f'🚀 CORS-enabled HTTP Server 已启动')
    print(f'📍 地址: http://localhost:{port}')
    print(f'📁 目录: {os.getcwd()}')
    print(f'✅ 支持 CORS 和 iframe 嵌入')
    print(f'\n按 Ctrl+C 停止服务器\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n服务器已停止')
        httpd.shutdown()


if __name__ == '__main__':
    import sys
    
    # 默认端口 12309，可以通过命令行参数修改
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 12309
    
    # 默认当前目录，可以通过命令行参数指定目录
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    
    run_server(port, directory)
