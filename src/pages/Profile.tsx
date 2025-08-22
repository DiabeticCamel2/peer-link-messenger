import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Camera, Save, Shield, Filter, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

type ProfileData = z.infer<typeof profileSchema>;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  profanity_filter_enabled: boolean;
  privacy_mode: boolean;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      form.reset({ name: data.name });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    }
  };

  const handleNotificationPermission = async () => {
    if (Notification.permission === 'granted') {
      toast({
        title: 'Permissions',
        description: 'Browser notifications are already enabled.',
      });
      return;
    }

    if (Notification.permission === 'denied') {
      toast({
        title: 'Permissions Denied',
        description: 'You have previously denied notification permissions. Please enable them in your browser settings.',
        variant: 'destructive'
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast({
        title: 'Success',
        description: 'Browser notifications have been enabled.',
      });
    } else {
      toast({
        title: 'Permissions',
        description: 'You have not enabled browser notifications.',
        variant: 'destructive'
      });
    }
  };

  const onSubmit = async (data: ProfileData) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: data.name })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, name: data.name });
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !profile) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Also update the user metadata in the auth session
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (authUpdateError) throw authUpdateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast({
        title: 'Success',
        description: 'Avatar updated successfully',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateSetting = async (field: 'profanity_filter_enabled' | 'privacy_mode', value: boolean) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: value })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, [field]: value });
      toast({
        title: 'Success',
        description: 'Settings updated successfully',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'profile' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('profile')}
          className="flex-1"
        >
          <Settings className="h-4 w-4 mr-2" />
          Profile
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('settings')}
          className="flex-1"
        >
          <Shield className="h-4 w-4 mr-2" />
          Privacy & Safety
        </Button>
      </div>

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Update your profile information and avatar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {profile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                variant="secondary"
                className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Click the camera icon to upload a new avatar
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Profile Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter your full name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting || uploading}
              className="w-full flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </span>
            </Button>
          </form>
        </CardContent>
        </Card>
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy & Safety Settings</CardTitle>
            <CardDescription>
              Control your privacy and content filtering preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Profanity Filter</Label>
                  <p className="text-sm text-muted-foreground">
                    Filter inappropriate language from your outgoing messages
                  </p>
                </div>
                <Switch
                  checked={profile.profanity_filter_enabled}
                  onCheckedChange={(checked) => updateSetting('profanity_filter_enabled', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Privacy Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Hide from user search and require DM requests to message you
                  </p>
                </div>
                <Switch
                  checked={profile.privacy_mode}
                  onCheckedChange={(checked) => updateSetting('privacy_mode', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable browser notifications for new DM requests.
                  </p>
                </div>
                <Button
                  onClick={handleNotificationPermission}
                  disabled={notificationPermission === 'granted'}
                  size="sm"
                >
                  {notificationPermission === 'granted' ? 'Enabled' : 'Enable'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;