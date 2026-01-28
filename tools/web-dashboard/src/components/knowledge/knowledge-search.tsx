'use client';

import * as React from 'react';
import { Search, BookOpen, FileText, Lightbulb, HelpCircle, AlertTriangle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { KnowledgeEntry, KnowledgeCategory } from '@/types';
import { formatRelativeDate } from '@/lib/utils';

interface KnowledgeSearchProps {
  entries: KnowledgeEntry[];
  onSelect?: (entry: KnowledgeEntry) => void;
  selectedId?: string;
  className?: string;
}

const categoryIcons: Record<KnowledgeCategory, React.ComponentType<{ className?: string }>> = {
  pattern: Lightbulb,
  'best-practice': FileText,
  troubleshooting: AlertTriangle,
  tutorial: BookOpen,
  reference: FileText,
  faq: HelpCircle,
  other: FileText,
};

const categoryLabels: Record<KnowledgeCategory, string> = {
  pattern: 'Pattern',
  'best-practice': 'Best Practice',
  troubleshooting: 'Troubleshooting',
  tutorial: 'Tutorial',
  reference: 'Reference',
  faq: 'FAQ',
  other: 'Other',
};

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  isSelected?: boolean;
  onClick?: () => void;
}

function KnowledgeCard({ entry, isSelected, onClick }: KnowledgeCardProps) {
  const Icon = categoryIcons[entry.category] || FileText;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'border-primary bg-accent/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{entry.title}</CardTitle>
            <CardDescription className="mt-1">
              {categoryLabels[entry.category]}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {entry.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{entry.tags.length - 3}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(entry.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KnowledgeSearch({ entries, onSelect, selectedId, className }: KnowledgeSearchProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');

  const filteredEntries = React.useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [entries, searchQuery, categoryFilter]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search and filters */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No entries found</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <KnowledgeCard
                key={entry.id}
                entry={entry}
                isSelected={selectedId === entry.id}
                onClick={() => onSelect?.(entry)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Mock data for demonstration
export const mockKnowledgeEntries: KnowledgeEntry[] = [
  {
    id: '1',
    title: 'Circuit Breaker Pattern',
    category: 'pattern',
    content: 'The Circuit Breaker pattern prevents an application from repeatedly trying to execute an operation that is likely to fail. When a threshold of failures is reached, the circuit "opens" and further calls fail immediately without attempting the operation.',
    tags: ['resilience', 'microservices', 'fault-tolerance'],
    author: 'Sarah Chen',
    createdAt: '2024-01-11',
    updatedAt: '2024-01-11',
  },
  {
    id: '2',
    title: 'Database Connection Pool Configuration',
    category: 'best-practice',
    content: 'Proper connection pool sizing is crucial for application performance. A pool size of (2 * CPU cores) + effective_spindle_count is a good starting point for PostgreSQL.',
    tags: ['database', 'postgresql', 'performance'],
    author: 'Mike Rodriguez',
    createdAt: '2024-01-09',
    updatedAt: '2024-01-12',
  },
  {
    id: '3',
    title: 'Resolving Kafka Consumer Lag',
    category: 'troubleshooting',
    content: 'When experiencing consumer lag in Kafka: 1) Check consumer group health, 2) Increase partition count, 3) Scale up consumers, 4) Optimize message processing, 5) Check for network issues.',
    tags: ['kafka', 'troubleshooting', 'performance'],
    author: 'John Doe',
    createdAt: '2024-01-08',
    updatedAt: '2024-01-08',
  },
  {
    id: '4',
    title: 'Spring Boot 4 Migration Guide',
    category: 'tutorial',
    content: 'Step-by-step guide for migrating from Spring Boot 3 to Spring Boot 4: 1) Update Java version to 21+, 2) Update dependencies, 3) Review deprecated APIs, 4) Test thoroughly.',
    tags: ['spring-boot', 'migration', 'java'],
    author: 'Emily Wang',
    createdAt: '2024-01-05',
    updatedAt: '2024-01-14',
  },
  {
    id: '5',
    title: 'API Versioning Strategies',
    category: 'reference',
    content: 'Common API versioning strategies: URL path versioning (/v1/resource), Query parameter versioning (?version=1), Header versioning (Accept-Version: v1), Media type versioning.',
    tags: ['api', 'versioning', 'rest'],
    author: 'Sarah Chen',
    createdAt: '2024-01-03',
    updatedAt: '2024-01-03',
  },
  {
    id: '6',
    title: 'How do I set up local development?',
    category: 'faq',
    content: 'To set up local development: 1) Clone the repository, 2) Install Docker and Docker Compose, 3) Run `docker-compose up -d`, 4) Run `npm install`, 5) Run `npm run dev`.',
    tags: ['setup', 'development', 'docker'],
    author: 'John Doe',
    createdAt: '2024-01-02',
    updatedAt: '2024-01-10',
  },
];
