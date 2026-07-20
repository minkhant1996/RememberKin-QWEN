import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { familyService } from '../services/family.service';

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, updateToken } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'prompt' | 'done' | 'error'>('loading');
  const [familyName, setFamilyName] = useState('');
  const [inviterName, setInviterName] = useState('');
  const [claiming, setClaiming] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    if (!isAuthenticated) {
      // Store token and redirect to register
      localStorage.setItem('pendingInviteToken', token);
      navigate('/register');
      return;
    }

    // Authenticated — fetch invite details to show the prompt
    setStatus('prompt');
    // We'll use the invite token directly; family/inviter info comes from the claim response
    // For now show a generic prompt
    setFamilyName('this family');
    setInviterName('a family member');
  }, [token, isAuthenticated]);

  const handleAction = async (action: 'accept' | 'decline') => {
    if (!token) return;
    setClaiming(true);
    try {
      const result = await familyService.claimInvite(token, action);
      if (action === 'accept' && result.token && result.familyId) {
        updateToken(result.token, result.familyId);
        navigate('/family');
      } else {
        setStatus('done');
      }
    } catch {
      setStatus('error');
    } finally {
      setClaiming(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">You've declined the invite. You can close this page.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600">This invite link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">FM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Family Invite</h1>
        </div>

        <div className="card p-6 text-center space-y-4">
          <p className="text-gray-700">
            <span className="font-semibold">{inviterName}</span> has added you to the{' '}
            <span className="font-semibold">{familyName}</span> on RememberKin.
          </p>
          <p className="text-gray-500 text-sm">
            Would you like to join and access their family memories?
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleAction('decline')}
              disabled={claiming}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Decline
            </button>
            <button
              onClick={() => handleAction('accept')}
              disabled={claiming}
              className="flex-1 btn-primary"
            >
              {claiming ? 'Joining…' : 'Join Family'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
