'use client';

import * as React from 'react';
import {
  GitBranch,
  BookOpen,
  Brain,
  Users,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  GitCommit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Activity, ActivityType, TeamMember } from '@/types';
import { formatRelativeDate } from '@/lib/utils';

interface TeamActivityProps {
  activities: Activity[];
  members?: TeamMember[];
  className?: string;
}

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  decision_created: GitBranch,
  decision_updated: GitBranch,
  decision_accepted: CheckCircle2,
  knowledge_added: BookOpen,
  knowledge_updated: BookOpen,
  module_created: Brain,
  context_updated: Brain,
  member_joined: Users,
  review_completed: MessageSquare,
  commit_pushed: GitCommit,
};

const activityColors: Record<ActivityType, string> = {
  decision_created: 'text-blue-500 bg-blue-500/10',
  decision_updated: 'text-blue-500 bg-blue-500/10',
  decision_accepted: 'text-green-500 bg-green-500/10',
  knowledge_added: 'text-purple-500 bg-purple-500/10',
  knowledge_updated: 'text-purple-500 bg-purple-500/10',
  module_created: 'text-orange-500 bg-orange-500/10',
  context_updated: 'text-orange-500 bg-orange-500/10',
  member_joined: 'text-cyan-500 bg-cyan-500/10',
  review_completed: 'text-yellow-500 bg-yellow-500/10',
  commit_pushed: 'text-gray-500 bg-gray-500/10',
};

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = activityIcons[activity.type] || AlertCircle;
  const colorClass = activityColors[activity.type] || 'text-muted-foreground bg-muted';

  return (
    <div className="flex items-start gap-4 py-4">
      <Avatar className="h-8 w-8">
        <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
        <AvatarFallback>{activity.user.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{activity.user.name}</span>
          <div className={cn('rounded-md p-1', colorClass)}>
            <Icon className={cn('h-3 w-3', colorClass.split(' ')[0])} />
          </div>
        </div>
        <p className="text-sm mt-1">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
        )}
        <span className="text-xs text-muted-foreground">
          {formatRelativeDate(activity.timestamp)}
        </span>
      </div>
    </div>
  );
}

interface TeamMemberCardProps {
  member: TeamMember;
}

function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.avatar} alt={member.name} />
            <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role}</p>
          </div>
        </div>
        {member.expertise && member.expertise.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {member.expertise.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamActivity({ activities, members = [], className }: TeamActivityProps) {
  return (
    <Tabs defaultValue="activity" className={cn('flex flex-col h-full', className)}>
      <div className="border-b px-4">
        <TabsList className="h-10">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="members">Team ({members.length})</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="activity" className="flex-1 mt-0">
        <ScrollArea className="h-full">
          <div className="divide-y px-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="members" className="flex-1 mt-0">
        <ScrollArea className="h-full">
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {members.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

// Mock data for demonstration
export const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'decision_accepted',
    title: 'Accepted ADR-024: Migrate to Event-Driven Architecture',
    description: 'After team discussion, the proposal was approved.',
    user: {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      role: 'Tech Lead',
      avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'knowledge_added',
    title: 'Added Spring Boot 4 Migration Guide',
    description: 'Comprehensive guide for upgrading from Spring Boot 3.',
    user: {
      id: '2',
      name: 'Mike Rodriguez',
      email: 'mike@example.com',
      role: 'Senior Developer',
      avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
    },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'context_updated',
    title: 'Updated payment-service module context',
    description: 'Added new API endpoints and updated architecture diagram.',
    user: {
      id: '3',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'DevOps Engineer',
      avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
    },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'decision_created',
    title: 'Proposed ADR-025: GraphQL API Gateway',
    description: 'Proposal to add GraphQL support for mobile clients.',
    user: {
      id: '4',
      name: 'Emily Wang',
      email: 'emily@example.com',
      role: 'Senior Developer',
      avatar: 'https://avatars.githubusercontent.com/u/4?v=4',
    },
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'member_joined',
    title: 'Alex Thompson joined the team',
    description: 'New backend developer focusing on payment systems.',
    user: {
      id: '5',
      name: 'System',
      email: 'system@example.com',
      role: 'System',
    },
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    type: 'review_completed',
    title: 'Completed code review for PR #456',
    description: 'Reviewed and approved the Kafka consumer implementation.',
    user: {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      role: 'Tech Lead',
      avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    role: 'Tech Lead',
    avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    githubUsername: 'sarahchen',
    expertise: ['Architecture', 'Java', 'Kafka'],
  },
  {
    id: '2',
    name: 'Mike Rodriguez',
    email: 'mike@example.com',
    role: 'Senior Developer',
    avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
    githubUsername: 'mikerodriguez',
    expertise: ['Spring Boot', 'PostgreSQL', 'Microservices'],
  },
  {
    id: '3',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'DevOps Engineer',
    avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
    githubUsername: 'johndoe',
    expertise: ['Kubernetes', 'AWS', 'Terraform'],
  },
  {
    id: '4',
    name: 'Emily Wang',
    email: 'emily@example.com',
    role: 'Senior Developer',
    avatar: 'https://avatars.githubusercontent.com/u/4?v=4',
    githubUsername: 'emilywang',
    expertise: ['React', 'TypeScript', 'GraphQL'],
  },
  {
    id: '5',
    name: 'Alex Thompson',
    email: 'alex@example.com',
    role: 'Backend Developer',
    avatar: 'https://avatars.githubusercontent.com/u/5?v=4',
    githubUsername: 'alexthompson',
    expertise: ['Java', 'Payment Systems', 'Security'],
  },
  {
    id: '6',
    name: 'Lisa Park',
    email: 'lisa@example.com',
    role: 'QA Engineer',
    avatar: 'https://avatars.githubusercontent.com/u/6?v=4',
    githubUsername: 'lisapark',
    expertise: ['Testing', 'Automation', 'E2E'],
  },
];
