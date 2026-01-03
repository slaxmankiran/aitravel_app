import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Globe, ShieldCheck, Banknote } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold font-display">
              V
            </div>
            <span className="font-display font-bold text-xl tracking-tight">VoyageAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/create">
              <Button size="sm" variant="default" className="rounded-full">Start Planning</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Now powered by GPT-5.1 Analysis
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-extrabold text-slate-900 leading-tight mb-8">
                Plan Smart. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Travel Safe.</span>
              </h1>
              <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                The world's first feasibility-first travel planner. We check visa requirements, 
                analyze budgets, and assess safety risks <em>before</em> generating your perfect itinerary.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/create">
                  <Button size="lg" variant="gradient" className="w-full sm:w-auto text-lg px-10 h-16">
                    Analyze My Trip <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 border-slate-300">
                  View Sample Report
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Features Grid */}
          <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard 
              icon={<Globe className="w-8 h-8 text-blue-500" />}
              title="Visa Intelligence"
              description="Instantly verify entry requirements based on your specific passport and residency."
            />
            <FeatureCard 
              icon={<Banknote className="w-8 h-8 text-green-500" />}
              title="Budget Reality Check"
              description="Get data-driven cost estimates for flights, accommodation, and daily expenses."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-8 h-8 text-rose-500" />}
              title="Risk Assessment"
              description="Real-time safety analysis including political stability and health advisories."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">© 2024 VoyageAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-1 transition-transform duration-300"
    >
      <div className="mb-6 bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-display font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
