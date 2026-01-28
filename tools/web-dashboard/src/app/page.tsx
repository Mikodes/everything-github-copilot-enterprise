import { Suspense } from 'react';
import {
  Brain,
  GitBranch,
  BookOpen,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock data for the dashboard
const stats = {
  totalDecisions: 24,
  acceptedDecisions: 18,
  pendingDecisions: 4,
  deprecatedDecisions: 2,
  totalKnowledge: 156,
  teamMembers: 12,
  modules: 8,
};

const recentActivity = [
  {
    id: '1',
    type: 'decision_accepted',
    title: 'ADR-024: Migrate to Event-Driven Architecture',
    user: 'Sarah Chen',
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    type: 'knowledge_added',
    title: 'Spring Boot 4 Migration Guide',
    user: 'Mike Rodriguez',
    timestamp: '5 hours ago',
  },
  {
    id: '3',
    type: 'context_updated',
    title: 'Updated payment-service module context',
    user: 'John Doe',
    timestamp: '1 day ago',
  },
  {
    id: '4',
    type: 'decision_proposed',
    title: 'ADR-025: GraphQL API Gateway',
    user: 'Emily Wang',
    timestamp: '2 days ago',
  },
  {
    id: '5',
    type: 'member_joined',
    title: 'Alex Thompson joined the team',
    user: 'System',
    timestamp: '3 days ago',
  },
];

const recentDecisions = [
  {
    id: 'ADR-024',
    title: 'Migrate to Event-Driven Architecture',
    status: 'accepted',
    date: '2024-01-15',
  },
  {
    id: 'ADR-023',
    title: 'Use PostgreSQL for main database',
    status: 'accepted',
    date: '2024-01-10',
  },
  {
    id: 'ADR-022',
    title: 'Implement CQRS pattern',
    status: 'proposed',
    date: '2024-01-08',
  },
  {
    id: 'ADR-021',
    title: 'Adopt Kubernetes for orchestration',
    status: 'accepted',
    date: '2024-01-05',
  },
];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp
              className={`h-3 w-3 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}
            />
            <span
              className={`text-xs ml-1 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}
            >
              {trend.positive ? '+' : '-'}
              {trend.value}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  type,
  title,
  user,
  timestamp,
}: {
  type: string;
  title: string;
  user: string;
  timestamp: string;
}) {
  const getIcon = () => {
    switch (type) {
      case 'decision_accepted':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'decision_proposed':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'knowledge_added':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'context_updated':
        return <Brain className="h-4 w-4 text-purple-500" />;
      case 'member_joined':
        return <Users className="h-4 w-4 text-cyan-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {user} &middot; {timestamp}
        </p>
      </div>
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'accepted':
      return <Badge variant="success">Accepted</Badge>;
    case 'proposed':
      return <Badge variant="warning">Proposed</Badge>;
    case 'deprecated':
      return <Badge variant="destructive">Deprecated</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your team's Memory Bank, decisions, and knowledge base.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Decisions"
          value={stats.totalDecisions}
          description={`${stats.acceptedDecisions} accepted, ${stats.pendingDecisions} pending`}
          icon={GitBranch}
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Knowledge Entries"
          value={stats.totalKnowledge}
          description="Across all categories"
          icon={BookOpen}
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Team Members"
          value={stats.teamMembers}
          description="Active contributors"
          icon={Users}
        />
        <StatCard
          title="Modules"
          value={stats.modules}
          description="Documented contexts"
          icon={Brain}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentActivity.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  type={activity.type}
                  title={activity.title}
                  user={activity.user}
                  timestamp={activity.timestamp}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Decisions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Decisions</CardTitle>
            <CardDescription>Architecture Decision Records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDecisions.map((decision) => (
                <div key={decision.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{decision.id}</p>
                    <p className="text-xs text-muted-foreground truncate">{decision.title}</p>
                  </div>
                  <div className="ml-4">{getStatusBadge(decision.status)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for managing your Memory Bank</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <a
              href="/decisions/new"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <GitBranch className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">New Decision</p>
                <p className="text-xs text-muted-foreground">Create an ADR</p>
              </div>
            </a>
            <a
              href="/knowledge/new"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Add Knowledge</p>
                <p className="text-xs text-muted-foreground">Document learnings</p>
              </div>
            </a>
            <a
              href="/memory-bank"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Browse Memory Bank</p>
                <p className="text-xs text-muted-foreground">Explore contexts</p>
              </div>
            </a>
            <a
              href="/team"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Team Activity</p>
                <p className="text-xs text-muted-foreground">View contributions</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
