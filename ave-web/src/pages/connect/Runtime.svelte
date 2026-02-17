<script lang="ts">
  type InitPayload = {
    delegatedToken: string;
  };

  type RequestPayload = {
    id?: string;
    mode?: "stream" | "json";
    messages: Array<{ role: string; content: string }>;
    model?: string;
  };

  let delegatedToken: string | null = null;
  let status = $state("Waiting for connector initialization…");
  let initialized = $state(false);

  function post(type: string, payload?: unknown) {
    window.parent?.postMessage({ type, payload }, "*");
  }

  async function handleRequest(payload: RequestPayload) {
    if (!delegatedToken) {
      post("ave:connector:error", { error: "not_initialized" });
      return;
    }

    const irisBase = "https://api.irischat.app";
    const endpoint = payload.mode === "json"
      ? `${irisBase}/delegated/infer`
      : `${irisBase}/delegated/infer/stream`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delegatedToken}`,
      },
      body: JSON.stringify({
        messages: payload.messages,
        model: payload.model,
      }),
    });

    if (!response.ok) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        body = { error: "request_failed" };
      }

      post("ave:connector:error", {
        id: payload.id,
        status: response.status,
        ...body,
      });
      return;
    }

    if (payload.mode === "json") {
      const body = await response.json();
      post("ave:connector:event", {
        id: payload.id,
        type: "result",
        content: body.content || "",
        metadata: body,
      });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      post("ave:connector:error", { id: payload.id, error: "no_stream_body" });
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payloadText = line.slice(6);
        try {
          const parsed = JSON.parse(payloadText);
          post("ave:connector:event", {
            id: payload.id,
            type: parsed.done ? "done" : "token",
            ...parsed,
          });
        } catch {
          // ignore malformed chunk
        }
      }
    }
  }

  function handleMessage(event: MessageEvent) {
    const data = event.data || {};
    if (data.type === "ave:connector:init") {
      const payload = (data.payload || {}) as InitPayload;
      delegatedToken = payload.delegatedToken;
      initialized = true;
      status = "Connector runtime ready";
      post("ave:connector:ready");
      return;
    }

    if (data.type === "ave:connector:request") {
      handleRequest(data.payload as RequestPayload).catch((error) => {
        post("ave:connector:error", { error: error?.message || String(error) });
      });
    }
  }

  $effect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  });
</script>

<div class="h-full min-h-screen-fixed w-full bg-[#090909] text-[#B9BBBE] grid place-items-center p-6">
  <div class="text-center max-w-xl">
    <h1 class="text-[26px] font-bold text-white">Ave Connector Runtime</h1>
    <p class="mt-3 text-[15px]">{status}</p>
    {#if !initialized}
      <p class="mt-2 text-[13px] text-[#7A7A7A]">This frame is controlled by the host app via secure postMessage.</p>
    {/if}
  </div>
</div>
