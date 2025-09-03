// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { env } from "~/env";

import type { MCPServerMetadata } from "../mcp";
import type { Resource } from "../messages";
import { extractReplayIdFromSearchParams } from "../replay/get-replay-id";
import { fetchStream } from "../sse";
import { sleep } from "../utils";

import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent } from "./types";

export async function* chatStream(
  userMessage: string,
  params: {
    thread_id: string;
    resources?: Array<Resource>;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
    enable_deep_thinking?: boolean;
    enable_background_investigation: boolean;
    report_style?: "academic" | "popular_science" | "news" | "social_media";
    mcp_settings?: {
      servers: Record<
        string,
        MCPServerMetadata & {
          enabled_tools: string[];
          add_to_agents: string[];
        }
      >;
    };
  },
  options: { abortSignal?: AbortSignal } = {},
) {
  if (
    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ||
    location.search.includes("mock") ||
    location.search.includes("replay=")
  ) 
    return yield* chatReplayStream(userMessage, params, options);
  
  // Detect if the configured base URL points to an OpenAI-compatible endpoint (e.g. LM Studio)
  const base = env.NEXT_PUBLIC_API_URL ?? "";
  const isOpenAICompat = base.includes(":1234") || base.includes("localhost:") || base.includes("127.0.0.1:");

  try{
    const serviceURL = isOpenAICompat
      ? // LM Studio / OpenAI compatible endpoint
        new URL("/v1/chat/completions", env.NEXT_PUBLIC_API_URL!.replace(/\/$/, "")).toString()
      : // Deer-Flow backend endpoint
        resolveServiceURL("chat/stream");

    const body = isOpenAICompat
      ? {
          // LM Studio requires either no model field or an empty/generic one
          messages: [{ role: "user", content: userMessage }],
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
          // LM Studio compatible parameters
          top_p: 0.9,
          presence_penalty: 0,
          frequency_penalty: 0,
        }
      : {
          messages: [{ role: "user", content: userMessage }],
          ...params,
        };

    // Skip the test request to avoid CORS OPTIONS issues with LM Studio
    if (isOpenAICompat) {
      console.log("🔍 LM Studio endpoint detected, skipping test request to avoid CORS issues");
    }

    console.log("🔍 LM Studio Debug:", {
      serviceURL,
      isOpenAICompat,
      body: JSON.stringify(body, null, 2)
    });

    // Try streaming first, fallback to non-streaming if it fails
    let stream;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add Authorization header only for OpenAI-compatible endpoints
      if (isOpenAICompat) {
        headers["Authorization"] = "Bearer lm-studio-dummy-key";
      }
      
      stream = fetchStream(serviceURL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: options.abortSignal,
      });
    } catch (streamError) {
      console.warn("🔄 Streaming failed, trying non-streaming mode:", streamError);
      // Fallback: try without streaming
      const nonStreamingBody = { ...body, stream: false };
      const fallbackHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add Authorization header only for OpenAI-compatible endpoints
      if (isOpenAICompat) {
        fallbackHeaders["Authorization"] = "Bearer lm-studio-dummy-key";
      }
      
      const response = await fetch(serviceURL, {
        method: "POST",
        headers: fallbackHeaders,
        body: JSON.stringify(nonStreamingBody),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("🔍 Non-streaming response:", result);

      // Convert non-streaming response to streaming-like format
      if (result.choices && result.choices[0]) {
        yield {
          type: "message_chunk",
          data: {
            content: result.choices[0].message.content,
            finish_reason: result.choices[0].finish_reason,
            role: "assistant"
          },
        } as ChatEvent;
      }
      return;
    }

    for await (const event of stream) {
      yield {
        type: event.event,
        data: JSON.parse(event.data),
      } as ChatEvent;
    }
  }catch(e){
    console.error("Chat API Error:", e);

    // Handle LM Studio connection errors with helpful messages
    if (isOpenAICompat && e instanceof Error) {
      if (e.message.includes("fetch") || e.message.includes("NetworkError")) {
        console.error("❌ Unable to connect to LM Studio. Please ensure:");
        console.error("   - LM Studio is running");
        console.error("   - A model is loaded in LM Studio");
        console.error("   - Local server is started (green 'Start Server' button)");
        console.error("   - NEXT_PUBLIC_API_URL is set to your LM Studio URL (e.g., http://localhost:1234)");
      } else if (e.message.includes("404")) {
        console.error("❌ LM Studio endpoint not found. Please check:");
        console.error("   - The model supports chat completions");
        console.error("   - LM Studio version supports the OpenAI API");
      } else if (e.message.includes("500")) {
        console.error("❌ LM Studio server error. Please check:");
        console.error("   - The model is properly loaded");
        console.error("   - LM Studio has sufficient resources");
      }
    }

    // Re-throw the error to be handled by the caller
    throw e;
  }
}

