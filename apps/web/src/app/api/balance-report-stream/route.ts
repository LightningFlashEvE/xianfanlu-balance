import {
  buildSandboxBalanceReportStream,
  markCacheCompleted,
  markCacheFailed,
} from "@/actions/sandbox-balance-report";

const ENCODER = new TextEncoder();

function encodeSSE(data: unknown, event?: string): Uint8Array {
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push("");
  lines.push("");
  return ENCODER.encode(lines.join("\n"));
}

export async function POST(request: Request) {
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown, event?: string) => {
        if (abortSignal.aborted) {
          controller.close();
          return false;
        }
        try {
          controller.enqueue(encodeSSE(data, event));
          return true;
        } catch {
          controller.close();
          return false;
        }
      };

      // 发送初始状态
      if (!enqueue({ status: "started", timestamp: new Date().toISOString() }, "status")) {
        return;
      }

      try {
        const result = await buildSandboxBalanceReportStream({
          onThinkingChunk: async (text) => {
            enqueue({
              type: "thinking",
              text,
              timestamp: new Date().toISOString(),
            }, "thinking");
          },
          onProgress: async (label) => {
            enqueue({
              type: "progress",
              label,
              timestamp: new Date().toISOString(),
            }, "progress");
          },
        });

        // 报告生成完成，写入缓存
        if (result) {
          await markCacheCompleted(result);
        }
        enqueue({
          status: "completed",
          message: "报告生成完成，正在加载结果",
          grade: result?.ai?.grade ?? null,
          hasAi: !!result?.ai,
          timestamp: new Date().toISOString(),
        }, "complete");
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成报告失败";
        enqueue({
          status: "error",
          message,
          timestamp: new Date().toISOString(),
        }, "error");

        try {
          await markCacheFailed(message);
        } catch {
          /* ignore cache update error */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: disable buffering
    },
  });
}
