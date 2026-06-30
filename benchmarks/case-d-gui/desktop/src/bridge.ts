import type { AgentInfo, RunResult } from './logic/types';

interface FugueApi {
  run(cmd: string): Promise<RunResult>;
  agents(): Promise<AgentInfo[]>;
}

declare global {
  interface Window {
    fugue: FugueApi;
  }
}

export const bridge: FugueApi = window.fugue;
