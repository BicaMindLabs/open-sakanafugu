/** Lifecycle states of a dispatched unit of work. */
export type TaskState = 'pending' | 'done' | 'fail' | 'timeout' | 'canceled';

/** The four states from which a task never transitions again. */
export const TERMINAL_STATES = ['done', 'fail', 'timeout', 'canceled'] as const;
export type TerminalState = (typeof TERMINAL_STATES)[number];

/** A task is terminal iff it is anything but `pending`. */
export const isTerminal = (s: TaskState): s is TerminalState => s !== 'pending';
