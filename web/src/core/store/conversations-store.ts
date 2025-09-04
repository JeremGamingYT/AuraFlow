import { create } from "zustand";
import { nanoid } from "nanoid";

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ConversationsState {
  conversations: ConversationMeta[];
  currentId: string | null;
  createConversation: (title?: string) => string; // returns new id
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
}

const STORAGE_KEY = "deerflow.conversations";

function load(): Pick<ConversationsState, "conversations" | "currentId"> {
  if (typeof window === "undefined") {
    return { conversations: [], currentId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], currentId: null };
    const data = JSON.parse(raw) as { conversations: ConversationMeta[]; currentId: string | null };
    return data;
  } catch {
    return { conversations: [], currentId: null };
  }
}

function persist(state: Pick<ConversationsState, "conversations" | "currentId">) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  ...load(),
  createConversation(title?: string) {
    const id = nanoid();
    const now = Date.now();
    const newConv: ConversationMeta = {
      id,
      title: title ?? "New conversation",
      createdAt: now,
      updatedAt: now,
    };
    const conversations = [newConv, ...get().conversations];
    set({ conversations, currentId: id });
    persist({ conversations, currentId: id });
    return id;
  },
  renameConversation(id, title) {
    const conversations = get().conversations.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
    set({ conversations });
    persist({ conversations, currentId: get().currentId });
  },
  deleteConversation(id) {
    const conversations = get().conversations.filter((c) => c.id !== id);
    let { currentId } = get();
    if (currentId === id) {
      currentId = conversations.length > 0 && conversations[0] ? conversations[0].id : null;
    }
    set({ conversations, currentId });
    persist({ conversations, currentId });
  },
  selectConversation(id) {
    if (get().currentId === id) return;
    const conv = get().conversations.find((c) => c.id === id);
    if (conv) {
      const conversations = get().conversations.map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c));
      set({ currentId: id, conversations });
      persist({ conversations, currentId: id });
    }
  },
}));
