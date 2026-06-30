import type { Action, WorkflowState } from './types.js';

export const initialWorkflowState = (): WorkflowState => ({
  phase: 'idle',
  taskId: null,
  goal: null,
  agents: [],
  taskLog: [],
  lastResult: null,
});

export const reducer = (state: WorkflowState, action: Action): WorkflowState => {
  switch (action.type) {
    case 'start-plan':
      return { ...state, phase: 'planning', goal: action.goal };
    case 'plan-done':
      return { ...state, taskId: action.taskId };
    case 'dispatch-done':
      return { ...state, phase: 'integrating' };
    case 'integrate-done':
      return { ...state, phase: 'reviewing' };
    case 'review-done':
      return { ...state, phase: 'looping' };
    case 'loop-done':
      return { ...state, phase: 'done' };
    case 'append-log':
      return { ...state, taskLog: [...state.taskLog, action.line] };
    case 'set-agents':
      return { ...state, agents: action.agents };
    case 'set-result':
      return { ...state, lastResult: action.result };
  }
};
