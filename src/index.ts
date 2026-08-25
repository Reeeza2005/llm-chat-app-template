export interface Env {
  AI: any;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ۱. پردازش درخواست‌های چت API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const { messages } = (await request.json()) as { messages: any[] };

        // دریافت آخرین پیام کاربر
        const lastUserMessage = messages[messages.length - 1]?.content || "";

        // اگر کاربر درخواست عکس داده باشد
        if (
          lastUserMessage.toLowerCase().startsWith("image:") ||
          lastUserMessage.includes("عکس بساز")
        ) {
          const prompt = lastUserMessage
            .replace(/^image:/i, "")
            .replace("عکس بساز", "")
            .trim();

          // تولید عکس با Stable Diffusion XL
          const imageBytes = await env.AI.run(
            "@cf/stabilityai/stable-diffusion-xl-base-1.0",
            { prompt: prompt || "A beautiful landscape" }
          );

          // تبدیل مستقیم به Base64
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

        // ۲. چت متنی پیش‌فرض با جدیدترین مدل Llama 3.1
        const stream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: messages,
          stream: true,
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
          },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // ۳. بارگذاری فایل‌های ظاهری و رابط کاربری (ضروری برای جلوگیری از خطا)
    return env.ASSETS.fetch(request);
  },
};
