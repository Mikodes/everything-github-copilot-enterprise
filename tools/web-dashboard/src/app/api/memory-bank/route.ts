import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { createOctokit, getMemoryBankTree, getFileContent } from '@/lib/github';

interface SessionWithToken {
  accessToken?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
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
    const path = searchParams.get('path');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
    }

    const octokit = createOctokit(session.accessToken);

    // If path is provided, get file content
    if (path) {
      const content = await getFileContent(octokit, owner, repo, path);
      if (content === null) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json({ content });
    }

    // Otherwise, get memory bank tree
    const tree = await getMemoryBankTree(octokit, owner, repo);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Memory Bank API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
