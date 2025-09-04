// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { LMStudioClient } from "@lmstudio/sdk";
import type { ChatEvent } from "./types";
import { env } from "~/env";

export interface LMStudioConfig {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export class LMStudioProvider {
  private client: LMStudioClient;
  private config: LMStudioConfig;

  constructor(config: Partial<LMStudioConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || env.NEXT_PUBLIC_API_URL || "http://192.168.2.65:1234",
      apiKey: config.apiKey || "lm-studio",
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      stream: config.stream ?? true,
    };
    this.client = new LMStudioClient({
      baseUrl: this.config.baseURL?.replace(/^http/, "ws"),
    });
  }

  public async *chat(
    message: string,
    options: { abortSignal?: AbortSignal } = {},
  ): AsyncGenerator<ChatEvent, void, unknown> {
    try {
      if (!this.config.model) {
        const models = await this.getLoadedModels();
        if (models.length > 0 && models[0]) {
          this.config.model = models[0];
          console.log(`🤖 No model selected, automatically using: ${this.config.model}`);
        } else {
          throw new Error("No model configured or available in LM Studio.");
        }
      }

      const stream = await this.client.llm.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: message }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: this.config.stream,
      });

      let id = "";
      for await (const chunk of stream) {
        if (chunk.id) {
          id = chunk.id;
        }
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield {
            type: "message_chunk",
            data: {
              id: id,
              thread_id: "lm-studio-thread",
              agent: "researcher",
              content: choice.delta.content,
              role: "assistant",
              finish_reason: null,
            },
          } as unknown as ChatEvent;
        }
        if (choice?.finish_reason) {
          yield {
            type: "message_chunk",
            data: {
              id: id,
              thread_id: "lm-studio-thread",
              agent: "researcher",
              content: "",
              role: "assistant",
              finish_reason: choice.finish_reason,
            },
          } as unknown as ChatEvent;
        }
      }
    } catch (error) {
      console.error("❌ LM Studio chat error:", error);
      throw error;
    }
  }

  public async getLoadedModels(): Promise<string[]> {
    const models = await this.client.llm.list();
    return models.map((m) => m.id);
  }

  public async switchModel(modelId: string): Promise<void> {
    this.config.model = modelId;
    console.log(`🔄 Switched to model: ${modelId}`);
  }

  public updateConfig(newConfig: Partial<LMStudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = new LMStudioClient({
      baseUrl: this.config.baseURL?.replace(/^http/, "ws"),
    });
    console.log("⚙️ LM Studio config updated:", newConfig);
  }

  public getConfig(): LMStudioConfig {
    return { ...this.config };
  }

  public disconnect(): void {
    console.log("🔌 LM Studio client disconnected");
  }
}

export const lmStudio = new LMStudioProvider();

export function isLMStudioURL(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("192.168.2.65") ||
    url.includes(":1234") ||
    url.includes("lmstudio") ||
    /192\.168\.\d+\.\d+/.test(url) ||
    /10\.\d+\.\d+\.\d+/.test(url) ||
    /172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/.test(url)
  );
}

export function createLMStudioProvider(
  config?: Partial<LMStudioConfig>,
): LMStudioProvider {
  return new LMStudioProvider(config);
}
