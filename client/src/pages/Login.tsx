import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { FcGoogle } from "react-icons/fc";
import { MapPin, Shield, Zap } from "lucide-react";

export default function Login() {
  const { user, isLoading, login } = useAuth();
  const [, navigate] = useLocation();

  // Already logged in → go home
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  // Check for error param from OAuth callback failure
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("error");

  return (
    <div className="min-h-screen bg-[#0F0F14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00B4D8]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-[#0077B6]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00B4D8] to-[#0077B6] mb-5 shadow-[0_0_40px_rgba(0,180,216,0.4)]">
            <MapPin className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Orbit</h1>
          <p className="text-[#8899A6] mt-2 text-base">
            Real-time location sharing, reimagined
          </p>
        </div>

        {/* Login card */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-[#8899A6] text-sm mb-8">
            Sign in to manage your fleets and share your location
          </p>

          {/* Error notice */}
          {authError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              Authentication failed. Please try again.
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-[#1a1a2e] font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] cursor-pointer"
          >
            <FcGoogle className="w-5 h-5 flex-shrink-0" />
            <span>Continue with Google</span>
          </button>

          <p className="text-center text-[#556070] text-xs mt-5">
            By signing in you agree to our{" "}
            <span className="text-[#00B4D8] cursor-pointer hover:underline">Terms of Service</span>
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: <MapPin className="w-4 h-4" />, label: "Live Tracking" },
            { icon: <Shield className="w-4 h-4" />, label: "Secure" },
            { icon: <Zap className="w-4 h-4" />, label: "Real-time" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 bg-[#161B22]/60 border border-[#30363D] rounded-xl py-3 px-2"
            >
              <span className="text-[#00B4D8]">{icon}</span>
              <span className="text-[#8899A6] text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
