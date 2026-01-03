import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { insertTripSchema, type CreateTripRequest } from "@shared/schema";
import { useCreateTrip } from "@/hooks/use-trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plane, IdCard, Wallet, Users } from "lucide-react";
import { z } from "zod";

// Splitting the schema for steps
const step1Schema = insertTripSchema.pick({ passport: true, residence: true });
const step2Schema = insertTripSchema.pick({ destination: true, dates: true });
const step3Schema = insertTripSchema.pick({ budget: true, groupSize: true });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

export default function CreateTrip() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<Partial<CreateTripRequest>>({});
  
  const createTrip = useCreateTrip();

  const handleNext = (data: any) => {
    const updatedData = { ...formData, ...data };
    setFormData(updatedData);
    
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Final submission
      createTrip.mutate(updatedData as CreateTripRequest, {
        onSuccess: (data) => {
          setLocation(`/trips/${data.id}`);
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span className={step >= 1 ? "text-primary" : ""}>Profile</span>
            <span className={step >= 2 ? "text-primary" : ""}>Destination</span>
            <span className={step >= 3 ? "text-primary" : ""}>Budget</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "33%" }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <Card className="shadow-2xl border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-6 text-white">
            <h2 className="text-2xl font-display font-bold">
              {step === 1 && "Traveler Profile"}
              {step === 2 && "Trip Details"}
              {step === 3 && "Feasibility Check"}
            </h2>
            <p className="text-slate-400">
              {step === 1 && "Tell us about your citizenship for visa checks."}
              {step === 2 && "Where and when do you want to go?"}
              {step === 3 && "Set your constraints to analyze feasibility."}
            </p>
          </div>
          
          <CardContent className="p-6 pt-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <Step1Form 
                  key="step1" 
                  defaultValues={formData as Step1Data} 
                  onSubmit={handleNext} 
                />
              )}
              {step === 2 && (
                <Step2Form 
                  key="step2" 
                  defaultValues={formData as Step2Data} 
                  onBack={() => setStep(1)} 
                  onSubmit={handleNext} 
                />
              )}
              {step === 3 && (
                <Step3Form 
                  key="step3" 
                  defaultValues={formData as Step3Data} 
                  onBack={() => setStep(2)} 
                  onSubmit={handleNext} 
                  isLoading={createTrip.isPending} 
                />
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step1Form({ defaultValues, onSubmit }: { defaultValues: Step1Data, onSubmit: (data: Step1Data) => void }) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: defaultValues || { passport: "", residence: "" }
  });

  return (
    <motion.form 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(onSubmit)} 
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="passport">IdCard Country</Label>
        <div className="relative">
          <IdCard className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input id="passport" placeholder="e.g. United States, France, India" className="pl-10 h-12" {...form.register("passport")} />
        </div>
        {form.formState.errors.passport && <p className="text-destructive text-sm">{form.formState.errors.passport.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="residence">Current Residence (Optional)</Label>
        <div className="relative">
          <div className="absolute left-3 top-3 h-5 w-5 text-slate-400 flex items-center justify-center font-bold">R</div>
          <Input id="residence" placeholder="e.g. United Kingdom" className="pl-10 h-12" {...form.register("residence")} />
        </div>
        <p className="text-xs text-muted-foreground">Used to check for visa exemptions based on residence permits.</p>
      </div>

      <div className="pt-4">
        <Button type="submit" className="w-full" size="lg">Next Step</Button>
      </div>
    </motion.form>
  );
}

function Step2Form({ defaultValues, onBack, onSubmit }: { defaultValues: Step2Data, onBack: () => void, onSubmit: (data: Step2Data) => void }) {
  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: defaultValues || { destination: "", dates: "" }
  });

  return (
    <motion.form 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(onSubmit)} 
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="destination">Destination</Label>
        <div className="relative">
          <Plane className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input id="destination" placeholder="e.g. Kyoto, Japan" className="pl-10 h-12" {...form.register("destination")} />
        </div>
        {form.formState.errors.destination && <p className="text-destructive text-sm">{form.formState.errors.destination.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dates">Travel Dates</Label>
        <Input id="dates" type="text" placeholder="e.g. October 10-20, 2024" className="h-12" {...form.register("dates")} />
        {form.formState.errors.dates && <p className="text-destructive text-sm">{form.formState.errors.dates.message}</p>}
      </div>

      <div className="pt-4 flex gap-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg" className="flex-1">Back</Button>
        <Button type="submit" size="lg" className="flex-1">Next Step</Button>
      </div>
    </motion.form>
  );
}

function Step3Form({ defaultValues, onBack, onSubmit, isLoading }: { defaultValues: Step3Data, onBack: () => void, onSubmit: (data: Step3Data) => void, isLoading: boolean }) {
  const form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: defaultValues || { budget: 2000, groupSize: 1 }
  });

  return (
    <motion.form 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(onSubmit)} 
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="budget">Total Budget (USD)</Label>
        <div className="relative">
          <Wallet className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input 
            id="budget" 
            type="number" 
            placeholder="5000" 
            className="pl-10 h-12" 
            {...form.register("budget", { valueAsNumber: true })} 
          />
        </div>
        {form.formState.errors.budget && <p className="text-destructive text-sm">{form.formState.errors.budget.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="groupSize">Travelers</Label>
        <div className="relative">
          <Users className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input 
            id="groupSize" 
            type="number" 
            min="1" 
            placeholder="1" 
            className="pl-10 h-12" 
            {...form.register("groupSize", { valueAsNumber: true })} 
          />
        </div>
      </div>

      <div className="pt-4 flex gap-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg" className="flex-1" disabled={isLoading}>Back</Button>
        <Button type="submit" size="lg" variant="gradient" className="flex-[2]" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Analyze Feasibility"
          )}
        </Button>
      </div>
    </motion.form>
  );
}
