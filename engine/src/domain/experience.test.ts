import { describe, expect, it } from 'vitest';

import { explainRecallMatch } from './experience.js';

describe('explainRecallMatch', () => {
  it('reports query score, matched terms, and stored failure cause', () => {
    const explanation = explainRecallMatch(
      {
        title: 'retrieval relabel',
        body: [
          'Failure cause:',
          'retrieval',
          '',
          'Relabeled lesson:',
          'Score dispatch output retrieval by title/body tokens.',
        ].join('\n'),
      },
      { query: 'dispatch output', failureCause: 'retrieval' },
    );

    expect(explanation).toEqual({
      score: 2,
      matchedTerms: ['dispatch', 'output'],
      sourceKind: 'manual',
      failureCause: 'retrieval',
    });
  });

  it('does not treat query stop words as matched evidence', () => {
    const explanation = explainRecallMatch(
      {
        title: 'recent unrelated',
        body: 'Refresh onboarding prose.',
      },
      { query: 'the and to' },
    );

    expect(explanation).toEqual({ score: 0, matchedTerms: [], sourceKind: 'manual' });
  });

  it('includes the active minimum score gate when provided', () => {
    const explanation = explainRecallMatch(
      {
        title: 'dispatch retrieval',
        body: 'Use dispatch output anchors.',
      },
      { query: 'dispatch output anchors', minScore: 2 },
    );

    expect(explanation).toEqual({
      score: 3,
      matchedTerms: ['dispatch', 'output', 'anchors'],
      sourceKind: 'manual',
      minScore: 2,
    });
  });

  it('reports stored provenance when available', () => {
    const explanation = explainRecallMatch(
      {
        title: 'task-derived retro',
        body: 'Use source task provenance in recall audits.',
        sourceKind: 'task',
        sourceRef: '/tmp/TASK.md',
      },
      { query: 'source task provenance' },
    );

    expect(explanation).toEqual({
      score: 3,
      matchedTerms: ['source', 'task', 'provenance'],
      sourceKind: 'task',
      sourceRef: '/tmp/TASK.md',
    });
  });
});
