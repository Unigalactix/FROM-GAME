import {
  Settings,
  Sun,
  Moon,
  Wind,
  Cross,
  FastForward,
  RotateCcw,
  LogOut,
} from 'lucide-react';

// Central icon registry so scenes reference icons by a stable name.
const icons = {
  settings: Settings,
  sun: Sun,
  moon: Moon,
  wind: Wind,
  cross: Cross,
  'fast-forward': FastForward,
  reset: RotateCcw,
  exit: LogOut,
};

export default function Icon({ name, size = 20, strokeWidth = 1.5, className = '' }) {
  const Glyph = icons[name];
  if (!Glyph) return null;
  return <Glyph size={size} strokeWidth={strokeWidth} className={className} />;
}
