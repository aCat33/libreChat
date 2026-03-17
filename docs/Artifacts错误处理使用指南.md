# Artifacts错误处理使用指南

## 问题背景

在使用DeepSeek等AI生成React组件图表时，由于流式生成可能中断，导致生成的代码不完整。当用户再次打开artifact时会看到类似以下的错误：

```
SyntaxError: /App.tsx: Unexpected token, expected "jsxTagEnd" (306:0)
Cannot assign to read only property 'message' of object 'SyntaxError'
```

## 解决方案概览

本次修复通过添加错误边界和代码验证机制来优雅地处理这些错误情况。

### 核心组件

1. **ArtifactErrorBoundary** - React错误边界组件
2. **validateCode工具** - 代码完整性验证
3. **增强的ArtifactPreview** - 集成错误处理的预览组件

## 用户体验

### 错误发生时

当artifact代码不完整或包含语法错误时，用户将看到：

```
┌───────────────────────────────────────┐
│          ⚠️ 代码生成不完整            │
│                                       │
│  AI生成的代码可能在中途中断，         │
│  导致语法不完整。                     │
│  请尝试重新生成或编辑代码修复问题。   │
│                                       │
│  [查看错误详情 ▼]                     │
│  [🔄 重试渲染]                        │
│                                       │
│  💡 您可以切换到"代码"标签            │
│     查看和编辑源代码                   │
└───────────────────────────────────────┘
```

### 可用操作

1. **查看错误详情** - 展开查看具体的错误信息
2. **重试渲染** - 尝试重新渲染artifact
3. **切换到代码标签** - 查看和手动编辑代码
4. **切换artifact** - 自动重置错误状态

## 技术实现

### 1. 错误边界 (ArtifactErrorBoundary)

```tsx
// 自动捕获Sandpack编译和渲染错误
<ArtifactErrorBoundary artifactId={artifact.id} onRetry={handleRetry}>
  <SandpackProvider>
    <SandpackPreview />
  </SandpackProvider>
</ArtifactErrorBoundary>
```

**特性：**
- 自动捕获所有渲染阶段的错误
- 识别语法错误并显示针对性提示
- 切换artifact时自动重置错误状态
- 支持重试功能

### 2. 代码验证 (validateCode)

```typescript
import { validateJSXSyntax, isIncompleteCode } from '~/utils';

const { isValid, errors } = validateJSXSyntax(code);
if (!isValid) {
  console.log('代码问题:', errors);
}

// 快速检查
if (isIncompleteCode(code)) {
  // 代码不完整
}
```

**检测内容：**
- 不平衡的括号/大括号/方括号
- 未闭合的字符串
- 不完整的标签
- 代码末尾的不完整模式
- 未闭合的注释

**智能过滤：**
- 忽略字符串中的特殊字符
- 忽略单行和多行注释中的内容
- 处理转义字符

### 3. 增强的预览组件

```tsx
// 添加了refreshKey支持重试
const [refreshKey, setRefreshKey] = useState(0);

const handleRetry = () => {
  setRefreshKey((prev) => prev + 1);
};

<SandpackProvider key={refreshKey} ... />
```

## 开发者使用

### 添加到新组件

```tsx
import ArtifactErrorBoundary from '~/components/Artifacts/ArtifactErrorBoundary';

function MyComponent() {
  const handleRetry = () => {
    // 重试逻辑
  };

  return (
    <ArtifactErrorBoundary 
      artifactId="unique-id"
      onRetry={handleRetry}
    >
      {/* 可能出错的组件 */}
    </ArtifactErrorBoundary>
  );
}
```

### 验证代码

```typescript
import { validateJSXSyntax } from '~/utils';

const code = `
  function App() {
    return <div>Hello
`;

const { isValid, errors } = validateJSXSyntax(code);

console.log(isValid);  // false
console.log(errors);   
// [
//   "2 unclosed parenthesis(es) (",
//   "1 unclosed brace(s) {"
// ]
```

## 测试

### 运行测试

```bash
cd client
npx jest src/utils/__tests__/validateCode.test.ts
```

### 测试覆盖

- ✅ 验证完整代码
- ✅ 检测不平衡括号
- ✅ 检测不完整模式
- ✅ 处理字符串和注释
- ✅ 边界情况

## 常见问题

### Q: 为什么不做完整的JSX语法解析？

A: 完整的JSX解析需要复杂的编译器技术。我们只需要检测流式生成中断导致的明显不完整代码，简单且高效的模式匹配已经足够。

### Q: 错误边界会影响性能吗？

A: 不会。错误边界只在错误发生时才会激活，正常情况下几乎没有性能开销。

### Q: 可以自定义错误提示吗？

A: 可以。在`ArtifactErrorBoundary`组件中修改渲染逻辑即可自定义错误界面。

### Q: 支持哪些类型的代码验证？

A: 目前支持：
- JavaScript/TypeScript
- JSX/TSX
- 基本括号匹配
- 字符串和注释处理

## 未来改进

可能的优化方向：

1. **主动预防**
   - 在保存前验证代码
   - 显示警告但仍允许保存

2. **智能修复**
   - 尝试自动补全缺失的闭合标签
   - 建议可能的修复方案

3. **更好的诊断**
   - 指出具体的错误位置(行号)
   - 提供修复建议

4. **用户反馈**
   - 允许用户报告假阳性
   - 收集数据改进验证算法

## 相关文件

- `client/src/components/Artifacts/ArtifactErrorBoundary.tsx`
- `client/src/components/Artifacts/ArtifactPreview.tsx`
- `client/src/utils/validateCode.ts`
- `client/src/utils/__tests__/validateCode.test.ts`
- `docs/修复总结-Artifacts错误处理.md`

## 参考资源

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Sandpack Documentation](https://sandpack.codesandbox.io/)
- [AST Explorer](https://astexplorer.net/) - 用于理解JSX解析
