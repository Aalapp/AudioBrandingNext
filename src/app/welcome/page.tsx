'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api-client';

export default function WelcomePage() {
  const router = useRouter();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await authApi.getMe();
        // User is authenticated, redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        // User is not authenticated, stay on welcome page
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="relative w-full h-screen bg-[#1f1f1f] flex items-center justify-center overflow-hidden p-6">
      <div className="flex items-center justify-center gap-5 w-full max-w-[97vw] h-full max-h-[95vh]">
        {/* Left Card - Orange Card */}
        <div className="relative aspect-square h-full max-h-[95vh] rounded-[10px] overflow-hidden">
          {/* Background Image - positioned to show the gradient properly */}
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

        {/* Right Card - Info Card */}
        <div
          className="aspect-[823/1026] h-full max-h-[95vh] rounded-[10px] flex items-center justify-center relative"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)'
          }}
        >
          <div className="flex flex-col items-center justify-between h-[55%] w-[62%]">
            {/* Main Content */}
            <div className="flex flex-col gap-12 w-full">
              {/* Title and Description */}
              <div className="flex flex-col gap-8 w-full">
                {/* Greeting and Title */}
                <div className="flex flex-col gap-3 leading-[1.28] text-white" style={{ fontSize: 'clamp(32px, 4.3vw, 44px)' }}>
                  <div className="flex items-center gap-2" style={{ fontFamily: 'Times New Roman, serif', fontStyle: 'italic' }}>
                    <span>Hey</span>
                    <span>👋</span>
                  </div>
                  <h1 style={{ fontFamily: 'var(--font-poppins)', fontWeight: 500 }}>
                    Welcome to Aalap
                  </h1>
                </div>

                {/* Description */}
                <p
                  className="text-[#a3a3a3] leading-[1.44]"
                  style={{ fontFamily: 'var(--font-poppins)', fontSize: 'clamp(16px, 2vw, 20px)' }}
                >
                  Let's get to know you so you can start directing your music
                </p>
              </div>

              {/* Checkbox */}
              <div className="flex items-start gap-2">
                <button
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className="relative w-5 h-5 shrink-0 cursor-pointer mt-0.5"
                  aria-label="Agree to terms"
                >
                  {agreedToTerms ? (
                    <div className="w-5 h-5 border-2 border-[#d75c35] rounded flex items-center justify-center bg-[#d75c35]">
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
                <p
                  className="text-[#a3a3a3] leading-[1.32]"
                  style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(14px, 1.8vw, 18px)' }}
                >
                  I agree to the Terms & Conditions and Privacy Policy
                </p>
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              disabled={!agreedToTerms}
              onClick={() => {
                if (!agreedToTerms) return;
                router.push('/signin');
              }}
              className="w-[65%] rounded-[40px] border border-[#d75c35] bg-[#1f1f1f]/90 text-white transition enabled:hover:bg-[#d75c35]/20 enabled:hover:shadow-[0_0_30px_rgba(215,92,53,0.45)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              style={{
                height: 'clamp(50px, 6.2vw, 63.298px)',
                boxShadow: '0 0 20px rgba(215, 92, 53, 0.35)',
                fontFamily: 'var(--font-poppins)',
                fontSize: 'clamp(18px, 2.3vw, 23.02px)',
              }}
            >
              Let's Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
