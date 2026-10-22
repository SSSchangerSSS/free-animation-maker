'use client';

import dynamic from 'next/dynamic';

const Creator = dynamic(() => import('@/components/creator'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f0c08]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c8a24a] border-t-transparent" />
      <p className="text-sm text-[#8a8070]">در حال ساخت آهنگری قهرمانان…</p>
    </div>
  ),
});

export default function Home() {
  return <Creator />;
}
