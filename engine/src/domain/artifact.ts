export type ArtifactKind = 'diff' | 'file' | 'log' | 'plan';

/** A durable output of a task. `uri` locates the bytes; `sha256` pins them. */
export interface Artifact {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly uri: string;
  readonly sha256: string;
}
