import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { createOctokit, getRepositoryContent, getFileContent } from '@/lib/github';
import type { DecisionRecord, ADRStatus } from '@/types';

interface SessionWithToken {
  accessToken?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/**
 * Parse ADR content from markdown
 */
function parseADRContent(filename: string, content: string): Partial<DecisionRecord> {
  const lines = content.split('\n');
  let title = filename.replace('.md', '');
  let status: ADRStatus = 'proposed';
  let context = '';
  let decision = '';
  const consequences: string[] = [];
  let author = 'Unknown';
  let date = new Date().toISOString().split('T')[0];
  const tags: string[] = [];

  let currentSection = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Parse title from H1
    if (trimmedLine.startsWith('# ')) {
      const titleMatch = trimmedLine.match(/^#\s+(?:ADR-?\d+:?\s*)?(.+)/i);
      if (titleMatch) {
        title = titleMatch[1];
      }
    }

    // Parse status
    if (trimmedLine.toLowerCase().includes('**status**:')) {
      const statusMatch = trimmedLine.match(/\*\*status\*\*:\s*(\w+)/i);
      if (statusMatch) {
        status = statusMatch[1].toLowerCase() as ADRStatus;
      }
    }

    // Parse date
    if (trimmedLine.toLowerCase().includes('**date**:')) {
      const dateMatch = trimmedLine.match(/\*\*date\*\*:\s*([\d-]+)/i);
      if (dateMatch) {
        date = dateMatch[1];
      }
    }

    // Parse author
    if (trimmedLine.toLowerCase().includes('**author**:')) {
      const authorMatch = trimmedLine.match(/\*\*author\*\*:\s*(.+)/i);
      if (authorMatch) {
        author = authorMatch[1];
      }
    }

    // Track sections
    if (trimmedLine.startsWith('## ')) {
      currentSection = trimmedLine.replace('## ', '').toLowerCase();
      continue;
    }

    // Collect content based on section
    if (currentSection === 'context' && trimmedLine) {
      context += (context ? ' ' : '') + trimmedLine;
    }
    if (currentSection === 'decision' && trimmedLine) {
      decision += (decision ? ' ' : '') + trimmedLine;
    }
    if (currentSection === 'consequences' && trimmedLine.startsWith('- ')) {
      consequences.push(trimmedLine.replace('- ', ''));
    }

    // Parse tags
    if (trimmedLine.toLowerCase().startsWith('*tags:')) {
      const tagsMatch = trimmedLine.match(/\*tags:\s*(.+)\*/i);
      if (tagsMatch) {
        tags.push(...tagsMatch[1].split(',').map((t) => t.trim()));
      }
    }
  }

  return {
    title,
    status,
    context,
    decision,
    consequences,
    author,
    date,
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
    const id = searchParams.get('id');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
    }

    const octokit = createOctokit(session.accessToken);
    const decisionsPath = '.memory-bank/decisions';

    // If id is provided, get single decision
    if (id) {
      const content = await getFileContent(octokit, owner, repo, `${decisionsPath}/${id}.md`);
      if (content === null) {
        return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
      }
      const parsed = parseADRContent(id, content);
      return NextResponse.json({ decision: { id, ...parsed, rawContent: content } });
    }

    // Get all decisions
    const files = await getRepositoryContent(octokit, owner, repo, decisionsPath);
    const decisions: DecisionRecord[] = [];

    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.md')) {
        const content = await getFileContent(octokit, owner, repo, file.path);
        if (content) {
          const id = file.name.replace('.md', '');
          const parsed = parseADRContent(file.name, content);
          decisions.push({
            id,
            title: parsed.title || id,
            status: parsed.status || 'proposed',
            context: parsed.context || '',
            decision: parsed.decision || '',
            consequences: parsed.consequences || [],
            author: parsed.author || 'Unknown',
            date: parsed.date || new Date().toISOString().split('T')[0],
            tags: parsed.tags,
          });
        }
      }
    }

    // Sort by date (newest first)
    decisions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ decisions });
  } catch (error) {
    console.error('Decisions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
