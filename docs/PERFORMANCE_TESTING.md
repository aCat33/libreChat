# 性能优化测试指南

## 快速验证优化效果

### 测试环境准备

```bash
# 1. 安装依赖 (如果还没有)
npm run smart-reinstall

# 2. 启动后端
npm run backend:dev

# 3. 启动前端 (新终端)
npm run frontend:dev
```

---

## 测试场景

### 场景1: Streaming响应速度测试

#### 测试步骤:
1. 打开Chrome DevTools (F12)
2. 切换到 **Performance** 标签
3. 点击录制按钮 (圆形)
4. 在聊天框输入: "请写一个复杂的React组件,包含多个hooks和状态管理"
5. 等待AI完整回复后停止录制
6. 观察以下指标:

#### 优化前预期:
- FPS: 20-25 fps (卡顿明显)
- CPU使用率: 70-90%
- Scripting时间: > 2000ms

#### 优化后预期:
- FPS: 30-45 fps (流畅)
- CPU使用率: 40-60%
- Scripting时间: < 1200ms

---

### 场景2: Artifact生成测试

#### 测试步骤:
1. 发送消息: "请用React和Tailwind创建一个交互式图表组件"
2. 等待生成artifact
3. 观察右侧预览面板的加载速度
4. 在代码编辑器中修改代码
5. 观察预览更新的响应速度

#### 验证点:
- ✅ Streaming过程中,页面不卡顿
- ✅ Artifact按钮出现延迟 < 150ms
- ✅ 切换到preview标签加载时间 < 1s
- ✅ 代码编辑后预览更新 < 500ms
- ✅ CPU使用率保持在合理范围

---

### 场景3: 长对话性能测试

#### 测试步骤:
1. 创建一个包含20+条消息的对话
2. 发送新消息触发streaming
3. 观察滚动流畅度
4. 手动滚动到历史消息区域
5. 返回最新消息

#### 验证点:
- ✅ 自动滚动流畅,无跳跃
- ✅ 手动滚动时不卡顿
- ✅ 历史消息渲染快速
- ✅ 返回底部无延迟

---

### 场景4: LaTeX公式测试

#### 测试步骤:
1. 发送消息: "请解释傅里叶变换,并用LaTeX公式展示"
2. 观察公式渲染速度
3. 再次发送包含更多公式的消息

#### 验证点:
- ✅ 公式渲染无明显延迟
- ✅ Streaming过程中公式实时显示
- ✅ 不会出现闪烁

---

### 场景5: 压力测试

#### 测试步骤:
1. 发送: "请生成一个包含100行代码的复杂React组件,包含图表、表单、动画"
2. 同时观察多个指标
3. 等待完全渲染完成

#### 验证点:
- ✅ 页面始终可交互
- ✅ 无明显内存泄漏
- ✅ CPU使用率回落到正常水平
- ✅ 预览正常显示

---

## 性能对比测试

### 使用Chrome Performance Monitor

1. 打开DevTools → More tools → Performance monitor
2. 观察实时指标:
   - **CPU usage**: 应该降低40-50%
   - **JS heap size**: 应该保持稳定
   - **DOM Nodes**: 无异常增长
   - **Layouts/sec**: 减少30-40%

---

## 测量具体数据

### 使用Performance API

在浏览器控制台运行:

```javascript
// 测量Artifact更新频率
let artifactUpdateCount = 0;
let startTime = Date.now();

const observer = new MutationObserver(() => {
  artifactUpdateCount++;
});

const targetNode = document.querySelector('[data-testid="artifact-preview"]');
if (targetNode) {
  observer.observe(targetNode, { 
    childList: true, 
    subtree: true 
  });
}

// 30秒后查看结果
setTimeout(() => {
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`Updates: ${artifactUpdateCount}`);
  console.log(`Rate: ${(artifactUpdateCount / elapsed).toFixed(2)} updates/sec`);
  console.log(`Expected: ~10 updates/sec (was ~40 before optimization)`);
  observer.disconnect();
}, 30000);
```

---

## 测试Markdown解析性能

```javascript
// 在控制台运行
const testContent = `
# Test
This is **bold** and *italic*.

