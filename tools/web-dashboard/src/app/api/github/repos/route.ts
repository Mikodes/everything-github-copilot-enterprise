import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createOctokit, getUserRepositories, checkMemoryBankExists } from '@/lib/github';

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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '30', 10);
    const withMemoryBank = searchParams.get('with_memory_bank') === 'true';

    const octokit = createOctokit(session.accessToken);

    let repos = await getUserRepositories(octokit, {
      per_page: perPage,
      page,
    });

    // If requested, filter to only repos with memory bank
    if (withMemoryBank) {
      const reposWithMemoryBank = await Promise.all(
        repos.map(async (repo) => {
          const hasMemoryBank = await checkMemoryBankExists(
            octokit,
            repo.owner.login,
            repo.name
          );
          return hasMemoryBank ? repo : null;
        })
      );
      repos = reposWithMemoryBank.filter((r) => r !== null) as typeof repos;
    }

    return NextResponse.json({
      repositories: repos,
      page,
      perPage,
      hasMore: repos.length === perPage,
    });
  } catch (error) {
    console.error('GitHub repos API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
