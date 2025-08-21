import Notifications from '@/components/Notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const NotificationsPage = () => {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage your DM requests and other notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Notifications />
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;
