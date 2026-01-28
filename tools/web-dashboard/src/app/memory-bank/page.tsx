'use client';

import * as React from 'react';
import { MemoryBankTree, mockMemoryBankData } from '@/components/memory-bank/memory-bank-tree';
import { ContextEditor, sampleContextContent } from '@/components/memory-bank/context-editor';
import type { MemoryBankNode } from '@/types';

export default function MemoryBankPage() {
  const [selectedNode, setSelectedNode] = React.useState<MemoryBankNode | null>(null);

  const handleSelect = (node: MemoryBankNode) => {
    setSelectedNode(node);
  };

  const handleSave = (content: string) => {
    console.log('Saving content:', content);
    // In a real app, this would save to the API
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memory Bank</h1>
        <p className="text-muted-foreground">
          Browse and manage your team's shared context, modules, and documentation.
        </p>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
        {/* Tree View */}
        <div className="col-span-4 lg:col-span-3 border rounded-lg overflow-hidden">
          <div className="border-b px-4 py-3 bg-muted/30">
            <h2 className="font-semibold text-sm">Explorer</h2>
          </div>
          <MemoryBankTree
            data={mockMemoryBankData}
            selectedPath={selectedNode?.path}
            onSelect={handleSelect}
            className="h-[calc(100%-49px)]"
          />
        </div>

        {/* Content Editor */}
        <div className="col-span-8 lg:col-span-9 border rounded-lg overflow-hidden">
          {selectedNode ? (
            <ContextEditor
              content={sampleContextContent}
              title={selectedNode.name}
              path={selectedNode.path}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg font-medium">No file selected</p>
              <p className="text-sm">Select a file from the tree to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
