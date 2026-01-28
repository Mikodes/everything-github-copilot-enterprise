'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Edit2, Eye, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContextEditorProps {
  content: string;
  title?: string;
  path?: string;
  readOnly?: boolean;
  onSave?: (content: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function ContextEditor({
  content: initialContent,
  title,
  path,
  readOnly = false,
  onSave,
  onCancel,
  className,
}: ContextEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [isEditing, setIsEditing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'preview' | 'edit'>('preview');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setContent(initialContent);
    setIsEditing(false);
    setActiveTab('preview');
  }, [initialContent]);

  const handleEdit = () => {
    setIsEditing(true);
    setActiveTab('edit');
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleSave = () => {
    onSave?.(content);
    setIsEditing(false);
    setActiveTab('preview');
  };

  const handleCancel = () => {
    setContent(initialContent);
    setIsEditing(false);
    setActiveTab('preview');
    onCancel?.();
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          {title && <h2 className="font-semibold">{title}</h2>}
          {path && <p className="text-xs text-muted-foreground">{path}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')} className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-10">
              <TabsTrigger value="edit" className="gap-2">
                <Edit2 className="h-4 w-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="edit" className="flex-1 mt-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full p-4 resize-none bg-background font-mono text-sm focus:outline-none"
              placeholder="Write your markdown content here..."
            />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Sample content for demonstration
export const sampleContextContent = `# Project Context

## Overview

This is a microservices-based e-commerce platform built with modern cloud-native technologies.

## Tech Stack

- **Backend**: Java 21 + Spring Boot 3.2
- **Frontend**: Next.js 14 + React
- **Database**: PostgreSQL 16 + Redis
- **Message Queue**: Apache Kafka
- **Container Orchestration**: Kubernetes

## Architecture

The system follows a domain-driven design approach with the following bounded contexts:

1. **User Management** - Authentication, authorization, and user profiles
2. **Product Catalog** - Product information, categories, and search
3. **Order Management** - Order processing and fulfillment
4. **Payment Processing** - Payment gateway integration
5. **Notification Service** - Email, SMS, and push notifications

## Key Patterns

- **CQRS** for read/write separation
- **Event Sourcing** for order management
- **Circuit Breaker** for resilience
- **API Gateway** for routing and security

## Team Structure

| Role | Name | Expertise |
|------|------|-----------|
| Tech Lead | Sarah Chen | Architecture, Java |
| Senior Dev | Mike Rodriguez | Spring Boot, Kafka |
| Senior Dev | Emily Wang | React, TypeScript |
| DevOps | John Doe | Kubernetes, AWS |

## Important Links

- [Architecture Diagram](./diagrams/architecture.png)
- [API Documentation](https://api-docs.example.com)
- [Runbook](./runbooks/main.md)
`;
