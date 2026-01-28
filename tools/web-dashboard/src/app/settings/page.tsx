'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Save, Github, Bell, Palette, Database, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, integrations, and dashboard preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your profile information is synced from GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                  <AvatarFallback className="text-2xl">
                    {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{session?.user?.name || 'Guest User'}</h3>
                  <p className="text-sm text-muted-foreground">{session?.user?.email || 'Not signed in'}</p>
                  <Badge variant="outline" className="mt-1">
                    <Github className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input defaultValue={session?.user?.name || ''} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue={session?.user?.email || ''} placeholder="your@email.com" disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input defaultValue="Developer" placeholder="Your role" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team</label>
                  <Input defaultValue="Platform Engineering" placeholder="Your team" />
                </div>
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>
                Connect your GitHub account to sync repositories and Memory Banks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Github className="h-8 w-8" />
                  <div>
                    <p className="font-medium">GitHub</p>
                    <p className="text-sm text-muted-foreground">
                      {session ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                <Badge variant={session ? 'default' : 'secondary'}>
                  {session ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Repository</label>
                <Input placeholder="owner/repository" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Memory Bank Path</label>
                <Input defaultValue=".memory-bank" placeholder=".memory-bank" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise Integrations</CardTitle>
              <CardDescription>
                Connect with your enterprise tools for enhanced functionality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">Jira + Confluence</p>
                    <p className="text-sm text-muted-foreground">Atlassian integration</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Connect</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="font-medium">Azure DevOps</p>
                    <p className="text-sm text-muted-foreground">Microsoft integration</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Connect</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive updates about your Memory Bank.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { title: 'Decision Updates', description: 'Get notified when ADRs are created or updated' },
                { title: 'Knowledge Changes', description: 'Updates to knowledge base entries' },
                { title: 'Team Activity', description: 'When team members make changes' },
                { title: 'Review Requests', description: 'When you are requested to review' },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Customize the appearance of the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {['light', 'dark', 'system'].map((theme) => (
                  <div
                    key={theme}
                    className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent"
                  >
                    <Palette className="h-5 w-5" />
                    <div>
                      <p className="font-medium capitalize">{theme}</p>
                      <p className="text-xs text-muted-foreground">
                        {theme === 'system' ? 'Follow system settings' : `Always use ${theme} mode`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editor Settings</CardTitle>
              <CardDescription>
                Configure the markdown editor behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Font Size</label>
                <Input type="number" defaultValue="14" min="10" max="24" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tab Size</label>
                <Input type="number" defaultValue="2" min="2" max="8" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Word Wrap</p>
                  <p className="text-sm text-muted-foreground">Wrap long lines in the editor</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
