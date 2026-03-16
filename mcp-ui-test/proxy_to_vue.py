"""
代理服务器 - 将 12309 端口的请求转发到你的 Vue3 开发服务器
解决 CORS 和 iframe 跨域问题

使用场景：
- 你的 Vue3 项目运行在 5173 端口（Vite 默认）
- 你不想修改 Vite 配置
- 需要通过 12309 端口访问并支持 CORS

使用方法：
1. 启动你的 Vue3 项目：npm run dev（运行在 5173）
2. 启动此代理：py proxy_to_vue.py
3. 访问：http://localhost:12309
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error


class ProxyHandler(SimpleHTTPRequestHandler):
    """代理请求到 Vue3 开发服务器"""
    
    # 配置：你的 Vue3 项目实际运行的地址
    TARGET_HOST = 'localhost'
    TARGET_PORT = 5173  # Vite 默认端口，根据实际情况修改
    
    def do_GET(self):
        """处理 GET 请求"""
        try:
            # 构建目标 URL
            target_url = f'http://{self.TARGET_HOST}:{self.TARGET_PORT}{self.path}'
            
            # 发送请求到目标服务器
            req = urllib.request.Request(target_url)
            
            # 复制原始请求头
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    req.add_header(header, value)
            
            # 获取响应
            with urllib.request.urlopen(req) as response:
                # 发送响应状态
                self.send_response(response.status)
                
                # 添加 CORS 响应头
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                
                # 复制其他响应头（跳过可能导致 iframe 阻止的头）
                for header, value in response.headers.items():
                    if header.lower() not in [
                        'x-frame-options', 
                        'content-security-policy',
                        'access-control-allow-origin'
                    ]:
                        self.send_header(header, value)
                
                self.end_headers()
                
                # 转发响应内容
                self.wfile.write(response.read())
                
        except urllib.error.URLError as e:
            self.send_error(502, f'Bad Gateway: 无法连接到 {self.TARGET_HOST}:{self.TARGET_PORT}')
            print(f'❌ 代理错误: {e}')
            print(f'   请确保 Vue3 项目正在 http://{self.TARGET_HOST}:{self.TARGET_PORT} 运行')
    
    def do_POST(self):
        """处理 POST 请求"""
        # 类似 GET，但需要转发请求体
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else None
        
        try:
            target_url = f'http://{self.TARGET_HOST}:{self.TARGET_PORT}{self.path}'
            req = urllib.request.Request(target_url, data=post_data, method='POST')
            
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    req.add_header(header, value)
            
            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                
                for header, value in response.headers.items():
                    if header.lower() not in [
                        'x-frame-options', 
                        'content-security-policy',
                        'access-control-allow-origin'
                    ]:
                        self.send_header(header, value)
                
                self.end_headers()
                self.wfile.write(response.read())
                
        except urllib.error.URLError as e:
            self.send_error(502, f'Bad Gateway: 无法连接到 {self.TARGET_HOST}:{self.TARGET_PORT}')
    
    def do_OPTIONS(self):
        """处理 OPTIONS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f'📡 {self.address_string()} - {format % args}')


def run_proxy(proxy_port=12309, target_host='localhost', target_port=5173):
    """启动代理服务器"""
    
    # 更新处理器的目标配置
    ProxyHandler.TARGET_HOST = target_host
    ProxyHandler.TARGET_PORT = target_port
    
    server_address = ('', proxy_port)
    httpd = HTTPServer(server_address, ProxyHandler)
    
    print('=' * 60)
    print('🚀 Vue3 代理服务器已启动')
    print('=' * 60)
    print(f'📍 代理地址: http://localhost:{proxy_port}')
    print(f'🎯 目标服务器: http://{target_host}:{target_port}')
    print(f'✅ 已配置 CORS 和 iframe 支持')
    print('\n⚠️  请确保你的 Vue3 项目正在运行！')
    print(f'   命令：npm run dev (应该在 http://{target_host}:{target_port})')
    print('\n按 Ctrl+C 停止代理服务器\n')
    print('=' * 60)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n⏹️  代理服务器已停止')
        httpd.shutdown()


if __name__ == '__main__':
    import sys
    
    # 默认配置
    proxy_port = 12309        # LibreChat 访问的端口
    target_host = 'localhost'
    target_port = 5173        # Vite 默认端口
    
    # 命令行参数：py proxy_to_vue.py [proxy_port] [target_port]
    if len(sys.argv) > 1:
        proxy_port = int(sys.argv[1])
    if len(sys.argv) > 2:
        target_port = int(sys.argv[2])
    
    run_proxy(proxy_port, target_host, target_port)
