import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { createOctokit, getRepositoryContent, getFileContent } from '@/lib/github';
import type { KnowledgeEntry, KnowledgeCategory } from '@/types';

interface SessionWithToken {
  accessToken?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/**
 * Determine category from path
 */
function getCategoryFromPath(path: string): KnowledgeCategory {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes('pattern')) return 'pattern';
  if (lowerPath.includes('best-practice')) return 'best-practice';
  if (lowerPath.includes('troubleshoot')) return 'troubleshooting';
  if (lowerPath.includes('tutorial')) return 'tutorial';
  if (lowerPath.includes('reference')) return 'reference';
  if (lowerPath.includes('faq')) return 'faq';
  return 'other';
}

/**
 * Parse knowledge entry from markdown
 */
function parseKnowledgeContent(
  filename: string,
  path: string,
  content: string
): Partial<KnowledgeEntry> {
  const lines = content.split('\n');
  let title = filename.replace('.md', '').replace(/-/g, ' ');
  let author = 'Unknown';
  let createdAt = new Date().toISOString().split('T')[0];
  let updatedAt = createdAt;
  const tags: string[] = [];
  let bodyContent = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Parse title from H1
    if (trimmedLine.startsWith('# ')) {
      title = trimmedLine.replace('# ', '');
      continue;
    }

    // Parse metadata
    if (trimmedLine.toLowerCase().includes('**author**:')) {
      const match = trimmedLine.match(/\*\*author\*\*:\s*(.+)/i);
      if (match) author = match[1];
      continue;
    }
    if (trimmedLine.toLowerCase().includes('**created**:')) {
      const match = trimmedLine.match(/\*\*created\*\*:\s*([\d-]+)/i);
      if (match) createdAt = match[1];
      continue;
    }
    if (trimmedLine.toLowerCase().includes('**updated**:')) {
      const match = trimmedLine.match(/\*\*updated\*\*:\s*([\d-]+)/i);
      if (match) updatedAt = match[1];
      continue;
    }
    if (trimmedLine.toLowerCase().startsWith('**tags**:')) {
      const match = trimmedLine.match(/\*\*tags\*\*:\s*(.+)/i);
      if (match) {
        tags.push(...match[1].split(',').map((t) => t.trim()));
      }
      continue;
    }

    // Collect body content
    if (!trimmedLine.startsWith('**') && !trimmedLine.startsWith('---')) {
      bodyContent += (bodyContent ? '\n' : '') + trimmedLine;
    }
  }

  return {
    title,
    category: getCategoryFromPath(path),
    content: bodyContent.trim(),
    author,
    createdAt,
    updatedAt,
    tags,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as SessionWithToken;

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const category = searchParams.get('category');
    const id = searchParams.get('id');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
    }

    const octokit = createOctokit(session.accessToken);
    const knowledgePath = '.memory-bank/knowledge';

    // Recursively get all knowledge entries
    async function getKnowledgeEntries(path: string): Promise<KnowledgeEntry[]> {
      const entries: KnowledgeEntry[] = [];
      const files = await getRepositoryContent(octokit, owner!, repo!, path);

      for (const file of files) {
        if (file.type === 'folder') {
          const subEntries = await getKnowledgeEntries(file.path);
          entries.push(...subEntries);
        } else if (file.type === 'file' && file.name.endsWith('.md')) {
          const content = await getFileContent(octokit, owner!, repo!, file.path);
          if (content) {
            const parsed = parseKnowledgeContent(file.name, file.path, content);
            entries.push({
              id: file.id,
              title: parsed.title || file.name,
              category: parsed.category || 'other',
              content: parsed.content || '',
              tags: parsed.tags || [],
              author: parsed.author || 'Unknown',
              createdAt: parsed.createdAt || new Date().toISOString(),
              updatedAt: parsed.updatedAt || new Date().toISOString(),
            });
          }
        }
      }

      return entries;
    }

    // If id is provided, get single entry
    if (id) {
      // For simplicity, we search through all entries
      const allEntries = await getKnowledgeEntries(knowledgePath);
      const entry = allEntries.find((e) => e.id === id);
      if (!entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      return NextResponse.json({ entry });
    }

    // Get all entries
    let entries = await getKnowledgeEntries(knowledgePath);

    // Filter by category if provided
    if (category) {
      entries = entries.filter((e) => e.category === category);
    }

    // Sort by updatedAt (newest first)
    entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Knowledge API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
