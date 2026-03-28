import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Link inválido.'); return; }
    api.get(`/auth/invite/${token}`)
      .then((r) => { setEmail(r.data.email); setName(r.data.name || ''); setStatus('ready'); })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'Link inválido ou expirado.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirm) { setErrorMsg('As senhas não coincidem.'); return; }
    if (password.length < 6) { setErrorMsg('A senha deve ter pelo menos 6 caracteres.'); return; }
    setStatus('submitting');
    try {
      await api.post('/auth/set-password', { token, password });
      setStatus('done');
      setTimeout(() => navigate('/admin/login'), 2500);
    } catch (err) {
      setStatus('ready');
      setErrorMsg(err.response?.data?.error || 'Erro ao definir senha.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SM Torneio" className="w-16 h-16 mx-auto mb-3 rounded-full" />
          <h1 className="text-xl font-bold text-neutral-900">SM Torneio</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Definir senha de acesso</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-8">
          {status === 'loading' && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-[#9B2D3E]" />
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-red-600 font-medium mb-1">Link inválido</p>
              <p className="text-sm text-neutral-500">{errorMsg}</p>
              <a href="/admin/login" className="mt-4 inline-block text-sm text-[#9B2D3E] font-medium">
                Ir para o login
              </a>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-neutral-900">Senha definida com sucesso!</p>
              <p className="text-sm text-neutral-500 mt-1">Redirecionando para o login…</p>
            </div>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-neutral-500 mb-4">
                  Bem-vindo{name ? `, ${name}` : ''}! Defina uma senha para ativar seu acesso com o e-mail{' '}
                  <span className="font-medium text-neutral-900">{email}</span>.
                </p>
              </div>

              {errorMsg && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full bg-[#9B2D3E] hover:bg-[#8B2942] text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {status === 'submitting' ? 'Salvando…' : 'Definir senha e ativar conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
