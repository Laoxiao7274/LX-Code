import type { GraphOperationKind } from "./locks.js";

export type GraphOperationHandle = {
  operationKind: GraphOperationKind;
  requestId: string;
  operationId: string;
  signal: AbortSignal;
  completion: Promise<void>;
  cancel: (reason: string) => void;
  finish: () => void;
};

/** 兜底 TTL:一个 operation 超过此时长仍 active,视为卡死,自动 cancel+finish 释放锁。
 *  防止某个 await 永久挂起导致 graph 永久 busy(只能重启 host 恢复)。
 *  值取 90s:覆盖最慢的 buildServices(含 createAgentSession + resourceLoader.reload),
 *  同时比前端 workspace.setCurrent 的 60s 请求超时长,避免误杀正常慢操作。 */
const OPERATION_TTL_MS = 90_000;

export class GraphOperationRegistry {
  private active: GraphOperationHandle | null = null;

  begin(input: {
    operationKind: GraphOperationKind;
    requestId: string;
    operationId: string;
  }): GraphOperationHandle | null {
    if (this.active) return null;

    const controller = new AbortController();
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    let finished = false;
    let ttlTimer: ReturnType<typeof setTimeout> | null = null;
    const handle: GraphOperationHandle = {
      ...input,
      signal: controller.signal,
      completion,
      cancel: (reason) => {
        if (!controller.signal.aborted) controller.abort(new Error(reason));
      },
      finish: () => {
        if (finished) return;
        finished = true;
        if (ttlTimer) {
          clearTimeout(ttlTimer);
          ttlTimer = null;
        }
        if (this.active === handle) this.active = null;
        resolveCompletion();
      },
    };
    // TTL 兜底:超时自动 cancel(让 await 抛 AbortError) + finish(释放 active 槽位)。
    // unref 避免这个 timer 阻止进程退出。
    ttlTimer = setTimeout(() => {
      if (finished) return;
      handle.cancel(`operation TTL exceeded (${OPERATION_TTL_MS}ms)`);
      handle.finish();
    }, OPERATION_TTL_MS);
    ttlTimer.unref?.();
    this.active = handle;
    return handle;
  }

  getActive(): GraphOperationHandle | null {
    return this.active;
  }

  cancelActive(reason: string): GraphOperationHandle | null {
    const active = this.active;
    active?.cancel(reason);
    return active;
  }
}
