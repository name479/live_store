"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("is_admin_logged_in");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const input = password.trim().toLowerCase();
    const envPass = (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "").toLowerCase();

    // يقبل كلمة admin أو الرمز المسجل في المتغيرات البيئية
    if (input === "admin" || (envPass && input === envPass)) {
      localStorage.setItem("is_admin_logged_in", "true");
      setIsAuthenticated(true);
    } else {
      setError("رمز الدخول غير صحيح");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("is_admin_logged_in");
    setIsAuthenticated(false);
    setPassword("");
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 p-6" dir="rtl">
        <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white">لوحة تحكم المتجر</h1>
            <p className="text-sm text-slate-400">مرحباً بك في إدارة المنتجات والطلبات</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-medium transition"
          >
            تسجيل الخروج
          </button>
        </header>

        <main className="max-w-6xl mx-auto py-8">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-8 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">تم تسجيل الدخول بنجاح</h2>
            <p className="text-slate-400 text-sm">لوحة التحكم جاهزة لاستعراض وتعديل منتجاتك وطلباتك.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 text-slate-100" dir="rtl">
      <div className="w-full max-w-md bg-[#0b1120] border border-slate-800/80 p-8 rounded-2xl shadow-2xl">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">لوحة الإدارة</h1>
          <p className="text-slate-400 text-sm mt-1">أدخل الرمز للمتابعة</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="أدخل رمز الدخول..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0b1120] text-white rounded-xl border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition text-sm placeholder:text-slate-500 pl-11"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400 transition"
              title={showPassword ? "إخفاء الرمز" : "إظهار الرمز"}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-medium rounded-xl transition duration-150 text-sm shadow-lg shadow-blue-600/20"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}