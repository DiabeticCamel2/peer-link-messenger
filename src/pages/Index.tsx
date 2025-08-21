import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bell, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Welcome to SchoolChat</h1>
        <p className="text-xl text-muted-foreground">
          A safe and secure messaging platform for students.
        </p>
        {user && (
          <p className="text-lg text-muted-foreground mt-2">
            Hello, {user.user_metadata?.name || 'Student'}!
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-6 w-6 text-primary" />
              <span>Find Students</span>
            </CardTitle>
            <CardDescription>
              Browse and connect with other students in your school.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/users">
              <Button className="w-full">Browse Students</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-6 w-6 text-primary" />
              <span>Notifications</span>
            </CardTitle>
            <CardDescription>
              View your new messages and direct message requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/notifications">
              <Button className="w-full" variant="outline">View Notifications</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-6 w-6 text-primary" />
              <span>Profile</span>
            </CardTitle>
            <CardDescription>
              Update your name, avatar, and manage account settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/profile">
              <Button className="w-full" variant="secondary">Edit Profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Safety Features</h2>
        <div className="grid md:grid-cols-2 gap-4 text-left">
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-2 text-card-foreground">Message Filtering</h3>
            <p className="text-sm text-muted-foreground">
              Inappropriate content can be filtered from messages. This can be toggled in your profile settings.
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-2 text-card-foreground">Private Conversations</h3>
            <p className="text-sm text-muted-foreground">
              Only you and your recipient can see your messages. Complete privacy guaranteed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
