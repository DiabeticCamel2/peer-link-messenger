import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Bell } from 'lucide-react';

interface DmRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: {
    name: string;
    avatar_url?: string;
  };
}

const Notifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPendingRequests();
      setupRealtime();
    }
  }, [user]);

  const fetchPendingRequests = async () => {
    if (!user) return;

    try {
      const { data: dmRequests, error } = await supabase
        .from('dm_requests')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get sender info for each request
      const requestsWithSenders = await Promise.all(
        (dmRequests || []).map(async (request) => {
          const { data: sender } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('id', request.sender_id)
            .single();
          
          return {
            ...request,
            sender
          };
        })
      );

      setRequests(requestsWithSenders);
    } catch (error) {
      console.error('Error fetching DM requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    if (!user) return;

    const channel = supabase
      .channel('dm_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_requests',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          fetchPendingRequests(); // Refetch to get sender info
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRequestResponse = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { data, error } = await supabase.functions.invoke('dm-request', {
        body: {
          action: 'respond',
          request_id: requestId,
          status
        }
      });

      if (error) {
        console.error('DM request response error:', error);
        throw error;
      }

      // Remove from pending requests
      setRequests(prev => prev.filter(req => req.id !== requestId));

      toast({
        title: 'Success',
        description: status === 'accepted' ? 'DM request accepted' : 'DM request rejected',
      });
    } catch (error: any) {
      console.error('Error responding to DM request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to respond to request',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No pending notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">DM Request</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={request.sender?.avatar_url} />
                  <AvatarFallback>
                    {request.sender?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{request.sender?.name}</p>
                  <p className="text-sm text-muted-foreground">wants to send you a message</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRequestResponse(request.id, 'rejected')}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRequestResponse(request.id, 'accepted')}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Notifications;