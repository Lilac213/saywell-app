import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
          <h1 className="text-2xl font-bold mb-4">出错了</h1>
          <p className="mb-4 text-muted-foreground">抱歉，应用遇到了一些问题。</p>
          
          <div className="w-full max-w-md bg-muted/50 p-4 rounded-lg overflow-auto text-left mb-6 max-h-[300px]">
            <p className="font-mono text-xs text-red-500 mb-2 font-bold">
              {this.state.error && this.state.error.toString()}
            </p>
            {this.state.errorInfo && (
              <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              返回首页
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
