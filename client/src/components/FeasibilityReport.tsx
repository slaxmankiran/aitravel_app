import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, ShieldCheck, Wallet, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { type TripResponse, type FeasibilityReport } from "@shared/schema";

interface Props {
  trip: TripResponse;
}

export function FeasibilityReportView({ trip }: Props) {
  const report = trip.feasibilityReport as unknown as FeasibilityReport;
  
  if (!report) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case "yes": case "ok": case "safe": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "warning": case "tight": case "caution": return "text-amber-600 bg-amber-50 border-amber-200";
      case "no": case "issue": case "impossible": case "danger": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "yes": case "ok": case "safe": return <CheckCircle className="w-6 h-6" />;
      case "warning": case "tight": case "caution": return <AlertTriangle className="w-6 h-6" />;
      case "no": case "issue": case "impossible": case "danger": return <XCircle className="w-6 h-6" />;
      default: return <AlertTriangle className="w-6 h-6" />;
    }
  };

  const budgetData = [
    { name: 'Estimated Cost', value: report.breakdown.budget.estimatedCost },
    { name: 'Remaining Budget', value: Math.max(0, trip.budget - report.breakdown.budget.estimatedCost) },
  ];
  
  const budgetColors = ['#6366f1', '#e2e8f0'];

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className={`border-l-8 overflow-hidden shadow-lg ${
          report.overall === 'yes' ? 'border-l-emerald-500' : 
          report.overall === 'warning' ? 'border-l-amber-500' : 'border-l-red-500'
        }`}>
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <h1 className="text-9xl font-bold font-display">{report.score}</h1>
          </div>
          
          <CardHeader className="relative pb-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall Feasibility</p>
                <CardTitle className="text-3xl">
                  {report.overall === 'yes' ? 'Good to Go!' : 
                   report.overall === 'warning' ? 'Proceed with Caution' : 'Not Recommended'}
                </CardTitle>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-bold ${getStatusColor(report.overall)}`}>
                {getStatusIcon(report.overall)}
                <span>Score: {report.score}/100</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-lg text-slate-700 leading-relaxed max-w-2xl">{report.summary}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visa Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">Visa Status</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${getStatusColor(report.breakdown.visa.status)}`}>
                {getStatusIcon(report.breakdown.visa.status)}
                <span className="capitalize">{report.breakdown.visa.status.replace('-', ' ')}</span>
              </div>
              <p className="text-slate-600 text-sm">{report.breakdown.visa.reason}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Budget Analysis */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">Budget Check</h3>
              </div>
            </CardHeader>
            <CardContent>
               <div className="flex justify-between items-end mb-4">
                 <div>
                   <p className="text-xs text-muted-foreground uppercase">Estimated</p>
                   <p className="text-xl font-bold font-mono">${report.breakdown.budget.estimatedCost.toLocaleString()}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs text-muted-foreground uppercase">Your Budget</p>
                   <p className="text-lg font-mono text-slate-500">${trip.budget.toLocaleString()}</p>
                 </div>
               </div>
               
               <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                 <div 
                   className={`h-full ${report.breakdown.budget.estimatedCost > trip.budget ? 'bg-red-500' : 'bg-indigo-500'}`}
                   style={{ width: `${Math.min(100, (report.breakdown.budget.estimatedCost / trip.budget) * 100)}%` }}
                 />
               </div>
               <p className="text-slate-600 text-sm mt-3">{report.breakdown.budget.reason}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Safety Assessment */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">Safety Risk</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${getStatusColor(report.breakdown.safety.status)}`}>
                {getStatusIcon(report.breakdown.safety.status)}
                <span className="capitalize">{report.breakdown.safety.status}</span>
              </div>
              <p className="text-slate-600 text-sm">{report.breakdown.safety.reason}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
