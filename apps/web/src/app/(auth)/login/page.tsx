'use client';
import { useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function LoginPage() {
  const [email, setEmail] = useState('merchant@test.com');
  const [password, setPassword] = useState('12345678');
  const [status, setStatus] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Signing in...');
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) return setStatus('Invalid credentials');
    const data = await r.json();
    localStorage.setItem('accessToken', data.accessToken);
    setStatus('Signed in ✅');
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="border rounded-lg p-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input className="border rounded-lg p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <button className="bg-black text-white rounded-lg px-4 py-2">Login</button>
        <div className="text-sm text-gray-600">{status}</div>
      </form>
    </main>
  );
}
