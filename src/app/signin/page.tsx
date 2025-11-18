'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api-client';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await authApi.getMe();
        // User is authenticated, redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        // User is not authenticated, stay on signin page
      }
    };
    checkAuth();
  }, [router]);

  // Check for OAuth errors
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleGoogleSignIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get redirect URL from search params or default to dashboard
    const redirect = searchParams.get('redirect') || '/dashboard';
    
    // Redirect to backend OAuth endpoint
    window.location.href = `/api/auth/signin?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="relative w-full h-screen bg-[#1f1f1f] flex items-center justify-center overflow-hidden p-6">
      <div className="flex items-center justify-center gap-5 w-full max-w-[97vw] h-full max-h-[95vh]">
        {/* Left Card - Orange Card */}
        <div className="relative aspect-square h-full max-h-[95vh] rounded-[10px] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 w-full h-full">
            <Image
              src="/assets/orange-gradient-bg.png"
              alt="Background"
              fill
              className="object-cover"
              style={{ objectPosition: 'left center' }}
              priority
            />
          </div>

          {/* Content */}
          <div className="absolute bottom-[20%] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-7 w-[40%]">
            {/* Logo */}
            <div className="w-full relative">
              <Image
                src="/assets/logo.svg"
                alt="Aalap.ai Logo"
                width={411}
                height={148}
                className="w-full h-auto"
              />
            </div>

            {/* Tagline */}
            <p
              className="text-[#efbcac] text-center leading-[1.32] w-[80%]"
              style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.8vw, 18px)' }}
            >
              At Aalap, we're making that possible: fast, personal, and deeply human in its emotional depth.
            </p>
          </div>
        </div>

        {/* Right Card - Sign In Form */}
        <div
          className="aspect-[823/1026] h-full max-h-[95vh] rounded-[10px] flex items-center justify-center relative"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)'
          }}
        >
          <div className="flex flex-col items-start justify-center w-[62%] h-auto py-8">
            {/* Title */}
            <div className="flex flex-col gap-3 mb-8 w-full">
              <h1
                className="text-white leading-[1.28] text-center"
                style={{ fontFamily: 'var(--font-poppins)', fontWeight: 500, fontSize: 'clamp(32px, 4.3vw, 44px)' }}
              >
                Sign in
              </h1>
              <p
                className="text-[#969696] leading-[1.32]"
                style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.8vw, 18px)' }}
              >
                Please login to continue to your account.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-[10px] text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Form */}
            <div className="flex flex-col gap-5 w-full">
              {/* Email Input */}
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-4 bg-transparent border border-[#d9d9d9] rounded-[10px] text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#367aff]"
                  style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.8vw, 18px)' }}
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-4 bg-transparent border border-[#d9d9d9] rounded-[10px] text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#367aff]"
                  style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.8vw, 18px)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <Image
                    src="/assets/eye-icon.svg"
                    alt="Toggle password"
                    width={24}
                    height={24}
                  />
                </button>
              </div>

              {/* Keep me logged in */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setKeepLoggedIn(!keepLoggedIn)}
                  className="relative w-5 h-5 shrink-0 cursor-pointer"
                  aria-label="Keep me logged in"
                >
                  {keepLoggedIn ? (
                    <div className="w-5 h-5 border-2 border-[#367aff] rounded flex items-center justify-center bg-[#367aff]">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7L6 11L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : (
                    <Image
                      src="/assets/checkbox-unchecked.svg"
                      alt="Checkbox"
                      width={20}
                      height={20}
                    />
                  )}
                </button>
                <label
                  className="text-white leading-[1.48] cursor-pointer"
                  onClick={() => setKeepLoggedIn(!keepLoggedIn)}
                  style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.6vw, 16px)' }}
                >
                  Keep me logged in
                </label>
              </div>

              {/* Sign In Button */}
              <button
                className="w-full py-4 bg-[#367aff] rounded-[10px] text-white hover:bg-[#2968e6] transition-colors"
                style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(14px, 1.8vw, 18px)' }}
              >
                Sign in
              </button>

              {/* Divider */}
              <div className="flex items-center gap-2 w-full my-2">
                <div className="flex-1 h-px">
                  <Image
                    src="/assets/divider-line.svg"
                    alt="divider"
                    width={100}
                    height={1}
                    className="w-full"
                  />
                </div>
                <span
                  className="text-[#6e6e6e] leading-[1.48]"
                  style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(14px, 1.6vw, 16px)' }}
                >
                  or
                </span>
                <div className="flex-1 h-px">
                  <Image
                    src="/assets/divider-line.svg"
                    alt="divider"
                    width={100}
                    height={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-4 bg-white border border-[#e6e8e7] rounded-[10px] text-[#191818] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(14px, 1.8vw, 18px)' }}
              >
                <span>Sign in with Google</span>
                <Image
                  src="/assets/google-icon.svg"
                  alt="Google"
                  width={24}
                  height={24}
                />
              </button>
            </div>

            {/* No Create Account - removed as per requirements */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="relative w-full h-screen bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
