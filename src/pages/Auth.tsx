import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type SignUpData = z.infer<typeof signUpSchema>;
type SignInData = z.infer<typeof signInSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const { user, signUp, signIn, resetPassword } = useAuth();
  const { toast } = useToast();

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resetPasswordForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  // Redirect authenticated users to main page
  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSignUp = async (data: SignUpData) => {
    const { error } = await signUp(data.email, data.password, data.name);
    
    if (error) {
      toast({
        title: 'Sign Up Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success!',
        description: 'Please check your email to confirm your account.',
      });
    }
  };

  const onSignIn = async (data: SignInData) => {
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      toast({
        title: 'Sign In Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onResetPassword = async (data: ResetPasswordData) => {
    const { error } = await resetPassword(data.email);
    
    if (error) {
      toast({
        title: 'Reset Password Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Reset Email Sent!',
        description: 'Please check your email for password reset instructions.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            {isResetPassword && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResetPassword(false)}
                className="p-0 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle>
              {isResetPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
          </div>
          <CardDescription>
            {isResetPassword
              ? 'Enter your email to receive password reset instructions'
              : isSignUp 
              ? 'Sign up to start messaging with your classmates'
              : 'Sign in to continue messaging'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isResetPassword ? (
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPassword)} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  {...resetPasswordForm.register('email')}
                  placeholder="Enter your email"
                />
                {resetPasswordForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {resetPasswordForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={resetPasswordForm.formState.isSubmitting}
              >
                {resetPasswordForm.formState.isSubmitting ? 'Sending...' : 'Send Reset Email'}
              </Button>
            </form>
          ) : isSignUp ? (
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  {...signUpForm.register('name')}
                  placeholder="Enter your full name"
                />
                {signUpForm.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {signUpForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...signUpForm.register('email')}
                  placeholder="Enter your school email"
                />
                {signUpForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {signUpForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...signUpForm.register('password')}
                  placeholder="Create a password"
                />
                {signUpForm.formState.errors.password && (
                  <p className="text-sm text-destructive mt-1">
                    {signUpForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={signUpForm.formState.isSubmitting}
              >
                {signUpForm.formState.isSubmitting ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          ) : (
            <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...signInForm.register('email')}
                  placeholder="Enter your email"
                />
                {signInForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {signInForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...signInForm.register('password')}
                  placeholder="Enter your password"
                />
                {signInForm.formState.errors.password && (
                  <p className="text-sm text-destructive mt-1">
                    {signInForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={signInForm.formState.isSubmitting}
              >
                {signInForm.formState.isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          )}
          
          <div className="mt-4 text-center space-y-2">
            {!isResetPassword && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm"
                >
                  {isSignUp 
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Sign up"
                  }
                </Button>
                {!isSignUp && (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => setIsResetPassword(true)}
                      className="text-sm text-muted-foreground"
                    >
                      Forgot your password?
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;