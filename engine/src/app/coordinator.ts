import type { Artifact } from '../domain/artifact.js';
import type { GateResult } from '../domain/gate.js';
import { isGo } from '../domain/gate.js';
import type { AgentProfile, AgentRegistry } from '../domain/agent-registry.js';
import {
  agentPolicyLabel,
  findAgentProfile,
  resolveAgentTarget,
} from '../domain/agent-registry.js';
import type { Policy, Selection } from '../domain/policy.js';
import { evaluatePolicies, policyResultToGate } from '../domain/policy-eval.js';
import type { AllocationStrategy } from '../domain/ports/allocation-strategy.js';
import type { Barrier } from '../domain/ports/barrier.js';
import type { Harness, HarnessName } from '../domain/ports/harness.js';
import type { ResultStore } from '../domain/ports/result-store.js';
import type { RunStore } from '../domain/ports/run-store.js';
import { isOk } from '../domain/result.js';
import type { RoundManifest } from '../domain/round.js';

/** One unit of work to dispatch (agent optional — the allocator picks the top-ranked when absent). */
export interface DispatchTask {
  readonly key: string;
  readonly taskType: string;
  readonly prompt: string;
  readonly agent?: string;
}

export interface RunReport {
  readonly runId: string;
  readonly status: 'completed' | 'no-go';
  readonly gate: GateResult;
  readonly manifest?: RoundManifest;
}

export interface CoordinatorDeps {
  readonly policies: readonly Policy[];
  readonly allocator: AllocationStrategy;
  /** Default harness for legacy string-only agents. */
  readonly harness: Harness;
  /** Optional runtime map for registry-backed logical agents. */
  readonly harnesses?: ReadonlyMap<HarnessName, Harness>;
  readonly agentRegistry?: AgentRegistry;
  readonly barrier: Barrier;
  readonly resultStore: ResultStore;
  readonly runStore: RunStore;
  /** Injected time source (structural — keeps the app layer off infra). */
  readonly clock: { readonly now: () => number };
  /** Injected content hash for artifact pinning (e.g. sha256-hex). */
  readonly hash: (content: string) => string;
}

interface ResolvedAgent {
  readonly id: string;
  readonly target: string;
  readonly harness: Harness;
  readonly profile?: AgentProfile;
}

/**
 * "Our own thing": composes the ports into the dispatch join. Picks agents
 * (allocator), enforces run policy (retired CLI guard / gen≠review), dispatches in
 * parallel over runtime-selected harnesses, tracks the join barrier, and
 * records run events — the engine analogue of Fugu's coordinator, training-free.
 */
export class Coordinator {
  constructor(private readonly deps: CoordinatorDeps) {}

  /** Resolve agents, gate on policy, then dispatch all tasks for one round and collect (N ⇒ N terminal). */
  async dispatchRound(
    runId: string,
    round: number,
    tasks: readonly DispatchTask[],
  ): Promise<RunReport> {
    const keys = new Set<string>();
    for (const t of tasks) {
      if (keys.has(t.key)) throw new Error(`duplicate task key: ${t.key}`);
      keys.add(t.key);
    }

    const resolved = await Promise.all(
      tasks.map(async (task) => ({ task, agent: await this.resolveAgent(task) })),
    );

    const implementers = resolved
      .map((r) => r.agent)
      .filter((agent): agent is ResolvedAgent => agent !== undefined)
      .map((agent) => this.policyLabel(agent));
    const harnessNames = [
      ...new Set(
        resolved
          .map((r) => r.agent?.harness.name)
          .filter((name): name is HarnessName => name !== undefined),
      ),
    ];
    const onlyHarness = harnessNames.length === 1 ? harnessNames[0] : undefined;
    const selection: Selection =
      onlyHarness === undefined ? { implementers } : { implementers, harness: onlyHarness };
    const gate = policyResultToGate(evaluatePolicies(this.deps.policies, selection));
    if (!isGo(gate)) return { runId, status: 'no-go', gate };

    await this.deps.runStore.create(runId, 'dispatch');
    await this.deps.barrier.open(
      round,
      resolved.map((r) => r.task.key),
    );

    await Promise.all(resolved.map((r) => this.dispatchOne(runId, round, r.task, r.agent)));

    const manifest = await this.deps.barrier.inspect(round);
    if (manifest === null) throw new Error(`round ${round} vanished`);
    return { runId, status: 'completed', gate, manifest };
  }

  private async resolveAgent(task: DispatchTask): Promise<ResolvedAgent | undefined> {
    if (task.agent !== undefined) return this.resolveNamedAgent(task.agent);
    const ranked = await this.deps.allocator.rank({ taskType: task.taskType });
    const top = ranked[0]?.agent;
    return top === undefined ? undefined : this.resolveNamedAgent(top);
  }

  private resolveNamedAgent(id: string): ResolvedAgent {
    const profile = findAgentProfile(this.deps.agentRegistry, id);
    if (profile === undefined) {
      return { id, target: id, harness: this.deps.harness };
    }
    return {
      id: profile.id,
      target: resolveAgentTarget(profile),
      harness: this.resolveHarness(profile.harness),
      profile,
    };
  }

  private resolveHarness(name: HarnessName): Harness {
    const mapped = this.deps.harnesses?.get(name);
    if (mapped !== undefined) return mapped;
    if (this.deps.harness.name === name) return this.deps.harness;
    throw new Error(`agent registry references unavailable harness: ${name}`);
  }

  private policyLabel(agent: ResolvedAgent): string {
    return agent.profile === undefined ? agent.id : agentPolicyLabel(agent.profile);
  }

  private async dispatchOne(
    runId: string,
    round: number,
    task: DispatchTask,
    agent: ResolvedAgent | undefined,
  ): Promise<void> {
    if (agent === undefined) {
      await this.deps.barrier.mark(round, task.key, 'fail');
      await this.event(runId, 'no-agent', task.key);
      return;
    }
    const request =
      agent.profile?.workspace === undefined
        ? { agent: agent.target, prompt: task.prompt, taskType: task.taskType }
        : {
            agent: agent.target,
            prompt: task.prompt,
            taskType: task.taskType,
            workspace: agent.profile.workspace,
          };
    const result = await agent.harness.dispatch(request);
    if (isOk(result)) {
      const artifact: Artifact = {
        id: task.key,
        kind: 'log',
        uri: `result://${task.key}`,
        sha256: this.deps.hash(result.value.output),
      };
      await this.deps.resultStore.put(task.key, [artifact]);
      await this.deps.barrier.mark(round, task.key, 'done');
      await this.event(runId, 'dispatched', `${task.key} → ${this.describeAgent(agent)}`);
    } else {
      await this.deps.barrier.mark(round, task.key, 'fail');
      await this.event(runId, 'failed', `${task.key}: ${result.error.detail}`);
    }
  }

  private describeAgent(agent: ResolvedAgent): string {
    const target = agent.target === agent.id ? agent.id : `${agent.id} (${agent.target})`;
    return `${target} via ${agent.harness.name}`;
  }

  private async event(runId: string, kind: string, detail: string): Promise<void> {
    await this.deps.runStore.appendEvent(runId, {
      at: this.deps.clock.now(),
      phase: 'dispatch',
      kind,
      detail,
    });
  }
}
