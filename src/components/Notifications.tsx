import { useNotifications, NotificationItem } from '@/context/NotificationsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DMRequestCard = ({ request }: { request: Extract<NotificationItem, { type: 'dm_request' }> }) => {
  const { respondToRequest } = useNotifications();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center">
          <Bell className="h-4 w-4 mr-2" />
          DM Request
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.sender?.avatar_url} />
              <AvatarFallback>{request.sender?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{request.sender?.name}</p>
              <p className="text-sm text-muted-foreground">wants to send you a message</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={() => respondToRequest(request.id, 'rejected')}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => respondToRequest(request.id, 'accepted')}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const NewMessageCard = ({ message }: { message: Extract<NotificationItem, { type: 'new_message' }> }) => {
  const navigate = useNavigate();
  const { clearMessageNotifications } = useNotifications();

  const handleClick = () => {
    clearMessageNotifications(message.sender_id);
    navigate(`/users?chatWith=${message.sender_id}`);
  }

  return (
    <Card className="cursor-pointer hover:bg-accent" onClick={handleClick}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center">
          <MessageSquare className="h-4 w-4 mr-2" />
          New Message
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={message.sender?.avatar_url} />
              <AvatarFallback>{message.sender?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{message.sender?.name}</p>
              <p className="text-sm text-muted-foreground truncate">{message.content}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


const Notifications = () => {
  const { notifications, loading } = useNotifications();

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg"></div>)}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No pending notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((item) => {
        if (item.type === 'dm_request') {
          return <DMRequestCard key={`dm-${item.id}`} request={item} />;
        }
        if (item.type === 'new_message') {
          return <NewMessageCard key={`msg-${item.id}`} message={item} />;
        }
        return null;
      })}
    </div>
  );
};

export default Notifications;