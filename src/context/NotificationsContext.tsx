import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

// Base interfaces
interface Sender {
  name: string;
  avatar_url?: string;
}

// Specific notification types
interface DmRequest {
  id: string;
  sender_id: string;
  created_at: string;
  sender?: Sender;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Sender;
}

// Union type for notifications
export type NotificationItem = (
  | ({ type: 'dm_request' } & DmRequest)
  | ({ type: 'new_message' } & Message)
);

interface NotificationsContextType {
  notifications: NotificationItem[];
  count: number;
  loading: boolean;
  respondToRequest: (requestId: string, status: 'accepted' | 'rejected') => Promise<void>;
  clearMessageNotifications: (senderId: string) => void;
  setActiveChatRecipientId: (id: string | null) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dmRequests, setDmRequests] = useState<DmRequest[]>([]);
  const [messageNotifications, setMessageNotifications] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatRecipientId, setActiveChatRecipientId] = useState<string | null>(null);

  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dm_requests')
        .select('id, sender_id, created_at, sender:sender_id(name, avatar_url)')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDmRequests(data || []);
    } catch (error) {
      console.error('Error fetching DM requests:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchPendingRequests();
  }, [user, fetchPendingRequests]);

  useEffect(() => {
    if (!user) return;

    const dmChannel = supabase
      .channel('dm_requests_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        fetchPendingRequests();
        if (payload.eventType === 'INSERT' && Notification.permission === 'granted') {
          supabase.from('users').select('name, avatar_url').eq('id', payload.new.sender_id).single().then(({ data: sender }) => {
            if (sender) new Notification('New DM Request', { body: `${sender.name} wants to send you a message.`, icon: sender.avatar_url });
          });
        }
      }).subscribe();

    const msgChannel = supabase
      .channel('messages_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        const newMessage = payload.new as Message;
        if (newMessage.sender_id !== activeChatRecipientId) {
          supabase.from('users').select('name, avatar_url').eq('id', newMessage.sender_id).single().then(({ data: sender }) => {
            if (sender) {
              const notificationPayload = { ...newMessage, sender };
              setMessageNotifications(prev => [notificationPayload, ...prev.filter(n => n.sender_id !== newMessage.sender_id)]);
              if (Notification.permission === 'granted') {
                new Notification(`New message from ${sender.name}`, { body: newMessage.content, icon: sender.avatar_url });
              }
            }
          });
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user, activeChatRecipientId, fetchPendingRequests]);

  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    // Logic remains the same, but we update the local state optimistically
    setDmRequests(prev => prev.filter(req => req.id !== requestId));
    try {
      const { error } = await supabase.functions.invoke('dm-request', { body: { action: 'respond', request_id: requestId, status } });
      if (error) {
        toast({ title: 'Error', description: 'Failed to respond to request', variant: 'destructive' });
        fetchPendingRequests(); // Refetch on error
      } else {
        toast({ title: 'Success', description: `DM request ${status}` });
      }
    } catch (error) {
      console.error('Error responding to DM request:', error);
      toast({ title: 'Error', description: 'Failed to respond to request', variant: 'destructive' });
      fetchPendingRequests(); // Refetch on error
    }
  };

  const clearMessageNotifications = (senderId: string) => {
    setMessageNotifications(prev => prev.filter(n => n.sender_id !== senderId));
  };

  const notifications = useMemo(() => {
    const combined: NotificationItem[] = [
      ...dmRequests.map(r => ({ ...r, type: 'dm_request' as const })),
      ...messageNotifications.map(m => ({ ...m, type: 'new_message' as const }))
    ];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [dmRequests, messageNotifications]);

  const value = {
    notifications,
    count: notifications.length,
    loading,
    respondToRequest,
    clearMessageNotifications,
    setActiveChatRecipientId,
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
