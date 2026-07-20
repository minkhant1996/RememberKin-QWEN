import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth.service';

// Public demo deployments run login-only with provided accounts
const allowRegistration = import.meta.env.VITE_ALLOW_REGISTRATION !== 'false';
const showDemoLogins =
  !allowRegistration || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'RememberKin2026!';

const demoAccounts = [
  { email: 'demo@rememberkin.demo', name: 'Linh Nguyen', role: 'Family owner' },
  { email: 'judge1@rememberkin.demo', name: 'Uncle Tuan', role: 'Judge account 1' },
  { email: 'judge2@rememberkin.demo', name: 'Aunt Mai', role: 'Judge account 2' },
  { email: 'judge3@rememberkin.demo', name: 'Cousin Duc', role: 'Judge account 3' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const response = await authService.login(loginEmail, loginPassword);
      login(response.user, response.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">RK</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to your Rememberkin account
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
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {allowRegistration ? (
            <p className="text-center text-sm text-gray-600 mt-4">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:underline">
                Sign up
              </Link>
            </p>
          ) : (
            <p className="text-center text-sm text-gray-500 mt-4">
              This is a demo deployment — pick a demo account below to sign in.
            </p>
          )}
        </div>

        {showDemoLogins && (
          <div className="card p-6 mt-4">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Demo accounts</h2>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                one click to sign in
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              These are pre-seeded demo accounts with fictional family data — not real users.
              All of them belong to the same demo family.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={loading}
                  onClick={() => doLogin(account.email, DEMO_PASSWORD)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary-700 font-semibold">
                      {account.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
                    <p className="text-xs text-gray-500 truncate">{account.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