\`\`\`javascript
function test() {
  return 42;
}
\`\`\`

$$
E = mc^2
$$
`;

console.time('markdown-parse');
// 触发一次Markdown渲染
// (通过React DevTools或手动触发消息更新)
console.timeEnd('markdown-parse');

// 优化后应该 < 50ms
// 优化前通常 80-150ms
```

---

## 移动端测试

### Android/iOS模拟器
1. Chrome DevTools → Toggle device toolbar
2. 选择低端设备 (如 Moto G4)
3. 限制CPU: 4x slowdown
4. 重复上述测试场景

#### 验证点:
- ✅ 移动端仍然流畅
- ✅ Artifact拖动无卡顿
- ✅ 滚动响应及时

---

## 自动化性能测试 (可选)

### 使用Lighthouse

```bash
# 安装lighthouse
npm install -g lighthouse

# 运行测试
lighthouse http://localhost:3090/c/new \
  --only-categories=performance \
  --output=html \
  --output-path=./performance-report.html
```

### 目标分数:
- Performance: > 70
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Speed Index: < 3.0s

---

## 回归测试清单

测试以下功能未被破坏:

- [ ] 正常发送消息
- [ ] Streaming正常显示
- [ ] Artifact生成和预览
- [ ] 代码编辑功能
- [ ] 消息编辑/再生成
- [ ] 图片上传和显示
- [ ] LaTeX公式渲染
- [ ] Markdown语法正常
- [ ] 代码高亮正常
- [ ] 移动端响应式布局
- [ ] 滚动到底部按钮
- [ ] 消息复制功能

---

## 已知问题和限制

1. **极长代码 (>5000行)**: 可能仍会有轻微卡顿
2. **大量图片**: 图片加载速度取决于网络
3. **复杂图表**: Three.js等3D库初始化较慢

---

## 性能监控工具推荐

### Chrome DevTools
- **Performance**: 查看详细的性能时间线
- **Performance Monitor**: 实时监控指标
- **Memory**: 检查内存泄漏
- **Rendering**: 显示重绘区域

### React DevTools
- **Profiler**: 查看组件渲染次数和时间
- **Components**: 检查props变化

### 第三方工具
- **React DevTools Profiler**: 分析组件性能
- **why-did-you-render**: 检测不必要的重渲染
- **bundle-analyzer**: 分析打包体积

---

## 问题排查

### 如果优化后仍然卡顿:

1. **检查浏览器扩展**: 禁用所有扩展后重试
2. **清除缓存**: 硬刷新 (Ctrl+Shift+R)
3. **检查后端**: 后端响应慢也会影响体验
4. **查看网络**: DevTools → Network 查看请求耗时
5. **检查内存**: 是否有内存泄漏导致卡顿

### 常见原因:
- 浏览器版本过旧
- 系统资源不足
- 网络延迟高
- 后端性能问题
- 其他标签页占用资源

---

## 测试报告模板

```markdown
## 性能测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: [姓名]
**浏览器**: Chrome 131.0.0.0
**设备**: [设备型号]

### 场景1: Streaming响应
- FPS: [实测值]
- CPU: [实测值]
- 主观感受: [流畅/轻微卡顿/明显卡顿]

### 场景2: Artifact生成
- 生成时间: [实测值]
- 预览加载: [实测值]
- 主观感受: [快/正常/慢]

### 场景3: 长对话
- 滚动流畅度: [1-5分]
- 自动滚动: [正常/异常]

### 场景4: LaTeX公式
- 渲染速度: [快/正常/慢]
- 是否闪烁: [是/否]

### 场景5: 压力测试
- 页面响应: [流畅/卡顿]
- 内存占用: [MB]
- CPU峰值: [%]

### 回归测试
- 功能正常: [✓/✗]
- 发现问题: [列出问题]

### 总体评价
[优化效果评价]

### 建议
[进一步优化建议]
```

---

## 联系支持

如果遇到问题或有优化建议,请:
1. 记录详细的测试数据
2. 截图或录屏复现步骤
3. 导出Performance profile
4. 提交issue或联系开发团队
