'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Clock, XCircle, Archive, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DecisionRecord, ADRStatus } from '@/types';

interface ADRTimelineProps {
  decisions: DecisionRecord[];
  onSelect?: (decision: DecisionRecord) => void;
  selectedId?: string;
  className?: string;
}

function getStatusIcon(status: ADRStatus) {
  switch (status) {
    case 'accepted':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'proposed':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'deprecated':
      return <Archive className="h-5 w-5 text-gray-500" />;
    case 'superseded':
      return <ArrowRight className="h-5 w-5 text-blue-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStatusBadgeVariant(status: ADRStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'proposed':
      return 'secondary';
    case 'rejected':
    case 'deprecated':
      return 'destructive';
    default:
      return 'outline';
  }
}

interface TimelineItemProps {
  decision: DecisionRecord;
  isSelected?: boolean;
  onClick?: () => void;
  isLast?: boolean;
}

function TimelineItem({ decision, isSelected, onClick, isLast }: TimelineItemProps) {
  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      {!isLast && <div className="absolute left-[11px] top-8 h-full w-px bg-border" />}

      {/* Status icon */}
      <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-border">
        {getStatusIcon(decision.status)}
      </div>

      {/* Content */}
      <Card
        className={cn(
          'cursor-pointer transition-colors hover:bg-accent/50',
          isSelected && 'border-primary bg-accent/50'
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{decision.id}</CardTitle>
              <p className="text-sm font-medium mt-1">{decision.title}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(decision.status)}>
              {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">{decision.context}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>By {decision.author}</span>
            <span>{format(new Date(decision.date), 'MMM d, yyyy')}</span>
          </div>
          {decision.tags && decision.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {decision.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ADRTimeline({ decisions, onSelect, selectedId, className }: ADRTimelineProps) {
  // Sort decisions by date (newest first)
  const sortedDecisions = [...decisions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-4 p-4">
        {sortedDecisions.map((decision, index) => (
          <TimelineItem
            key={decision.id}
            decision={decision}
            isSelected={selectedId === decision.id}
            onClick={() => onSelect?.(decision)}
            isLast={index === sortedDecisions.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// Mock data for demonstration
export const mockDecisions: DecisionRecord[] = [
  {
    id: 'ADR-024',
    title: 'Migrate to Event-Driven Architecture',
    status: 'accepted',
    context: 'Our current synchronous communication pattern between microservices is causing scalability issues and tight coupling.',
    decision: 'We will adopt an event-driven architecture using Apache Kafka as our message broker.',
    consequences: [
      'Improved scalability and resilience',
      'Eventual consistency model',
      'Need to implement idempotency',
    ],
    author: 'Sarah Chen',
    date: '2024-01-15',
    tags: ['architecture', 'kafka', 'microservices'],
  },
  {
    id: 'ADR-023',
    title: 'Use PostgreSQL for Main Database',
    status: 'accepted',
    context: 'We need to choose a primary database for our new e-commerce platform.',
    decision: 'PostgreSQL 16 will be our primary relational database.',
    consequences: [
      'ACID compliance for transactions',
      'Strong JSON support',
      'Requires database expertise',
    ],
    author: 'Mike Rodriguez',
    date: '2024-01-10',
    tags: ['database', 'postgresql'],
  },
  {
    id: 'ADR-022',
    title: 'Implement CQRS Pattern',
    status: 'proposed',
    context: 'Read and write operations have different performance requirements.',
    decision: 'Implement Command Query Responsibility Segregation for order management.',
    consequences: [
      'Better read/write optimization',
      'Increased complexity',
      'Eventual consistency considerations',
    ],
    author: 'Emily Wang',
    date: '2024-01-08',
    tags: ['pattern', 'cqrs', 'architecture'],
  },
  {
    id: 'ADR-021',
    title: 'Adopt Kubernetes for Orchestration',
    status: 'accepted',
    context: 'We need a robust container orchestration platform for our microservices.',
    decision: 'Use Kubernetes (EKS) for container orchestration.',
    consequences: [
      'Auto-scaling capabilities',
      'Self-healing infrastructure',
      'Learning curve for team',
    ],
    author: 'John Doe',
    date: '2024-01-05',
    tags: ['infrastructure', 'kubernetes', 'devops'],
  },
  {
    id: 'ADR-020',
    title: 'Use MongoDB for Session Store',
    status: 'deprecated',
    context: 'We initially chose MongoDB for session storage.',
    decision: 'Replaced with Redis for better performance.',
    consequences: [
      'Faster session lookups',
      'Simpler data model',
    ],
    author: 'Sarah Chen',
    date: '2024-01-02',
    tags: ['database', 'session', 'deprecated'],
  },
];
