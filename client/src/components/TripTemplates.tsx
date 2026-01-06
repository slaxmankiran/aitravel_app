/**
 * Trip Templates Component
 * Browse and use public trip templates
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Star,
  Users,
  Clock,
  Copy,
  ArrowRight,
  Heart,
  MapPin,
  Calendar,
  Wallet,
  Loader2,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';

interface TripTemplate {
  id: number;
  destination: string;
  templateName: string;
  templateDescription: string;
  templateCategory: string;
  dates: string;
  budget: number;
  currency: string;
  groupSize: number;
  rating: number;
  ratingCount: number;
  useCount: number;
  itinerary: any;
  createdAt: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'romantic', label: 'Romantic', icon: Heart },
  { id: 'adventure', label: 'Adventure', icon: MapPin },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'luxury', label: 'Luxury', icon: Star },
];

// Template card images by destination
const TEMPLATE_IMAGES: Record<string, string> = {
  'paris': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800',
  'tokyo': 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800',
  'bali': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  'rome': 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=800',
  'new york': 'https://images.pexels.com/photos/802024/pexels-photo-802024.jpeg?auto=compress&cs=tinysrgb&w=800',
  'default': 'https://images.pexels.com/photos/3278215/pexels-photo-3278215.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function getTemplateImage(destination: string): string {
  const key = destination.toLowerCase();
  for (const [k, v] of Object.entries(TEMPLATE_IMAGES)) {
    if (key.includes(k)) return v;
  }
  return TEMPLATE_IMAGES['default'];
}

export function TripTemplatesGrid() {
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = selectedCategory === 'all' || t.templateCategory === selectedCategory;
    const matchesSearch = !searchQuery ||
      t.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.templateName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = async (template: TripTemplate) => {
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to use template');

      const data = await res.json();

      toast({
        title: 'Template applied!',
        description: 'Redirecting to your new trip...',
      });

      setLocation(`/trips/${data.tripId}`);
    } catch (err) {
      console.error('Use template error:', err);
      toast({
        title: 'Error',
        description: 'Failed to use template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search destinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
          <p className="text-slate-400">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template, idx) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template)}
              delay={idx * 0.1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  delay,
}: {
  template: TripTemplate;
  onUse: () => void;
  delay: number;
}) {
  const imageUrl = getTemplateImage(template.destination);
  const itinerary = template.itinerary as any;
  const daysCount = itinerary?.days?.length || 7;

  const currencySymbol = getCurrencySymbol(template.currency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs font-medium text-white capitalize">
            {template.templateCategory}
          </span>
        </div>

        {/* Use Count */}
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white">
            <Copy className="w-3 h-3" />
            {template.useCount} uses
          </span>
        </div>

        {/* Destination */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-xl font-bold text-white mb-1">{template.destination}</h3>
          <p className="text-sm text-white/80 line-clamp-1">{template.templateName}</p>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">
          {template.templateDescription}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <Clock className="w-4 h-4 text-slate-500 mx-auto mb-1" />
            <span className="text-sm text-white">{daysCount} days</span>
          </div>
          <div className="text-center">
            <Users className="w-4 h-4 text-slate-500 mx-auto mb-1" />
            <span className="text-sm text-white">{template.groupSize} people</span>
          </div>
          <div className="text-center">
            <Wallet className="w-4 h-4 text-slate-500 mx-auto mb-1" />
            <span className="text-sm text-white">{currencySymbol}{template.budget}</span>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(template.rating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-600'
                }`}
              />
            ))}
            <span className="text-sm text-slate-400 ml-1">
              ({template.ratingCount})
            </span>
          </div>
        </div>

        <Button
          onClick={onUse}
          className="w-full bg-primary hover:bg-primary/90"
        >
          Use This Template
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Template Page Component
 */
export function TemplatesPage() {
  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Trip Templates
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Start with a pre-planned itinerary from our community and customize it to your preferences.
            </p>
          </motion.div>
        </div>

        <TripTemplatesGrid />
      </div>
    </div>
  );
}

// Currency helper
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', THB: '฿'
  };
  return symbols[currency] || currency;
}
