import { ChatPrototype } from "./chat";

/**
 * Agent 模式视图:对话流(思考块 + 工具调用 + 正文)+ 输入区。
 * 看 agent 自主跑任务,纯对话视角。
 */
export function AgentView() {
  return (
    <div className="h-full p-3">
      <ChatPrototype />
    </div>
  );
}
