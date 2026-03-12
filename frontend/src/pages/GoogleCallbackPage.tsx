import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

/**
 * Handles the Google OAuth redirect callback.
 * Reads auth data from the URL fragment (#token=...&user=...)
 * and completes the login flow.
 */
export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { setAuthFromGoogle } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1); // remove leading #
    if (!hash) {
      setError('No authentication data received.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }

    const params = new URLSearchParams(hash);

    // Check for error
    const errorMsg = params.get('error');
    if (errorMsg) {
      setError(errorMsg);
      toast.error(errorMsg);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }

    const token = params.get('token');
    const userJson = params.get('user');
    const needsProfileCompletion = params.get('needs_profile_completion') === 'true';

    if (!token || !userJson) {
      setError('Invalid authentication data.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }

    try {
      const user = JSON.parse(userJson);

      // Use the auth context to set the session
      setAuthFromGoogle(token, user, needsProfileCompletion);

      // Clean the URL fragment
      window.history.replaceState(null, '', window.location.pathname);

      // Navigate based on role/profile completion
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate('/admin', { replace: true });
      } else if (needsProfileCompletion) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      setError('Failed to process login. Please try again.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        {error ? (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-400">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <svg className="animate-spin w-8 h-8 text-gray-400 mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500">Signing you in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
