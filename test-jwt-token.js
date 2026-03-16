/**
 * 测试 JWT Token 验证
 * 用于诊断 401 错误
 * 
 * 使用方法：
 * node test-jwt-token.js <your-token-here>
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = process.argv[2];

if (!token) {
  console.error('用法: node test-jwt-token.js <token>');
  console.error('\n或者从浏览器复制 token:');
  console.error('1. 打开浏览器开发者工具 Console');
  console.error('2. 输入: localStorage.getItem("token")');
  console.error('3. 复制输出的 token');
  process.exit(1);
}

console.log('\n========== JWT Token 测试 ==========\n');
console.log('Token 长度:', token.length);
console.log('Token 前30字符:', token.substring(0, 30) + '...');
console.log('是否为 JWT 格式:', token.startsWith('eyJ'));

if (!process.env.JWT_SECRET) {
  console.error('\n❌ 错误: JWT_SECRET 环境变量未设置!');
  console.error('请检查 .env 文件');
  process.exit(1);
}

console.log('\n✅ JWT_SECRET 已设置\n');
console.log('JWT_SECRET 长度:', process.env.JWT_SECRET.length);

console.log('\n---------- 验证 Token ----------\n');

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  console.log('✅ Token 验证成功!\n');
  console.log('解码后的 Payload:', JSON.stringify(decoded, null, 2));
  
  if (decoded.exp) {
    const expiryDate = new Date(decoded.exp * 1000);
    const now = new Date();
    const isExpired = expiryDate < now;
    
    console.log('\n---------- Token 有效期 ----------\n');
    console.log('过期时间:', expiryDate.toISOString());
    console.log('当前时间:', now.toISOString());
    console.log('状态:', isExpired ? '❌ 已过期' : '✅ 有效');
    
    if (!isExpired) {
      const remainingMs = expiryDate - now;
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      console.log('剩余时间:', `${remainingHours}小时 ${remainingMins}分钟`);
    }
  }
  
  console.log('\n========== 测试结论 ==========');
  console.log('✅ Token 格式正确');
  console.log('✅ 签名验证通过');
  console.log('✅ 该 Token 应该能够通过 SSE 认证');
  console.log('================================\n');
  
} catch (error) {
  console.error('❌ Token 验证失败!\n');
  console.error('错误类型:', error.name);
  console.error('错误信息:', error.message);
  
  console.log('\n========== 可能的原因 ==========\n');
  
  if (error.name === 'TokenExpiredError') {
    console.log('❌ Token 已过期');
    console.log('   解决方案: 重新登录获取新 token');
  } else if (error.name === 'JsonWebTokenError') {
    console.log('❌ Token 格式错误或签名不匹配');
    console.log('   可能原因:');
    console.log('   1. JWT_SECRET 不匹配（前后端使用不同的密钥）');
    console.log('   2. Token 被篡改或损坏');
    console.log('   3. Token 不是由当前系统签发的');
  } else if (error.name === 'NotBeforeError') {
    console.log('❌ Token 尚未生效');
    console.log('   解决方案: 检查系统时间是否正确');
  } else {
    console.log('❌ 未知错误');
    console.log('   请查看错误详情');
  }
  
  console.log('\n================================\n');
  
  // 尝试不验证签名，只解码查看内容
  try {
    const decoded = jwt.decode(token);
    console.log('Token 内容（未验证签名）:', JSON.stringify(decoded, null, 2));
  } catch (decodeError) {
    console.error('无法解码 token:', decodeError.message);
  }
  
  process.exit(1);
}
