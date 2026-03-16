import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../services/api';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/list-product';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem('token', token);
      window.dispatchEvent(new Event('auth-change'));
      navigate(redirect, { replace: true });
    } catch (err: unknown) {
      const res = err as { response?: { data?: { error?: string } } };
      setError(res.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-artisan-bark">Log in</h1>
      <p className="mt-1 text-artisan-stone">Log in to list products and upload images.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-artisan-bark">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2.5 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-artisan-bark">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2.5 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-artisan-terracotta py-2.5 font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-artisan-stone">
        Don’t have an account?{' '}
        <Link to="/signup" className="font-medium text-artisan-terracotta hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
