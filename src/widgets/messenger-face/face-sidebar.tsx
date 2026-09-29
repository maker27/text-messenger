'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';

interface FaceSidebarProps {
  children: ReactNode;
}

export function FaceSidebar({ children }: FaceSidebarProps) {
  const isChatOpen = useSelectedLayoutSegment() !== null;

  return (
    <div
      className={`${isChatOpen ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col md:w-[var(--sidebar-width)] md:max-w-[var(--sidebar-width-max,none)] md:min-w-[var(--sidebar-width-min)] md:shrink-0 md:border-r md:border-border`}
    >
      {children}
    </div>
  );
}
