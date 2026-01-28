'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { KnowledgeSearch, mockKnowledgeEntries } from '@/components/knowledge/knowledge-search';
import { ContextEditor } from '@/components/memory-bank/context-editor';
import { Button } from '@/components/ui/button';
import type { KnowledgeEntry } from '@/types';

function generateKnowledgeContent(entry: KnowledgeEntry): string {
  return `# ${entry.title}

**Category**: ${entry.category.charAt(0).toUpperCase() + entry.category.slice(1).replace('-', ' ')}
**Author**: ${entry.author}
**Created**: ${entry.createdAt}
**Updated**: ${entry.updatedAt}

---

${entry.content}

---

**Tags**: ${entry.tags.join(', ')}
`;
}

export default function KnowledgePage() {
  const [selectedEntry, setSelectedEntry] = React.useState<KnowledgeEntry | null>(null);

  const handleSelect = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
  };

  const handleSave = (content: string) => {
    console.log('Saving knowledge entry:', content);
    // In a real app, this would save to the API
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Search and manage your team's documented knowledge, patterns, and best practices.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-220px)]">
        {/* Search and List */}
        <div className="col-span-5 lg:col-span-4 border rounded-lg overflow-hidden">
          <KnowledgeSearch
            entries={mockKnowledgeEntries}
            selectedId={selectedEntry?.id}
            onSelect={handleSelect}
            className="h-full"
          />
        </div>

        {/* Entry Detail */}
        <div className="col-span-7 lg:col-span-8 border rounded-lg overflow-hidden">
          {selectedEntry ? (
            <ContextEditor
              content={generateKnowledgeContent(selectedEntry)}
              title={selectedEntry.title}
              path={`/.memory-bank/knowledge/${selectedEntry.category}/${selectedEntry.id}.md`}
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="text-lg font-medium">No entry selected</p>
              <p className="text-sm">Search and select an entry to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