async function* chatReplayStream(
  userMessage: string,
  params: {
    thread_id: string;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
  } = {
    thread_id: "__mock__",
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 1,
    max_search_results: 3,
    interrupt_feedback: undefined,
  },
  options: { abortSignal?: AbortSignal } = {},
): AsyncIterable<ChatEvent> {
  const urlParams = new URLSearchParams(window.location.search);
  let replayFilePath = "";
  if (urlParams.has("mock")) {
    if (urlParams.get("mock")) {
      replayFilePath = `/mock/${urlParams.get("mock")!}.txt`;
    } else {
      if (params.interrupt_feedback === "accepted") {
        replayFilePath = "/mock/final-answer.txt";
      } else if (params.interrupt_feedback === "edit_plan") {
        replayFilePath = "/mock/re-plan.txt";
      } else {
        replayFilePath = "/mock/first-plan.txt";
      }
    }
    fastForwardReplaying = true;
  } else {
    const replayId = extractReplayIdFromSearchParams(window.location.search);
    if (replayId) {
      replayFilePath = `/replay/${replayId}.txt`;
    } else {
      // Fallback to a default replay
      replayFilePath = `/replay/eiffel-tower-vs-tallest-building.txt`;
    }
  }
  const text = await fetchReplay(replayFilePath, {
    abortSignal: options.abortSignal,
  });
  const normalizedText = text.replace(/\r\n/g, "\n");
  const chunks = normalizedText.split("\n\n");
  for (const chunk of chunks) {
    const [eventRaw, dataRaw] = chunk.split("\n") as [string, string];
    const [, event] = eventRaw.split("event: ", 2) as [string, string];
    const [, data] = dataRaw.split("data: ", 2) as [string, string];

    try {
      const chatEvent = {
        type: event,
        data: JSON.parse(data),
      } as ChatEvent;
      if (chatEvent.type === "message_chunk") {
        if (!chatEvent.data.finish_reason) {
          await sleepInReplay(50);
        }
      } else if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(500);
      }
      yield chatEvent;
      if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(800);
      } else if (chatEvent.type === "message_chunk") {
        if (chatEvent.data.role === "user") {
          await sleepInReplay(500);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}

const replayCache = new Map<string, string>();
export async function fetchReplay(
  url: string,
  options: { abortSignal?: AbortSignal } = {},
) {
  if (replayCache.has(url)) {
    return replayCache.get(url)!;
  }
  const res = await fetch(url, {
    signal: options.abortSignal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay: ${res.statusText}`);
  }
  const text = await res.text();
  replayCache.set(url, text);
  return text;
}

export async function fetchReplayTitle() {
  const res = chatReplayStream(
    "",
    {
      thread_id: "__mock__",
      auto_accepted_plan: false,
      max_plan_iterations: 3,
      max_step_num: 1,
      max_search_results: 3,
    },
    {},
  );
  for await (const event of res) {
    if (event.type === "message_chunk") {
      return event.data.content;
    }
  }
}

export async function sleepInReplay(ms: number) {
  if (fastForwardReplaying) {
    await sleep(0);
  } else {
    await sleep(ms);
  }
}

let fastForwardReplaying = false;
export function fastForwardReplay(value: boolean) {
  fastForwardReplaying = value;
}
