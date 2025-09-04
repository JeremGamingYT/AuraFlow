"use client";

import { ChatSidebar } from "~/components/chat/sidebar";
import { useUIStore } from "~/core/store/ui-store";
import { cn } from "~/lib/utils";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useUIStore();

  return (
    <div className="flex h-full w-full">
      <ChatSidebar />
      <div
        className={cn(
          "flex-grow overflow-hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
