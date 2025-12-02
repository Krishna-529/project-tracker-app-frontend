import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getGoogleAuthUrl, getMe } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[FRONTEND AUTH] Checking authentication status...');
      try {
        const user = await getMe();
        console.log('[FRONTEND AUTH] User authenticated:', user);
        if (user) {
          console.log('[FRONTEND AUTH] Navigating to home page');
          navigate('/');
        }
      } catch (error) {
        console.log('[FRONTEND AUTH] Not authenticated:', error);
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const code = searchParams.get('code');
    console.log('[FRONTEND AUTH] OAuth code in URL:', !!code);
    if (code) {
      // Handle callback
      const handleCallback = async () => {
        console.log('[FRONTEND AUTH] Handling OAuth callback with code');
        setLoading(true);
        try {
          console.log('[FRONTEND AUTH] Calling backend callback endpoint...');
          const response = await fetch(`http://localhost:3000/api/v1/auth/google/callback?code=${code}`, {
            credentials: 'include',
          });
          console.log('[FRONTEND AUTH] Backend response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[FRONTEND AUTH] Backend error response:', errorText);
            throw new Error('Login failed');
          }
          
          const data = await response.json();
          console.log('[FRONTEND AUTH] Backend response data:', data);
          
          if (data.status === 'success') {
            console.log('[FRONTEND AUTH] Login successful, cookie should be set');
            toast.success('Logged in successfully');
            // Clear the code from URL and navigate
            window.history.replaceState({}, document.title, '/login');
            console.log('[FRONTEND AUTH] Navigating to home...');
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('[FRONTEND AUTH] Callback error:', error);
          toast.error('Login failed');
        } finally {
          setLoading(false);
        }
      };
      handleCallback();
    }
  }, [searchParams, navigate]);

  const handleLogin = async () => {
    console.log('[FRONTEND AUTH] Login button clicked');
    try {
      setLoading(true);
      console.log('[FRONTEND AUTH] Getting Google OAuth URL...');
      const { url } = await getGoogleAuthUrl();
      console.log('[FRONTEND AUTH] Redirecting to Google:', url);
      window.location.href = url;
    } catch (error) {
      console.error('[FRONTEND AUTH] Failed to get OAuth URL:', error);
      toast.error('Failed to initialize login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button 
            className="w-full" 
            onClick={handleLogin} 
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
