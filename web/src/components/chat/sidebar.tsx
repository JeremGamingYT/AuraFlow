"use client";

import { ChevronsLeft, Plus } from "lucide-react";
import { useConversationsStore } from "~/core/store/conversations-store";
import { useUIStore } from "~/core/store/ui-store";
import { cn } from "~/lib/utils";

export function ChatSidebar({ className }: { className?: string }) {
  const { conversations, currentId, selectConversation, createConversation } = useConversationsStore();
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();

  const handleCreate = () => {
    createConversation();
  };

  if (isSidebarCollapsed) {
    return (
      <aside className={cn("h-full border-r bg-muted/40 p-2", className)}>
        <button
          onClick={toggleSidebar}
          className="rounded p-2 hover:bg-accent hover:text-accent-foreground"
          title="Expand sidebar"
        >
          <ChevronsLeft className="h-5 w-5 rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn("flex h-full w-60 flex-col border-r bg-muted/40 px-2 py-4", className)}
    >
      <div className="mb-4 flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Conversations</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
            title="New conversation"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={toggleSidebar}
            className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
            title="Collapse sidebar"
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            className={cn(
              "mb-1 w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground",
              currentId === c.id && "bg-accent text-accent-foreground",
            )}
            title={c.title}
          >
            {c.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
