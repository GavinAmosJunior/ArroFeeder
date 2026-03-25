"use client";

import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PawPrint, Calendar, Clock, Trash2, Loader2, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';

export type ScheduleItem = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
};

const ScheduleSchema = z.object({
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Please use HH:MM format.",
  }),
});

export default function Dashboard() {
  const { toast } = useToast();
  const [lastFed, setLastFed] = useState<number | null>(null);
  const [foodLevel, setFoodLevel] = useState<number>(0);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [mounted, setMounted] = useState(false);

  const form = useForm<z.infer<typeof ScheduleSchema>>({
    resolver: zodResolver(ScheduleSchema),
    defaultValues: { time: "" },
  });

  useEffect(() => {
    setMounted(true);

    const lastFedRef = ref(database, 'petfeeder/last_feed');
    const scheduleRef = ref(database, 'petfeeder/schedule');
    const foodLevelRef = ref(database, 'petfeeder/food_level');

    const unsubscribeLastFed = onValue(lastFedRef, (snapshot) => {
      const data = snapshot.val();
      setLastFed(typeof data === 'number' ? data : null);
      setIsLoading(false);
    });

    const unsubscribeFood = onValue(foodLevelRef, (snapshot) => {
      setFoodLevel(snapshot.val() || 0);
    });

    const unsubscribeSchedule = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object' && 'hour' in data && data.enabled) {
        setActiveSchedule({
          id: 'current',
          hour: Number(data.hour),
          minute: Number(data.minute),
          enabled: Boolean(data.enabled)
        });
      } else {
        setActiveSchedule(null);
      }
    });

    return () => {
      unsubscribeLastFed();
      unsubscribeSchedule();
      unsubscribeFood();
    };
  }, []);

  const handleFeedNow = async () => {
    if (isFeeding) return;
    setIsFeeding(true);
    try {
      // The ESP32 will set the last_feed timestamp. We only trigger the feed_now flag.
      await update(ref(database, 'petfeeder'), { 
        feed_now: true,
      });
      toast({ title: "", description: "Arro's Love For You +1 ｡ ₊°༺❤︎༻°₊ ｡" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Database unreachable." });
    } finally {
      // The device will reset the flag. We can add a timeout for the UI.
      setTimeout(() => setIsFeeding(false), 3000); 
    }
  };

  const handleAddSchedule = async (values: z.infer<typeof ScheduleSchema>) => {
    setIsSubmittingSchedule(true);
    try {
      const [hour, minute] = values.time.split(':').map(Number);
      await update(ref(database, 'petfeeder/schedule'), {
        hour,
        minute,
        enabled: true
      });
      toast({ title: "Schedule Saved", description: `Feeding set for ${values.time}` });
      form.reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save schedule" });
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    try {
      await update(ref(database, 'petfeeder/schedule'), {
        enabled: false,
        hour: 0,
        minute: 0
      });
      toast({ title: "Schedule Removed", description: "Routine has been disabled." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not remove schedule." });
    }
  };

  const formatTime = (hour?: number, minute?: number) => {
    if (hour === undefined || minute === undefined) return "--:--";
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getLastFedText = () => {
    if (!mounted || lastFed === null) return "Waiting...";
    if (lastFed === 0) return "Pending first feed...";
    try {
      // Firebase `setTimestamp` uses milliseconds, so we don't need to * 1000
      return `${formatDistanceToNow(lastFed)} ago`;
    } catch (e) {
      return "Just now";
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-xl border-border/30 shadow-2xl rounded-2xl overflow-hidden">
      <CardHeader className="text-center pb-2 relative">
        <CardTitle className="text-3xl font-headline font-bold tracking-tight text-primary">ArroFeeder</CardTitle>
        <CardDescription className="pt-1 text-muted-foreground font-medium">૮₍ ´˶• ᴥ •˶` ₎ა</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
            <Info className="w-3.5 h-3.5" />
            Feeder Status
          </h3>
          <div className="p-5 bg-background/40 rounded-xl border border-border/20 shadow-inner space-y-4">
            {isLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-5 w-3/4 bg-muted/50" />
                <Skeleton className="h-5 w-1/2 bg-muted/50" />
                <Skeleton className="h-5 w-2/3 bg-muted/50" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground/80">Last Feeding</span>
                  <span className="text-sm font-semibold text-primary">{getLastFedText()}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground/80">Food Level</span>
                    <span className={`text-sm font-bold font-code ${foodLevel < 20 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
                      {foodLevel}%
                    </span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden border border-border/20">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${foodLevel < 20 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${foodLevel}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground/80">Active Schedule</span>
                  <span className="text-sm font-semibold text-primary">
                    {activeSchedule?.enabled ? "1 active routine" : "None"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Button 
            size="lg" 
            className="h-16 text-lg font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all duration-300 transform hover:scale-105" 
            onClick={handleFeedNow} 
            disabled={isFeeding}
          >
            {isFeeding ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <PawPrint className="mr-3 h-6 w-6" />}
            Feed Now
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="h-16 text-lg font-semibold rounded-xl border-2 hover:bg-accent/10 transition-all duration-300 transform hover:scale-105">
                <Calendar className="mr-3 h-6 w-6 text-primary" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card/90 backdrop-blur-2xl border-border/30 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-headline">Manage Schedule</DialogTitle>
                <DialogDescription>Setup ArroFeeder's Routine</DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddSchedule)} className="flex items-end gap-3 py-6">
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="flex-grow">
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Select Time</FormLabel>
                        <FormControl>
                          <Input type="time" className="bg-background/70 border-2 border-border focus-visible:ring-primary h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSubmittingSchedule} className="h-11 px-6 font-bold shadow-md">
                    {isSubmittingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </form>
              </Form>

              <Separator className="bg-border/30" />

              <div className="space-y-3 pt-4">
                <h4 className="text-xs font-bold uppercase text-muted-foreground px-1">Active Routine</h4>
                <div className="space-y-2">
                  {activeSchedule?.enabled ? (
                    <div className="flex items-center justify-between bg-background/60 p-3 rounded-xl border border-border/20 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-code text-xl font-medium text-primary">
                          {formatTime(activeSchedule.hour, activeSchedule.minute)}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleDeleteSchedule}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
                      <Clock className="w-10 h-10 mb-2" />
                      <p className="text-sm font-medium">No routine scheduled.</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full font-bold h-11">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
