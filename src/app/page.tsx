"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
      }
    });
    // On initial load, if there's no user after a short delay, redirect.
    // This handles the case where the listener takes a moment to fire.
    const timer = setTimeout(() => {
      if (auth.currentUser === null) {
        router.push('/login');
      }
    }, 500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    }
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
         <div className="w-full max-w-md mx-auto">
          <Skeleton className="h-[740px] w-full rounded-2xl bg-card/80" />
        </div>
      </div>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      {isAuthenticated && (
        <>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="fixed top-4 left-4 text-muted-foreground hover:bg-destructive/10 hover:text-destructive z-10 font-medium"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          <Dashboard />
        </>
      )}
    </main>
  );
}
