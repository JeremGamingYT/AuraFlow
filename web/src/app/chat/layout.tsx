import { ChatSidebar } from "~/components/chat/sidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <ChatSidebar />
      <div className="flex-grow overflow-hidden">{children}</div>
    </div>
  );
}
