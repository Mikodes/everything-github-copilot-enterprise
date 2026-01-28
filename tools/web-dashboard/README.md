# EGCE Web Dashboard

Web Dashboard for **Everything GitHub Copilot Enterprise** - Visualize and manage your team's Memory Bank, Architecture Decision Records (ADRs), and Knowledge Base.

## Features

- **Memory Bank Explorer**: Navigate and edit your team's shared context files
- **ADR Timeline**: Visual timeline of Architecture Decision Records with status tracking
- **Knowledge Base**: Searchable repository of patterns, best practices, and troubleshooting guides
- **Team Activity**: Real-time feed of team contributions and updates
- **GitHub Integration**: Direct sync with your GitHub repositories
- **Dark Mode**: Full support for light and dark themes

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js with GitHub OAuth
- **API**: GitHub REST API via Octokit
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn
- GitHub OAuth App (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/everything-github-copilot-enterprise.git
   cd everything-github-copilot-enterprise/tools/web-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

   Update the variables:
   - `GITHUB_ID`: Your GitHub OAuth App Client ID
   - `GITHUB_SECRET`: Your GitHub OAuth App Client Secret
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for development)

4. **Create a GitHub OAuth App**

   Go to [GitHub Developer Settings](https://github.com/settings/developers) and create a new OAuth App:
   - **Application name**: EGCE Dashboard
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:3000/api/auth/callback/github

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth.js authentication
│   │   ├── decisions/     # ADR endpoints
│   │   ├── knowledge/     # Knowledge base endpoints
│   │   ├── memory-bank/   # Memory Bank endpoints
│   │   └── github/        # GitHub API endpoints
│   ├── decisions/         # ADR page
│   ├── knowledge/         # Knowledge base page
│   ├── memory-bank/       # Memory Bank explorer page
│   ├── settings/          # Settings page
│   ├── team/              # Team activity page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Dashboard home
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components (Sidebar, Navbar)
│   ├── memory-bank/       # Memory Bank components
│   ├── decisions/         # ADR components
│   ├── knowledge/         # Knowledge base components
│   └── team/              # Team components
├── lib/                   # Utility functions
│   ├── github.ts          # GitHub API client
│   └── utils.ts           # General utilities
└── types/                 # TypeScript types
    └── index.ts           # Type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Set these in your Vercel project settings:
- `GITHUB_ID`
- `GITHUB_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your production URL)

## API Endpoints

### Authentication
- `GET /api/auth/[...nextauth]` - NextAuth.js authentication

### Memory Bank
- `GET /api/memory-bank?owner=<owner>&repo=<repo>` - Get Memory Bank tree
- `GET /api/memory-bank?owner=<owner>&repo=<repo>&path=<path>` - Get file content

### Decisions (ADRs)
- `GET /api/decisions?owner=<owner>&repo=<repo>` - List all ADRs
- `GET /api/decisions?owner=<owner>&repo=<repo>&id=<id>` - Get single ADR

### Knowledge Base
- `GET /api/knowledge?owner=<owner>&repo=<repo>` - List all entries
- `GET /api/knowledge?owner=<owner>&repo=<repo>&category=<category>` - Filter by category

### GitHub
- `GET /api/github/repos` - List user repositories
- `GET /api/github/repos?with_memory_bank=true` - Repos with Memory Bank

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
