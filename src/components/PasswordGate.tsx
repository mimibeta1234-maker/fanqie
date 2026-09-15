import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { verifyAndSavePassword } from '../utils/auth';

interface PasswordGateProps {
  onAuthenticated: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError(false);

    try {
      const isValid = await verifyAndSavePassword(password);
      if (isValid) {
        onAuthenticated();
      } else {
        setError(true);
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 selection:bg-red-500 selection:text-white font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">Studio</h1>
            <p className="text-xs text-stone-500 mt-1">
              Vui lòng nhập mật khẩu để mở khóa và truy cập ứng dụng
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700 block">Mật khẩu truy cập</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <KeyRound className="w-4 h-4" />
              </div>

              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Nhập mật khẩu..."
                disabled={loading}
                className={`w-full pl-10 pr-10 py-2.5 text-sm bg-stone-50 border rounded-xl focus:outline-none transition-all ${
                  error
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                    : 'border-stone-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Mật khẩu không chính xác, vui lòng thử lại.</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!password.trim() || loading}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>Đang kiểm tra...</span>
            ) : (
              <>
                <span>Xác nhận mở khóa</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Phiên đăng nhập sẽ được lưu tự động trên trình duyệt này</span>
        </div>
      </div>
    </div>
  );
};
