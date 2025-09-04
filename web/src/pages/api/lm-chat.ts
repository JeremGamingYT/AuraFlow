import type { NextApiRequest, NextApiResponse } from "next";
import { Writable } from "stream";

const LM_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://192.168.2.65:1234";
const MODEL_ID = process.env.NEXT_PUBLIC_LM_MODEL_ID ?? "openai/gpt-oss-20b";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body as { message?: string };
  if (!message) {
    return res.status(400).json({ error: "Missing 'message' field" });
  }

  const body = {
    model: MODEL_ID,
    messages: [{ role: "user", content: message }],
    stream: false,
  };

  try {
    const lmRes = await fetch(`${LM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    res.status(lmRes.status);
    if (lmRes.body) {
      const reader = lmRes.body.getReader();
      const stream = new Writable({
        write(chunk, encoding, callback) {
          res.write(chunk, encoding);
          callback();
        },
      });

      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          stream.end();
          res.end();
          return;
        }
        stream.write(value);
        await pump();
      };

      await pump();
    } else {
      res.end();
    }
  } catch (e) {
    res.status(500).json({ error: "Proxy error", details: (e as Error).message });
  }
}
