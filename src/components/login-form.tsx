"use client";

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Lock } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('gavinamosj@gmail.com');
  const [password, setPassword] = useState('ArroFeeder123');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please enter both email and password."
      });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Welcome back!", description: "Arro Is Feeling Hungry ૮₍  ˶•⤙•˶ ₎ა" });
      router.push('/');
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Login Failed", 
        description: "Invalid email or password." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-border/20 shadow-2xl rounded-2xl overflow-hidden">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto bg-muted w-14 h-14 rounded-full flex items-center justify-center mb-4 border">
          <Lock className="text-muted-foreground w-6 h-6" />
        </div>
        <CardTitle className="text-3xl font-headline font-bold tracking-tight text-foreground">Admin Login</CardTitle>
        <CardDescription className="pt-1 text-muted-foreground font-medium">
        ૮₍ ´˶• ᴥ •˶` ₎ა
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="bg-background/50 border-2 border-input/50 h-12 text-base focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="bg-background/50 border-2 border-input/50 h-12 text-base focus-visible:ring-primary"
            />
          </div>
          <Button type="submit" className="w-full h-14 font-bold text-lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
