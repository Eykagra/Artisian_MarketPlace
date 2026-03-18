import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../services/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await signup(email, password, role);
      localStorage.setItem('token', token);
      window.dispatchEvent(new Event('auth-change'));
      navigate(role === 'seller' ? '/dashboard' : '/', { replace: true });
    } catch (err: unknown) {
      const res = err as { response?: { data?: { error?: string } } };
      setError(res.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-artisan-bark">Create an account</h1>
      <p className="mt-1 text-artisan-stone">Join the Artisan Marketplace.</p>

      {/* Role picker */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {(['buyer', 'seller'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-xl border-2 px-4 py-4 text-left transition ${
              role === r
                ? 'border-artisan-terracotta bg-artisan-terracotta/5'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <span className="block text-xl">{r === 'buyer' ? '🛍️' : '🧑‍🎨'}</span>
            <span className="mt-1 block font-semibold capitalize text-artisan-bark">{r}</span>
            <span className="mt-0.5 block text-xs text-artisan-stone">
              {r === 'buyer' ? 'Discover & buy handcrafted goods' : 'List & sell your creations'}
            </span>
          </button>
        ))}
      </div>

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
            minLength={6}
            className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2.5 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-artisan-terracotta py-2.5 font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : `Sign up as ${role}`}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-artisan-stone">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-artisan-terracotta hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
