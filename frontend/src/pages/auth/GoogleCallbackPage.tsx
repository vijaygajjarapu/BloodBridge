import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

/**
 * Google sends the browser back here (via the backend) with the result in the URL fragment:
 *   #token=...&new=1&complete=0   or   #error=...
 */
export const GoogleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Remove the token from the address bar and browser history straight away
    window.history.replaceState(null, '', window.location.pathname);

    const errorMessage = params.get('error');
    const token = params.get('token');
    if (errorMessage || !token) {
      setError(errorMessage || 'Google sign-in did not complete. Please try again.');
      return;
    }

    localStorage.setItem('bloodbridge_auth_token', token);
    apiClient.setToken(token);

    refreshSession()
      .then(() => {
        if (params.get('complete') === '0') {
          // New Google accounts still need a mobile number and location
          navigate('/app/profile/edit?complete=1', { replace: true });
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      })
      .catch(() => setError('Signed in with Google, but your session could not be loaded. Please try again.'));
  }, [navigate, refreshSession]);

  return (
    <Card className="shadow-xl border-line-border bg-white">
      <CardContent className="p-8 text-center space-y-4">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-status-error mx-auto" />
            <h1 className="text-lg font-bold text-ink-main">Google sign-in failed</h1>
            <p className="text-sm text-ink-secondary">{error}</p>
            <Link to="/auth/login">
              <Button variant="primary">Back to sign in</Button>
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-ink-secondary">Finishing Google sign-in…</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
