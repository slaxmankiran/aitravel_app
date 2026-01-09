/**
 * AI-Powered Packing List Generator
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Luggage,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle,
  Sun,
  Cloud,
  Umbrella,
  Snowflake,
} from 'lucide-react';

interface PackingItem {
  id: string;
  category: string;
  name: string;
  quantity: number;
  packed: boolean;
  essential: boolean;
}

interface PackingListProps {
  tripId: number;
  destination: string;
  days: number;
  climate?: 'tropical' | 'cold' | 'temperate' | 'desert';
}

const CLIMATE_ICONS = {
  tropical: Sun,
  cold: Snowflake,
  temperate: Cloud,
  desert: Sun,
};

const DEFAULT_CATEGORIES = [
  { name: 'Clothing', icon: '👕' },
  { name: 'Toiletries', icon: '🧴' },
  { name: 'Electronics', icon: '📱' },
  { name: 'Documents', icon: '📄' },
  { name: 'Medications', icon: '💊' },
  { name: 'Misc', icon: '🎒' },
];

export function PackingList({ tripId, destination, days, climate = 'temperate' }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Clothing');
  const { toast } = useToast();

  const generatePackingList = async () => {
    setIsGenerating(true);

    try {
      const res = await fetch('/api/packing-list/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, destination, days, climate }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          packed: false,
        })));
        toast({ title: 'Packing list generated!' });
      } else {
        // Fallback list if API fails
        setItems(getDefaultPackingList(days, climate));
        toast({ title: 'Packing list created!' });
      }
    } catch (err) {
      setItems(getDefaultPackingList(days, climate));
      toast({ title: 'Packing list created!' });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePacked = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, packed: !item.packed } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    setItems([...items, {
      id: Math.random().toString(36).substr(2, 9),
      category: selectedCategory,
      name: newItemName.trim(),
      quantity: 1,
      packed: false,
      essential: false,
    }]);
    setNewItemName('');
  };

  const packedCount = items.filter(i => i.packed).length;
  const progress = items.length > 0 ? (packedCount / items.length) * 100 : 0;

  const ClimateIcon = CLIMATE_ICONS[climate];

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Luggage className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Packing List</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <ClimateIcon className="w-3 h-3" />
              {days} days • {climate} climate
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <Button
            onClick={generatePackingList}
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate List
              </>
            )}
          </Button>
        ) : (
          <div className="text-right">
            <p className="text-sm text-white font-medium">{packedCount}/{items.length} packed</p>
            <div className="w-24 h-2 bg-slate-700 rounded-full mt-1">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="space-y-4">
          {DEFAULT_CATEGORIES.map(cat => {
            const categoryItems = items.filter(i => i.category === cat.name);
            if (categoryItems.length === 0) return null;

            return (
              <div key={cat.name}>
                <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <span>{cat.icon}</span>
                  {cat.name}
                </h4>
                <div className="space-y-2">
                  {categoryItems.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        item.packed ? 'bg-green-500/10' : 'bg-slate-700/50'
                      }`}
                    >
                      <Checkbox
                        checked={item.packed}
                        onCheckedChange={() => togglePacked(item.id)}
                      />
                      <span className={`flex-1 text-sm ${
                        item.packed ? 'text-slate-400 line-through' : 'text-white'
                      }`}>
                        {item.name}
                        {item.quantity > 1 && <span className="text-slate-500"> x{item.quantity}</span>}
                      </span>
                      {item.essential && (
                        <span className="text-xs text-amber-500">Essential</span>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-slate-600 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-slate-500" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add Item */}
          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-700 border-none rounded-lg text-white text-sm"
            >
              {DEFAULT_CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Add item..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              className="flex-1 px-3 py-2 bg-slate-700 border-none rounded-lg text-white text-sm placeholder:text-slate-500"
            />
            <Button onClick={addItem} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Default packing list based on trip duration and climate
function getDefaultPackingList(days: number, climate: string): PackingItem[] {
  const baseItems: PackingItem[] = [
    // Documents (always needed)
    { id: '1', category: 'Documents', name: 'Passport', quantity: 1, packed: false, essential: true },
    { id: '2', category: 'Documents', name: 'Travel insurance docs', quantity: 1, packed: false, essential: true },
    { id: '3', category: 'Documents', name: 'Boarding passes', quantity: 1, packed: false, essential: true },
    { id: '4', category: 'Documents', name: 'Hotel confirmations', quantity: 1, packed: false, essential: false },

    // Electronics
    { id: '5', category: 'Electronics', name: 'Phone charger', quantity: 1, packed: false, essential: true },
    { id: '6', category: 'Electronics', name: 'Power adapter', quantity: 1, packed: false, essential: true },
    { id: '7', category: 'Electronics', name: 'Portable charger', quantity: 1, packed: false, essential: false },
    { id: '8', category: 'Electronics', name: 'Camera', quantity: 1, packed: false, essential: false },

    // Toiletries
    { id: '9', category: 'Toiletries', name: 'Toothbrush & paste', quantity: 1, packed: false, essential: true },
    { id: '10', category: 'Toiletries', name: 'Sunscreen', quantity: 1, packed: false, essential: true },
    { id: '11', category: 'Toiletries', name: 'Deodorant', quantity: 1, packed: false, essential: false },
    { id: '12', category: 'Toiletries', name: 'Shampoo (travel size)', quantity: 1, packed: false, essential: false },

    // Medications
    { id: '13', category: 'Medications', name: 'Pain relievers', quantity: 1, packed: false, essential: false },
    { id: '14', category: 'Medications', name: 'Personal medications', quantity: 1, packed: false, essential: true },

    // Misc
    { id: '15', category: 'Misc', name: 'Neck pillow', quantity: 1, packed: false, essential: false },
    { id: '16', category: 'Misc', name: 'Reusable water bottle', quantity: 1, packed: false, essential: false },
  ];

  // Calculate clothing based on days
  const clothingItems: PackingItem[] = [
    { id: '17', category: 'Clothing', name: 'T-shirts', quantity: Math.min(days, 7), packed: false, essential: true },
    { id: '18', category: 'Clothing', name: 'Underwear', quantity: Math.min(days + 1, 8), packed: false, essential: true },
    { id: '19', category: 'Clothing', name: 'Socks', quantity: Math.min(days, 7), packed: false, essential: true },
    { id: '20', category: 'Clothing', name: 'Pants/Shorts', quantity: Math.ceil(days / 2), packed: false, essential: true },
    { id: '21', category: 'Clothing', name: 'Comfortable shoes', quantity: 1, packed: false, essential: true },
  ];

  // Climate-specific items
  if (climate === 'tropical') {
    clothingItems.push(
      { id: '22', category: 'Clothing', name: 'Swimsuit', quantity: 2, packed: false, essential: true },
      { id: '23', category: 'Clothing', name: 'Flip flops', quantity: 1, packed: false, essential: false },
      { id: '24', category: 'Misc', name: 'Insect repellent', quantity: 1, packed: false, essential: true }
    );
  } else if (climate === 'cold') {
    clothingItems.push(
      { id: '25', category: 'Clothing', name: 'Warm jacket', quantity: 1, packed: false, essential: true },
      { id: '26', category: 'Clothing', name: 'Sweaters', quantity: 2, packed: false, essential: true },
      { id: '27', category: 'Clothing', name: 'Gloves & hat', quantity: 1, packed: false, essential: true }
    );
  }

  return [...baseItems, ...clothingItems];
}
