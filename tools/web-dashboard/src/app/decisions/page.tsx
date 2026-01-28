'use client';

import * as React from 'react';
import { Plus, Filter } from 'lucide-react';
import { ADRTimeline, mockDecisions } from '@/components/decisions/adr-timeline';
import { ContextEditor } from '@/components/memory-bank/context-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DecisionRecord } from '@/types';

function generateADRContent(decision: DecisionRecord): string {
  return `# ${decision.id}: ${decision.title}

**Status**: ${decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
**Date**: ${decision.date}
**Author**: ${decision.author}

## Context

${decision.context}

## Decision

${decision.decision}

## Consequences

${decision.consequences.map((c) => `- ${c}`).join('\n')}

${
  decision.alternatives && decision.alternatives.length > 0
    ? `## Alternatives Considered

${decision.alternatives
  .map(
    (alt) => `### ${alt.title}

${alt.description}

**Pros:**
${alt.pros.map((p) => `- ${p}`).join('\n')}

**Cons:**
${alt.cons.map((c) => `- ${c}`).join('\n')}`
  )
  .join('\n\n')}`
    : ''
}

${decision.relatedDecisions && decision.relatedDecisions.length > 0 ? `## Related Decisions

${decision.relatedDecisions.map((r) => `- ${r}`).join('\n')}` : ''}

---
*Tags: ${decision.tags?.join(', ') || 'none'}*
`;
}

export default function DecisionsPage() {
  const [selectedDecision, setSelectedDecision] = React.useState<DecisionRecord | null>(null);

  const handleSelect = (decision: DecisionRecord) => {
    setSelectedDecision(decision);
  };

  const handleSave = (content: string) => {
    console.log('Saving decision:', content);
    // In a real app, this would save to the API
  };

  // Stats
  const stats = {
    total: mockDecisions.length,
    accepted: mockDecisions.filter((d) => d.status === 'accepted').length,
    proposed: mockDecisions.filter((d) => d.status === 'proposed').length,
    deprecated: mockDecisions.filter((d) => d.status === 'deprecated' || d.status === 'superseded')
      .length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Architecture Decisions</h1>
          <p className="text-muted-foreground">
            Track and manage Architecture Decision Records (ADRs) for your project.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Decision
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-sm px-3 py-1">
          Total: {stats.total}
        </Badge>
        <Badge variant="default" className="text-sm px-3 py-1">
          Accepted: {stats.accepted}
        </Badge>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          Proposed: {stats.proposed}
        </Badge>
        <Badge variant="destructive" className="text-sm px-3 py-1">
          Deprecated: {stats.deprecated}
        </Badge>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-280px)]">
        {/* Timeline */}
        <div className="col-span-5 lg:col-span-4 border rounded-lg overflow-hidden">
          <div className="border-b px-4 py-3 bg-muted/30 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Timeline</h2>
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <ADRTimeline
            decisions={mockDecisions}
            selectedId={selectedDecision?.id}
            onSelect={handleSelect}
            className="h-[calc(100%-49px)]"
          />
        </div>

        {/* Decision Detail */}
        <div className="col-span-7 lg:col-span-8 border rounded-lg overflow-hidden">
          {selectedDecision ? (
            <ContextEditor
              content={generateADRContent(selectedDecision)}
              title={`${selectedDecision.id}: ${selectedDecision.title}`}
              path={`/.memory-bank/decisions/${selectedDecision.id}.md`}
              onSave={handleSave}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg
                className="h-16 w-16 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-lg font-medium">No decision selected</p>
              <p className="text-sm">Select a decision from the timeline to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
