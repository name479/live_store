"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "رمز الدخول غير صحيح");
      }
    } catch {
      setError("حدث خطأ أثناء محاولة تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between py-12 px-4 select-none relative overflow-hidden text-slate-100" dir="rtl">
      
      {/* إضاءات خلفية ناعمة */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* المحتوى الأوسط */}
      <div className="w-full max-w-sm flex flex-col items-center my-auto z-10">
        
        {/* أيقونة المفتاح المنفصلة في الأعلى */}
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-7 shadow-inner">
          <svg className="w-7 h-7 text-blue-400 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        {/* العنوان واسم البوابة */}
        <h1 className="text-3xl font-serif font-black tracking-wider text-white uppercase mb-2">
          LIVE STORE
        </h1>
        <p className="text-slate-400 text-sm font-medium tracking-wide mb-8">
          لوحة إدارة المتجر
        </p>

        {/* بطاقة تسجيل الدخول */}
        <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 p-6 sm:p-7 rounded-2xl shadow-xl">
          
          {error && (
            <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* حقل إدخال كلمة المرور مع الأيقونات الداخلية */}
            <div className="relative">
              {/* أيقونة القفل على اليمين */}
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <input
                type={showPassword ? "text" : "password"}
                placeholder="رمز المرور..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-11 pl-11 py-3.5 bg-slate-900 text-white rounded-xl border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition duration-200 text-sm placeholder:text-slate-500"
                required
              />

              {/* زر إظهار/إخفاء الرمز على اليسار */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition"
                title={showPassword ? "إخفاء الرمز" : "إظهار الرمز"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* زر الدخول مع السهم */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-blue-600/20 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري الدخول...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول إلى اللوحة</span>
                  <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* تذييل الصفحة */}
      <footer className="text-slate-500 text-[11px] tracking-wide text-center z-10">
        Secured by Live Store Management System © {new Date().getFullYear()}
      </footer>

    </div>
  );
}