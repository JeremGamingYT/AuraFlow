"use client";

import { Plus } from "lucide-react";
import { useConversationsStore } from "~/core/store/conversations-store";
import { cn } from "~/lib/utils";

export function ChatSidebar({ className }: { className?: string }) {
  const {
    conversations,
    currentId,
    selectConversation,
    createConversation,
  } = useConversationsStore();

  const handleCreate = () => {
    createConversation();
  };

  return (
    <aside
      className={cn(
        "flex h-full w-60 flex-col border-r bg-muted/40 px-2 py-4",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Conversations</h2>
        <button
          onClick={handleCreate}
          className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
        >
          <Plus size={16} />
        </button>
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
