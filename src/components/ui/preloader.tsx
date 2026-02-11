import { Logo } from "@/components/ui/logo";
import { User } from "lucide-react";

interface PreloaderProps {
  title?: string;
  subtitle?: string;
  showUserIcon?: boolean;
  variant?: "default" | "compact";
}

export function Preloader({ 
  title = "RCF FUTA Portal", 
  subtitle = "Loading your experience...", 
  showUserIcon = false,
  variant = "default"
}: PreloaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50 to-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rcf-navy/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Main loader content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo with pulsing animation */}
        <div className="animate-pulse">
          <Logo
            variant="colored"
            width={variant === "compact" ? 100 : 120}
            className="mx-auto drop-shadow-lg"
          />
        </div>

        {/* Loading text */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {showUserIcon && (
              <div className="w-6 h-6 bg-rcf-navy rounded-full flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
            )}
            <h2 className={`${variant === "compact" ? "text-xl" : "text-2xl"} font-bold text-gray-800 animate-fade-in`}>
              {title}
            </h2>
          </div>
          <p className="text-gray-600 animate-fade-in animation-delay-200">
            {subtitle}
          </p>
        </div>

        {/* Enhanced loading spinner */}
        <div className="relative">
          {/* Outer ring */}
          <div className={`${variant === "compact" ? "w-12 h-12" : "w-16 h-16"} border-4 border-rcf-navy/20 rounded-full animate-pulse`}></div>
          {/* Inner spinning ring */}
          <div className={`absolute top-0 left-0 ${variant === "compact" ? "w-12 h-12" : "w-16 h-16"} border-4 border-transparent border-t-rcf-navy border-r-rcf-navy rounded-full animate-spin`}></div>
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-rcf-navy rounded-full animate-pulse"></div>
        </div>

        {/* Progress bar */}
        <div className={`${variant === "compact" ? "w-48" : "w-64"} h-1 bg-gray-200 rounded-full overflow-hidden`}>
          <div className="h-full bg-linear-to-r from-rcf-navy to-blue-500 rounded-full animate-loading-bar"></div>
        </div>

        {/* Loading dots */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-rcf-navy rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-rcf-navy rounded-full animate-bounce animation-delay-100"></div>
          <div className="w-2 h-2 bg-rcf-navy rounded-full animate-bounce animation-delay-200"></div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-blue-300/30 rounded-full animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-rcf-navy/20 rounded-full animate-float-delayed"></div>
        <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-blue-400/40 rounded-full animate-float"></div>
      </div>
    </div>
  );
}

// Compact version for use within existing layouts
export function CompactPreloader({ 
  title = "Loading...", 
  subtitle = "Please wait", 
  showUserIcon = false 
}: Omit<PreloaderProps, "variant">) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Logo */}
      <div className="animate-pulse">
        <Logo
          variant="colored"
          width={80}
          className="mx-auto drop-shadow-lg"
        />
      </div>

      {/* Loading text */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {showUserIcon && (
            <div className="w-5 h-5 bg-rcf-navy rounded-full flex items-center justify-center">
              <User className="h-3 w-3 text-white" />
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800 animate-fade-in">
            {title}
          </h3>
        </div>
        <p className="text-gray-600 text-sm animate-fade-in animation-delay-200">
          {subtitle}
        </p>
      </div>

      {/* Compact spinner */}
      <div className="relative">
        <div className="w-10 h-10 border-3 border-rcf-navy/20 rounded-full animate-pulse"></div>
        <div className="absolute top-0 left-0 w-10 h-10 border-3 border-transparent border-t-rcf-navy border-r-rcf-navy rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-rcf-navy rounded-full animate-pulse"></div>
      </div>

      {/* Compact progress bar */}
      <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-linear-to-r from-rcf-navy to-blue-500 rounded-full animate-loading-bar"></div>
      </div>
    </div>
  );
}