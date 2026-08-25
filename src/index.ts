export interface Env {
  AI: any;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const { messages } = (await request.json()) as { messages: any[] };

        const lastUserMessage = messages[messages.length - 1]?.content || "";

        // ۱. ساخت عکس با Stable Diffusion XL
        if (
          lastUserMessage.toLowerCase().startsWith("image:") ||
          lastUserMessage.includes("عکس بساز")
        ) {
          const prompt = lastUserMessage
            .replace(/^image:/i, "")
            .replace("عکس بساز", "")
            .trim();

          const imageBytes = await env.AI.run(
            "@cf/stabilityai/stable-diffusion-xl-base-1.0",
            { prompt: prompt || "A beautiful view" }
          );

          let binary = "";
          const bytes = new Uint8Array(imageBytes);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Image = btoa(binary);
          const imageMarkdown = `![Generated Image](data:image/png;base64,${base64Image})`;

          return new Response(
            `data: ${JSON.stringify({ response: imageMarkdown })}\n\ndata: [DONE]\n\n`,
            { headers: { "Content-Type": "text/event-stream" } }
          );
        }

        // افزودن هویت و دستورالعمل دقت بالا به پیام سیستم
        const formattedMessages = [
          {
            role: "system",
            content:
              "You are a highly accurate AI assistant powered by Meta Llama 3.3 70B, hosted on Cloudflare Workers AI. Answer accurately and fluently in Persian or English based on the user's language.",
          },
          ...messages,
        ];

        // ۲. چت متنی با مدل ۷۰ میلیارد پارامتری Llama 3.3
        const stream = await env.AI.run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          {
            messages: formattedMessages,
            stream: true,
            temperature: 0.3, // دما پایین برای کاهش توهم و افزایش دقت
          }
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (error: any) {
        console.error("AI Error:", error);
        return new Response(
          `data: ${JSON.stringify({ response: "خطا در برقراری ارتباط با مدل: " + error.message })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } }
        );
      }
    }

    // بارگذاری فایل‌های ظاهری سایت
    return env.ASSETS.fetch(request);
  },
};
