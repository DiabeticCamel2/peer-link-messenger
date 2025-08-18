import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  privacy_mode?: boolean;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchUsers();
    }
  }, [authLoading, currentUser]);

  const fetchUsers = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUser.id); // Exclude current user

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchMatch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If user has privacy mode, only show them if search term matches exact full name
    if (user.privacy_mode && searchTerm) {
      return user.name.toLowerCase() === searchTerm.toLowerCase();
    }
    
    // If user has privacy mode but no search term, don't show them
    if (user.privacy_mode && !searchTerm) {
      return false;
    }
    
    return searchMatch;
  });

  const handleStartChat = async (userId: string) => {
    // Check if recipient has privacy mode enabled
    const recipient = users.find(u => u.id === userId);
    if (recipient?.privacy_mode) {
      // Check if they're already in allowed contacts
      const user1_id = currentUser!.id < userId ? currentUser!.id : userId;
      const user2_id = currentUser!.id < userId ? userId : currentUser!.id;
      
      const { data: allowedContact } = await supabase
        .from('allowed_contacts')
        .select('id')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .single();

      if (!allowedContact) {
        // Send DM request
        try {
          const { error } = await supabase.functions.invoke('dm-request', {
            body: {
              action: 'send',
              sender_id: currentUser!.id,
              recipient_id: userId
            }
          });

          if (error) throw error;

          toast({
            title: 'DM Request Sent',
            description: `DM request sent to ${recipient.name}. Wait for their response.`,
          });
        } catch (error: any) {
          console.error('Error sending DM request:', error);
          if (error.message?.includes('duplicate key')) {
            toast({
              title: 'Already Requested',
              description: 'You already sent a DM request to this user.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: 'Failed to send DM request',
              variant: 'destructive',
            });
          }
        }
        return;
      }
    }
    
    // Normal chat flow
    navigate(`/chat?recipient=${userId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UsersIcon className="h-6 w-6" />
          <span>Students</span>
        </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search students... (use full name for private users)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm ? 'No students found matching your search.' : 'No other students found.'}
              </p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartChat(user.id)}
                    className="flex items-center space-x-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{user.privacy_mode ? 'Request' : 'Chat'}</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;