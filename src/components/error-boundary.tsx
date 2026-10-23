'use client';

// A28 — مرز خطای React: خرابی رندر به‌جای سفیدشدن صفحه، پیام و مسیر
// بازیابی (تلاش مجدد) نشان می‌دهد.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f0c08] p-6 text-center">
          <div className="text-3xl">⚔️</div>
          <h1 className="text-lg font-bold text-[#e8ddc8]">مشکلی پیش آمد</h1>
          <p className="max-w-md text-sm leading-6 text-[#8a8070]">
            یک خطای غیرمنتظره در رابط کاربری رخ داد. با «تلاش مجدد» صفحه بازنشانی می‌شود.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-[#c8a24a]/50 px-4 py-2 text-sm text-[#c8a24a] transition-colors hover:bg-[#c8a24a]/10"
          >
            تلاش مجدد
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
