'use client';

import * as React from 'react';
import { UserPlus, Settings } from 'lucide-react';
import { TeamActivity, mockActivities, mockTeamMembers } from '@/components/team/team-activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function TeamPage() {
  // Stats
  const stats = {
    totalMembers: mockTeamMembers.length,
    activitiesThisWeek: mockActivities.filter((a) => {
      const activityDate = new Date(a.timestamp);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return activityDate > weekAgo;
    }).length,
    decisionsThisMonth: mockActivities.filter((a) => {
      const activityDate = new Date(a.timestamp);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return activityDate > monthAgo && a.type.includes('decision');
    }).length,
  };

  // Top contributors (mock)
  const topContributors = mockTeamMembers.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            View team activity, members, and contributions to the Memory Bank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Stats and Top Contributors */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activitiesThisWeek}</div>
            <p className="text-xs text-muted-foreground">Updates this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex -space-x-2">
              {topContributors.map((member) => (
                <Avatar key={member.id} className="border-2 border-background h-8 w-8">
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-420px)]">
            <TeamActivity
              activities={mockActivities}
              members={mockTeamMembers}
              className="h-full"
            />
          </Card>
        </div>

        {/* Team Members List */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>{mockTeamMembers.length} members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockTeamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  {member.githubUsername && (
                    <Badge variant="outline" className="text-xs">
                      @{member.githubUsername}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
