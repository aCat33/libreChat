import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@librechat/client';
import { cn } from '~/utils';

interface Props {
  children: ReactNode;
  artifactId?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ArtifactErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Artifact rendering error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when artifact changes
    if (prevProps.artifactId !== this.props.artifactId && this.state.hasError) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isSyntaxError = error?.message?.includes('Unexpected token') ||
        error?.message?.includes('SyntaxError') ||
        error?.message?.includes('jsxTagEnd');

      return (
        <div className="flex h-full w-full items-center justify-center bg-surface-primary p-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-surface-error-light p-3">
              <AlertTriangle className="size-8 text-text-error" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-text-primary">
                {isSyntaxError ? '代码生成不完整' : '渲染错误'}
              </h3>
              <p className="text-sm text-text-secondary">
                {isSyntaxError
                  ? 'AI生成的代码可能在中途中断，导致语法不完整。请尝试重新生成或编辑代码修复问题。'
                  : '无法渲染此artifact。可能是代码包含错误或使用了不支持的功能。'}
              </p>
            </div>

            {error?.message && (
              <details className="w-full">
                <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary">
                  查看错误详情
                </summary>
                <div
                  className={cn(
                    'mt-2 max-h-32 overflow-auto rounded border border-border-medium',
                    'bg-surface-secondary p-2 text-left font-mono text-xs text-text-secondary',
                  )}
                >
                  {error.message}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                disabled={!this.props.onRetry}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                重试渲染
              </Button>
            </div>

            <p className="text-xs text-text-tertiary">
              提示：您可以切换到"代码"标签查看和编辑源代码
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ArtifactErrorBoundary;
