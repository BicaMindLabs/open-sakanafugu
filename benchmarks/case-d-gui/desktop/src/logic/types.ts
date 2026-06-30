// Case D — frozen types. All layers import from here. Do NOT edit (it's the contract).

export type Phase =
  | 'idle'
  | 'planning'
  | 'dispatching'
  | 'integrating'
  | 'reviewing'
  | 'looping'
  | 'done';

export interface TaskInfo {
  readonly id: string;
  readonly status: string;
  readonly summary?: string;
}

export interface AgentInfo {
  readonly name: string;
  readonly role: string;
  readonly healthy: boolean;
}

export interface RunResult {
  readonly stdout: string;
  readonly exitCode: number;
}

export interface WorkflowState {
  readonly phase: Phase;
  readonly taskId: string | null;
  readonly goal: string | null;
  readonly agents: readonly AgentInfo[];
  readonly taskLog: readonly string[];
  readonly lastResult: RunResult | null;
}

export type Action =
  | { readonly type: 'start-plan'; readonly goal: string }
  | { readonly type: 'plan-done'; readonly taskId: string }
  | { readonly type: 'dispatch-done' }
  | { readonly type: 'integrate-done' }
  | { readonly type: 'review-done'; readonly accepted: boolean }
  | { readonly type: 'loop-done' }
  | { readonly type: 'append-log'; readonly line: string }
  | { readonly type: 'set-agents'; readonly agents: readonly AgentInfo[] }
  | { readonly type: 'set-result'; readonly result: RunResult };
