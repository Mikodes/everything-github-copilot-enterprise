'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Database,
  GitBranch,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MemoryBankNode } from '@/types';

interface MemoryBankTreeProps {
  data: MemoryBankNode[];
  selectedPath?: string;
  onSelect?: (node: MemoryBankNode) => void;
  className?: string;
}

function getFileIcon(node: MemoryBankNode) {
  if (node.type === 'folder') {
    return null;
  }

  const fileType = node.metadata?.fileType;
  switch (fileType) {
    case 'context':
      return <Database className="h-4 w-4 text-purple-500" />;
    case 'decision':
      return <GitBranch className="h-4 w-4 text-green-500" />;
    case 'knowledge':
      return <BookOpen className="h-4 w-4 text-blue-500" />;
    case 'schema':
      return <FileCode className="h-4 w-4 text-orange-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

interface TreeNodeProps {
  node: MemoryBankNode;
  level: number;
  selectedPath?: string;
  onSelect?: (node: MemoryBankNode) => void;
}

function TreeNode({ node, level, selectedPath, onSelect }: TreeNodeProps) {
  const [isOpen, setIsOpen] = React.useState(level < 2);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  const handleClick = () => {
    if (node.type === 'file') {
      onSelect?.(node);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            onClick={handleToggle}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )
            ) : (
              <span className="w-4" />
            )}
            {isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'bg-accent'
      )}
      style={{ paddingLeft: `${level * 12 + 8 + 16}px` }}
    >
      {getFileIcon(node)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function MemoryBankTree({ data, selectedPath, onSelect, className }: MemoryBankTreeProps) {
  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-2">
        {data.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// Mock data for demonstration
export const mockMemoryBankData: MemoryBankNode[] = [
  {
    id: '1',
    name: '.memory-bank',
    type: 'folder',
    path: '/.memory-bank',
    children: [
      {
        id: '2',
        name: 'contexts',
        type: 'folder',
        path: '/.memory-bank/contexts',
        children: [
          {
            id: '3',
            name: 'project-context.md',
            type: 'file',
            path: '/.memory-bank/contexts/project-context.md',
            metadata: { fileType: 'context', lastModified: '2024-01-15' },
          },
          {
            id: '4',
            name: 'team-context.md',
            type: 'file',
            path: '/.memory-bank/contexts/team-context.md',
            metadata: { fileType: 'context', lastModified: '2024-01-14' },
          },
        ],
      },
      {
        id: '5',
        name: 'modules',
        type: 'folder',
        path: '/.memory-bank/modules',
        children: [
          {
            id: '6',
            name: 'api-gateway',
            type: 'folder',
            path: '/.memory-bank/modules/api-gateway',
            children: [
              {
                id: '7',
                name: 'context.md',
                type: 'file',
                path: '/.memory-bank/modules/api-gateway/context.md',
                metadata: { fileType: 'context', lastModified: '2024-01-12' },
              },
            ],
          },
          {
            id: '8',
            name: 'payment-service',
            type: 'folder',
            path: '/.memory-bank/modules/payment-service',
            children: [
              {
                id: '9',
                name: 'context.md',
                type: 'file',
                path: '/.memory-bank/modules/payment-service/context.md',
                metadata: { fileType: 'context', lastModified: '2024-01-10' },
              },
            ],
          },
        ],
      },
      {
        id: '10',
        name: 'decisions',
        type: 'folder',
        path: '/.memory-bank/decisions',
        children: [
          {
            id: '11',
            name: 'ADR-001-use-microservices.md',
            type: 'file',
            path: '/.memory-bank/decisions/ADR-001-use-microservices.md',
            metadata: { fileType: 'decision', lastModified: '2024-01-05' },
          },
          {
            id: '12',
            name: 'ADR-002-postgresql-database.md',
            type: 'file',
            path: '/.memory-bank/decisions/ADR-002-postgresql-database.md',
            metadata: { fileType: 'decision', lastModified: '2024-01-08' },
          },
        ],
      },
      {
        id: '13',
        name: 'knowledge',
        type: 'folder',
        path: '/.memory-bank/knowledge',
        children: [
          {
            id: '14',
            name: 'patterns',
            type: 'folder',
            path: '/.memory-bank/knowledge/patterns',
            children: [
              {
                id: '15',
                name: 'circuit-breaker.md',
                type: 'file',
                path: '/.memory-bank/knowledge/patterns/circuit-breaker.md',
                metadata: { fileType: 'knowledge', lastModified: '2024-01-11' },
              },
            ],
          },
          {
            id: '16',
            name: 'troubleshooting',
            type: 'folder',
            path: '/.memory-bank/knowledge/troubleshooting',
            children: [
              {
                id: '17',
                name: 'database-connection-issues.md',
                type: 'file',
                path: '/.memory-bank/knowledge/troubleshooting/database-connection-issues.md',
                metadata: { fileType: 'knowledge', lastModified: '2024-01-09' },
              },
            ],
          },
        ],
      },
    ],
  },
];
