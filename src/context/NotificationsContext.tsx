import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

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

interface NotificationsContextType {
  requests: DmRequest[];
  count: number;
  loading: boolean;
  respondToRequest: (requestId: string, status: 'accepted' | 'rejected') => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: dmRequests, error } = await supabase
        .from('dm_requests')
        .select('*, sender:sender_id(name, avatar_url)')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(dmRequests || []);
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
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchPendingRequests();
    }
  }, [user, fetchPendingRequests]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dm_requests_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dm_requests',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRequest = payload.new as DmRequest;

            // Fetch sender info for the notification content
            supabase
              .from('users')
              .select('name, avatar_url')
              .eq('id', newRequest.sender_id)
              .single()
              .then(({ data: sender }) => {
                if (sender && Notification.permission === 'granted') {
                  new Notification('New DM Request', {
                    body: `${sender.name} wants to send you a message.`,
                    icon: sender.avatar_url,
                  });
                }
                fetchPendingRequests();
              });
          } else {
            fetchPendingRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPendingRequests]);

  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase.functions.invoke('dm-request', {
        body: {
          action: 'respond',
          request_id: requestId,
          status,
        },
      });

      if (error) throw error;

      setRequests((prev) => prev.filter((req) => req.id !== requestId));
      toast({
        title: 'Success',
        description: `DM request ${status}`,
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

  const value = {
    requests,
    count: requests.length,
    loading,
    respondToRequest,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
