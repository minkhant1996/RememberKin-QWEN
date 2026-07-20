import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth.service';
import { familyService } from '../services/family.service';
import { PendingInvite } from '../types';

// Public demo deployments run login-only with provided accounts
const allowRegistration = import.meta.env.VITE_ALLOW_REGISTRATION !== 'false';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pending invite consent state
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [claimingIndex, setClaimingIndex] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);

  const navigate = useNavigate();
  const { login, updateToken } = useAuthStore();

  if (!allowRegistration) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register(email, password, name);
      login(response.user, response.token);

      // Check for pending invites from localStorage (token link flow)
      const storedToken = localStorage.getItem('pendingInviteToken');
      if (storedToken) {
        localStorage.removeItem('pendingInviteToken');
        try {
          const result = await familyService.claimInvite(storedToken, 'accept');
          if (result.token && result.familyId) {
            updateToken(result.token, result.familyId);
          }
        } catch {
          // Token may have expired — ignore, user can re-invite
        }
        navigate('/family');
        return;
      }

      // Check for email-match pending invites
      if (response.pendingInvites && response.pendingInvites.length > 0) {
        setPendingInvites(response.pendingInvites);
        return; // Show consent screen
      }

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAction = async (action: 'accept' | 'decline') => {
    const invite = pendingInvites[claimingIndex];
    setClaimLoading(true);

    try {
      const result = await familyService.claimInvite(invite.inviteToken, action);
      if (action === 'accept' && result.token && result.familyId) {
        updateToken(result.token, result.familyId);
      }
    } catch {
      // Continue regardless
    } finally {
      setClaimLoading(false);
    }

    const next = claimingIndex + 1;
    if (next < pendingInvites.length) {
      setClaimingIndex(next);
    } else {
      navigate('/family');
    }
  };

  // Pending invite consent screen
  if (pendingInvites.length > 0) {
    const invite = pendingInvites[claimingIndex];
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">RK</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">You've been added to a family!</h1>
            {pendingInvites.length > 1 && (
              <p className="text-gray-500 text-sm mt-1">
                {claimingIndex + 1} of {pendingInvites.length}
              </p>
            )}
          </div>

          <div className="card p-6 text-center space-y-4">
            <p className="text-gray-700">
              <span className="font-semibold">{invite.inviterName}</span> has added you to the{' '}
              <span className="font-semibold">{invite.familyName}</span> family on RememberKin.
            </p>
            <p className="text-gray-500 text-sm">
              Would you like to join and access their family memories?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleInviteAction('decline')}
                disabled={claimLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Not now
              </button>
              <button
                onClick={() => handleInviteAction('accept')}
                disabled={claimLoading}
                className="flex-1 btn-primary"
              >
                {claimLoading ? 'Joining…' : `Join ${invite.familyName}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">RK</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Your Account
          </h1>
          <p className="text-gray-600">
            Start preserving your family memories today
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="Email address"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Re-enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
