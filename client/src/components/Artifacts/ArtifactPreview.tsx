import React, { memo, useMemo, useState, useRef, useEffect, type MutableRefObject } from 'react';
import { SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react/unstyled';
import { AlertTriangle } from 'lucide-react';
import type {
  SandpackProviderProps,
  SandpackPreviewRef,
} from '@codesandbox/sandpack-react/unstyled';
import type { TStartupConfig } from 'librechat-data-provider';
import type { ArtifactFiles } from '~/common';
import { useArtifactsContext } from '~/Providers/ArtifactsContext';
import ArtifactErrorBoundary from './ArtifactErrorBoundary';
import { sharedFiles, sharedOptions } from '~/utils/artifacts';

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
  artifactId,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: TStartupConfig;
  artifactId?: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const prevCodeRef = useRef<string>('');
  const [isCodeComplete, setIsCodeComplete] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const codeCheckTimerRef = useRef<NodeJS.Timeout>();
  const { isSubmitting } = useArtifactsContext();

  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    if (prevCodeRef.current === code) {
      return files;
    }
    prevCodeRef.current = code;
    return {
      ...files,
      [fileKey]: { code },
    };
  }, [currentCode, files, fileKey]);

  useEffect(() => {
    if (isSubmitting) {
      setIsCodeComplete(false);
      setIsTruncated(false);
      if (codeCheckTimerRef.current) {
        clearTimeout(codeCheckTimerRef.current);
      }
      return;
    }

    const effectiveCode = currentCode ?? (files[fileKey] as string | undefined) ?? '';
    if (!effectiveCode) {
      setIsCodeComplete(false);
      return;
    }

    if (codeCheckTimerRef.current) {
      clearTimeout(codeCheckTimerRef.current);
    }

    const hasValidStructure = (code: string): boolean => {
      if (fileKey.endsWith('.tsx') || fileKey.endsWith('.jsx')) {
        const hasImport = /import\s+/.test(code);
        const hasExport = /export\s+(default|function|const)/.test(code);

        const cleanCode = code.replace(/\\['"`]/g, '');
        const singleQuotes = (cleanCode.match(/'/g) ?? []).length;
        const doubleQuotes = (cleanCode.match(/"/g) ?? []).length;
        const backticks = (cleanCode.match(/`/g) ?? []).length;
        const quotesValid =
          singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0;

        const openBraces = (code.match(/{/g) ?? []).length;
        const closeBraces = (code.match(/}/g) ?? []).length;
        const openParens = (code.match(/\(/g) ?? []).length;
        const closeParens = (code.match(/\)/g) ?? []).length;
        const openBrackets = (code.match(/\[/g) ?? []).length;
        const closeBrackets = (code.match(/]/g) ?? []).length;
        const bracketsValid =
          Math.abs(openBraces - closeBraces) <= 1 &&
          Math.abs(openParens - closeParens) <= 1 &&
          Math.abs(openBrackets - closeBrackets) <= 1;

        const openTags = (code.match(/<[A-Z][a-zA-Z0-9]*[^>]*>/g) ?? []).length;
        const closeTags = (code.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
        const selfClosingTags = (code.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
        const tagsValid = Math.abs(openTags - closeTags - selfClosingTags) <= 1;

        const trimmed = code.trim();
        const incompletePatterns = [
          /import\s+.*from\s+['"]$/,
          /=\s*$/,
          /,\s*$/,
          /:\s*$/,
          /\.\s*$/,
          /\{\s*$/,
          /\[\s*$/,
          /\(\s*$/,
        ];
        const notAbrupt = !incompletePatterns.some((p) => p.test(trimmed));

        return hasImport && hasExport && quotesValid && bracketsValid && tagsValid && notAbrupt;
      }

      if (fileKey.endsWith('.html')) {
        return code.includes('</html>') || code.includes('</body>');
      }

      return true;
    };

    codeCheckTimerRef.current = setTimeout(() => {
      const isComplete = hasValidStructure(effectiveCode);
      setIsCodeComplete(isComplete);
      setIsTruncated(!isComplete);
    }, 800);

    return () => {
      if (codeCheckTimerRef.current) {
        clearTimeout(codeCheckTimerRef.current);
      }
    };
  }, [currentCode, files, fileKey, isSubmitting]);

  const options: typeof sharedOptions = useMemo(() => {
    if (!startupConfig) {
      return sharedOptions;
    }
    return {
      ...sharedOptions,
      bundlerURL: template === 'static' ? startupConfig.staticBundlerURL : startupConfig.bundlerURL,
    };
  }, [startupConfig, template]);

  const handleRetry = () => {
    setRefreshKey((prev) => prev + 1);
    setIsCodeComplete(true);
    setIsTruncated(false);
  };

  const hasFiles = Object.keys(files).length > 0;

  if (isSubmitting && hasFiles) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-primary">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-border-medium border-t-text-primary" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-primary">正在生成代码...</p>
            <p className="text-xs text-text-secondary">代码生成完成后自动显示预览</p>
          </div>
        </div>
      </div>
    );
  }

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  if (isTruncated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-primary p-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/30">
            <AlertTriangle className="size-8 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-text-primary">代码生成不完整</h3>
            <p className="text-sm text-text-secondary">
              代码超出了模型的输出长度限制，在中途被截断，无法正常预览。
            </p>
          </div>
          <div className="w-full rounded-lg border border-border-medium bg-surface-secondary p-3 text-left text-xs text-text-secondary">
            <p className="font-medium text-text-primary">建议操作：</p>
            <ul className="mt-1 space-y-1 pl-3">
              <li>• 回到对话，发送"代码截断了，请继续生成剩余部分"</li>
              <li>• 或简化需求：减少数据量、拆分为多个步骤</li>
              <li>• 可切换"代码"标签查看已生成内容</li>
            </ul>
          </div>
          <button
            onClick={handleRetry}
            className="text-xs text-text-tertiary underline underline-offset-2 hover:text-text-secondary"
          >
            强制尝试渲染
          </button>
        </div>
      </div>
    );
  }

  if (!isCodeComplete) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-primary">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-border-medium border-t-text-primary" />
          <p className="text-sm font-medium text-text-primary">验证代码中...</p>
        </div>
      </div>
    );
  }

  return (
    <ArtifactErrorBoundary artifactId={artifactId} onRetry={handleRetry}>
      <SandpackProvider
        key={refreshKey}
        files={{ ...artifactFiles, ...sharedFiles }}
        options={options}
        {...sharedProps}
        template={template}
      >
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          tabIndex={0}
          ref={previewRef}
        />
      </SandpackProvider>
    </ArtifactErrorBoundary>
  );
});
