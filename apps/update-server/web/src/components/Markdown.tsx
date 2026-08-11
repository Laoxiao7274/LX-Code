// 极简 Markdown 渲染(更新日志用:标题/列表/代码/加粗/段落)
// 不引外部库,够 changelog 用;后续要复杂可换 micromark
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-600">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
}

function renderBlock(src: string): string {
  const lines = src.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  let inCode = false;
  let codeBuf: string[] = [];
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (/^### /.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h4 class="mt-3 mb-1 text-sm font-semibold text-slate-900">${inline(line.slice(4))}</h4>`);
    } else if (/^## /.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3 class="mt-4 mb-1.5 text-sm font-semibold text-brand-700">${inline(line.slice(3))}</h3>`);
    } else if (/^- /.test(line)) {
      if (!inList) { html.push('<ul class="mb-2 ml-1 space-y-1 text-sm text-slate-600">'); inList = true; }
      html.push(`<li class="flex gap-2"><span class="text-slate-300">•</span><span>${inline(line.slice(2))}</span></li>`);
    } else if (line.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p class="mb-2 text-sm text-slate-600">${inline(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  if (inCode) html.push(`<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>${codeBuf.join("\n")}</code></pre>`);
  return html.join("");
}

export function Markdown({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: renderBlock(content) }} />;
}
