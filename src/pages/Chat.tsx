import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// Define types for better readability and safety
interface User {
  id: string;
  name: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  // The 'sender' is a join from the users table
  sender: User;
}

const Chat = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const recipientId = searchParams.get('recipient');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for the component
  const [recipient, setRecipient] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Effect to fetch initial data and set up subscriptions
  useEffect(() => {
    if (!recipientId || !currentUser) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      console.log('Loading conversation for recipient:', recipientId);

      try {
        // 1. Fetch recipient details
        const { data: recipientData, error: recipientError } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .eq('id', recipientId)
          .single();

        if (recipientError) {
          console.error('Error fetching recipient:', recipientError);
          toast({
            title: 'Error',
            description: 'Could not load recipient details.',
            variant: 'destructive',
          });
          throw recipientError;
        }
        setRecipient(recipientData);
        console.log('Recipient loaded:', recipientData);

        // 2. Fetch messages
        console.log('Loading messages for conversation:', currentUser.id, recipientId);
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*, sender:sender_id(id, name, avatar_url)')
          .or(`(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),(sender_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          toast({
            title: 'Error',
            description: 'Failed to load messages.',
            variant: 'destructive',
          });
          throw messagesError;
        }

        setMessages(messagesData as any);
        console.log('Messages query result:', { data: messagesData, error: messagesError });

      } catch (error) {
        // Error is already logged and toasted inside the try block
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 3. Set up realtime subscription
    console.log('Setting up realtime subscription...');
    const channel = supabase.channel(`realtime:messages:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as any;

          // Only update if the message is from the person we are currently chatting with
          if (newMessage.sender_id === recipientId) {
            // The sender data is not in the payload, so we need to fetch it.
            const { data: senderData, error: senderError } = await supabase
              .from('users')
              .select('id, name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            if (senderError) {
              console.error('Error fetching sender for realtime message:', senderError);
              return; // Don't add the message if we can't get sender info
            }

            const messageWithSender: Message = {
              ...newMessage,
              sender: senderData,
            };

            setMessages((prevMessages) => [...prevMessages, messageWithSender]);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', { status, err });
          toast({
            title: 'Connection interrupted',
            description: 'Real-time updates may be delayed. Please refresh if issues persist.',
            variant: 'destructive',
          });
        }
        console.log('Realtime subscription status:', status);
      });

    // Cleanup function to remove subscription on component unmount
    return () => {
      console.log('Removing realtime subscription');
      supabase.removeChannel(channel);
    };

  }, [recipientId, currentUser, toast]);

  // Effect to scroll to the bottom of the message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !recipientId) return;

    const optimisticId = `optimistic-${Date.now()}`;
    // The 'sender' object needs to be constructed based on what we know about the current user.
    // The Message type expects a `sender` property.
    const optimisticMessage: Message = {
      id: optimisticId,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      recipient_id: recipientId,
      sender: {
        id: currentUser.id,
        name: currentUser.user_metadata.name || 'You',
        avatar_url: currentUser.user_metadata.avatar_url,
      },
    };

    setSending(true);
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);
    setNewMessage('');

    console.log('Sending message:', optimisticMessage.content);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          recipient_id: recipientId,
          content: optimisticMessage.content,
          media_type: 'none',
        })
        .select('*, sender:sender_id(id, name, avatar_url)')
        .single();

      if (error) {
        throw error;
      }

      console.log('Message sent successfully:', data);
      // Replace optimistic message with the real one from the database
      setMessages(prevMessages =>
        prevMessages.map(msg => (msg.id === optimisticId ? (data as any) : msg))
      );

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      // Rollback: remove the optimistic message
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Placeholder for the UI when no user is selected
  if (!recipientId) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="h-[600px] flex flex-col items-center justify-center">
          <CardContent className="text-center">
            <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Select a user to chat with</h2>
            <p className="text-muted-foreground mb-6">
              Choose someone from the users list to start a conversation.
            </p>
            <Button onClick={() => navigate('/users')}>Browse Users</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b border-border">
          {recipient ? (
            <CardTitle className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/users')} className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={recipient.avatar_url} />
                <AvatarFallback>{recipient.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span>{recipient.name}</span>
            </CardTitle>
          ) : (
            <div className="animate-pulse h-8 bg-muted rounded w-1/2"></div>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center items-center h-full pt-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-full pt-10">
                  <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.sender_id === currentUser?.id;
                  const senderName = isOwnMessage ? currentUser?.user_metadata.name : message.sender.name;
                  const senderAvatar = isOwnMessage ? currentUser?.user_metadata.avatar_url : message.sender.avatar_url;

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isOwnMessage && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={senderAvatar} />
                          <AvatarFallback>{senderName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="break-words">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1 text-right">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </p>
                      </div>
                       {isOwnMessage && currentUser && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={senderAvatar} />
                          <AvatarFallback>{senderName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border p-4">
            <div className="flex items-center space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={sending || !currentUser}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim() || !currentUser} size="sm" aria-label="Send message">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Chat;