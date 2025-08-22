import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Send, ArrowLeft, MessageCircle, Loader2, Image, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/context/NotificationsContext';
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
  image_url?: string;
  image_filename?: string;
  image_size?: number;
  // The 'sender' is a join from the users table
  sender: User;
}

interface ChatWindowProps {
  recipientId: string;
  onBack: () => void;
}

const ChatWindow = ({ recipientId, onBack }: ChatWindowProps) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { setActiveChatRecipientId } = useNotifications();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for the component
  const [recipient, setRecipient] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);


  // Effect to fetch initial data and set up subscriptions
  useEffect(() => {
    if (!recipientId || !currentUser) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
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

        // 2. Fetch messages using the dual-query approach
        const { data: sentMessages, error: sentError } = await supabase
          .from('messages')
          .select('*')
          .eq('sender_id', currentUser.id)
          .eq('recipient_id', recipientId);

        const { data: receivedMessages, error: receivedError } = await supabase
          .from('messages')
          .select('*')
          .eq('sender_id', recipientId)
          .eq('recipient_id', currentUser.id);

        if (sentError || receivedError) {
          console.error('Message loading error:', { sentError, receivedError });
          toast({
            title: 'Error',
            description: 'Failed to load messages.',
            variant: 'destructive',
          });
          throw sentError || receivedError;
        }

        const allMessages = [...(sentMessages || []), ...(receivedMessages || [])];

        // Manually add sender info
        const usersMap = {
          [currentUser.id]: {
            id: currentUser.id,
            name: currentUser.user_metadata.name || 'You',
            avatar_url: currentUser.user_metadata.avatar_url,
          },
          [recipientData.id]: recipientData,
        };

        const messagesWithSenders = allMessages.map(msg => ({
          ...msg,
          sender: usersMap[msg.sender_id],
        }));

        // Sort messages
        messagesWithSenders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        setMessages(messagesWithSenders as any);

      } catch (error) {
        console.error('Failed to fetch conversation data:', error);
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

  // Effect to set the active chat recipient
  useEffect(() => {
    setActiveChatRecipientId(recipientId);
    return () => {
      setActiveChatRecipientId(null);
    };
  }, [recipientId, setActiveChatRecipientId]);

  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    const imageFileToSend = imageFile; // Keep a reference to the file

    if ((!messageContent && !imageFileToSend) || !currentUser || !recipientId) return;

    setSending(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      recipient_id: recipientId,
      sender: {
        id: currentUser.id,
        name: currentUser.user_metadata.name || 'You',
        avatar_url: currentUser.user_metadata.avatar_url,
      },
      image_url: imagePreviewUrl, // Use preview for optimistic UI
    };

    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    // Reset inputs immediately for a better UX
    setNewMessage('');
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    let imageUrl = '';
    let imageFilename = '';
    let imageSize = 0;

    try {
      if (imageFileToSend) {
        setUploadingImage(true);
        const conversationId = [currentUser.id, recipientId].sort().join('_');
        const fileExt = imageFileToSend.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${conversationId}/${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, imageFileToSend);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
        imageFilename = fileName;
        imageSize = imageFileToSend.size;
        setUploadingImage(false);
      }

      const { error } = await supabase.functions.invoke('sanitize-message', {
        body: {
          message: {
            sender_id: currentUser.id,
            recipient_id: recipientId,
            content: messageContent,
            image_url: imageUrl,
            image_filename: imageFilename,
            image_size: imageSize,
            media_type: imageFileToSend ? 'image' : 'text',
          },
        },
      });

      if (error) {
        throw new Error('Failed to send message: ' + error.message);
      }
    } catch (error) {
      console.error('Message send error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      // Rollback the optimistic update
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticId));
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPG, PNG, GIF, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b border-border">
        {recipient ? (
          <CardTitle className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
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

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
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
                      {message.image_url && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="relative cursor-pointer">
                              {message.id.startsWith('optimistic-') && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                              )}
                              <img
                                src={message.image_url}
                                alt={message.image_filename || 'image'}
                                className="rounded-lg max-w-full max-h-64 object-cover"
                              />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>{message.image_filename || "Image"}</DialogTitle>
                            </DialogHeader>
                            <img src={message.image_url} alt={message.image_filename || 'image'} className="w-full h-auto rounded-lg" />
                          </DialogContent>
                        </Dialog>
                      )}
                      {message.content && <p className="break-words mt-2">{message.content}</p>}
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
          {imagePreviewUrl && (
            <div className="relative mb-4 w-32 h-32">
              <img src={imagePreviewUrl} alt="Image preview" className="rounded-lg object-cover w-full h-full" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 rounded-full h-6 w-6 p-0"
                onClick={() => {
                  setImageFile(null);
                  setImagePreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingImage || !currentUser}
            >
              <Image className="h-5 w-5" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={imageFile ? "Add a caption..." : "Type a message..."}
              disabled={sending || uploadingImage || !currentUser}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={sending || uploadingImage || (!newMessage.trim() && !imageFile) || !currentUser} size="sm" aria-label="Send message">
              {sending || uploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatWindow;
