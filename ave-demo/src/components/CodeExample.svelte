<div class="bg-[#111111] border border-[#1a1a1a] rounded-3xl overflow-hidden">
  <div class="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
    <span class="text-sm text-[#666]">Quick Integration</span>
    <div class="flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-[#333]"></span>
      <span class="w-3 h-3 rounded-full bg-[#333]"></span>
      <span class="w-3 h-3 rounded-full bg-[#333]"></span>
    </div>
  </div>
  <div class="p-6">
    <pre class="text-sm leading-relaxed overflow-x-auto"><code class="mono"><span class="text-[#666]">// Install the SDK</span>
<span class="text-[#f59e0b]">npm install</span> @ave-id/sdk @ave-id/embed

<span class="text-[#666]">// Add sign-in to your app</span>
<span class="text-[#3b82f6]">import</span> {"{"} openAveSheet {"}"} <span class="text-[#3b82f6]">from</span> <span class="text-[#32a94c]">"@ave-id/embed"</span>;

openAveSheet({"{"}
  clientId: <span class="text-[#32a94c]">"your_client_id"</span>,
  redirectUri: <span class="text-[#32a94c]">"https://yourapp.com/callback"</span>,
  onSuccess: ({"{"} redirectUrl {"}"}) => {"{"}
    window.location.href = redirectUrl;
  {"}"},
{"}"});</code></pre>
  </div>
</div>
