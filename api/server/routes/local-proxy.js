const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const router = express.Router();

/**
 * 代理本地服务，解决 iframe 跨域问题
 * 
 * 使用方法：
 * 在 MCP Server 中使用：http://localhost:3080/local-proxy/
 * 而不是直接使用：http://localhost:12309/
 */
router.use(
  '/',
  createProxyMiddleware({
    target: 'http://localhost:12309',
    changeOrigin: true,
    pathRewrite: {
      '^/local-proxy': '', // 移除 /local-proxy 前缀
    },
    onProxyReq: (proxyReq, req, res) => {
      // 添加必要的请求头
      proxyReq.setHeader('X-Forwarded-For', req.ip);
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.hostname);
    },
    onProxyRes: (proxyRes, req, res) => {
      // 添加 CORS 头，允许 iframe 加载
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      
      // 允许 iframe 嵌入
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
    },
    logLevel: 'debug',
  })
);

module.exports = router;
