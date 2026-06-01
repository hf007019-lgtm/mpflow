"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <p className="text-red-400 text-sm mb-2">页面出现错误</p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-xs px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                重试
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
