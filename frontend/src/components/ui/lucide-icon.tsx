import {
  File, FileText, FileCode, FileImage, FileVideo, FileAudio, FileArchive,
  BookOpen, BookMarked, Newspaper, PenLine, Pencil, ClipboardList,
  Video, Play, Music, Mic, Image, Images, Camera, Headphones,
  Code, Terminal, Globe, Cpu, Database, Server, Cloud, Monitor, Smartphone,
  Briefcase, Building, BarChart2, TrendingUp, PieChart, LineChart, DollarSign, CreditCard,
  GraduationCap, School, Award, Trophy, Star, Lightbulb,
  Layers, Layout, Palette, Brush,
  Package, Box, ShoppingBag, Tag, Gift, Gem,
  Wrench, Settings, Zap, Rocket, Shield, Lock, Key, Link,
  Map, MapPin, Navigation, Compass,
  User, Users, Heart, Smile,
  Folder, FolderOpen, Archive, Download, Upload, Share2, Search, Filter,
  Beef, Sprout, Utensils, Scissors, Factory, Plane, Milk, Wheat, FlaskConical,
  UtensilsCrossed, Shirt, Home, Car, TreePine, Fish, Egg, Cookie,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'file': File, 'file-text': FileText, 'file-code': FileCode, 'file-image': FileImage,
  'file-video': FileVideo, 'file-audio': FileAudio, 'file-archive': FileArchive,
  'book-open': BookOpen, 'book-marked': BookMarked, 'newspaper': Newspaper,
  'pen-line': PenLine, 'pencil': Pencil, 'clipboard-list': ClipboardList,
  'video': Video, 'play': Play, 'music': Music, 'mic': Mic,
  'image': Image, 'images': Images, 'camera': Camera, 'headphones': Headphones,
  'code': Code, 'terminal': Terminal, 'globe': Globe, 'cpu': Cpu,
  'database': Database, 'server': Server, 'cloud': Cloud, 'monitor': Monitor, 'smartphone': Smartphone,
  'briefcase': Briefcase, 'building': Building, 'bar-chart-2': BarChart2,
  'trending-up': TrendingUp, 'pie-chart': PieChart, 'line-chart': LineChart,
  'dollar-sign': DollarSign, 'credit-card': CreditCard,
  'graduation-cap': GraduationCap, 'school': School, 'award': Award,
  'trophy': Trophy, 'star': Star, 'lightbulb': Lightbulb,
  'layers': Layers, 'layout': Layout, 'palette': Palette, 'brush': Brush,
  'package': Package, 'box': Box, 'shopping-bag': ShoppingBag,
  'tag': Tag, 'gift': Gift, 'gem': Gem,
  'wrench': Wrench, 'settings': Settings, 'zap': Zap, 'rocket': Rocket,
  'shield': Shield, 'lock': Lock, 'key': Key, 'link': Link,
  'map': Map, 'map-pin': MapPin, 'navigation': Navigation, 'compass': Compass,
  'user': User, 'users': Users, 'heart': Heart, 'smile': Smile,
  'folder': Folder, 'folder-open': FolderOpen, 'archive': Archive,
  'download': Download, 'upload': Upload, 'share-2': Share2,
  'search': Search, 'filter': Filter,
  // Seed-specific icons
  'sheep': Beef, 'beef': Beef, 'milk': Milk,
  'sprout': Sprout, 'wheat': Wheat, 'tree-pine': TreePine,
  'utensils': Utensils, 'utensils-crossed': UtensilsCrossed,
  'scissors': Scissors, 'shirt': Shirt,
  'factory': Factory, 'flask-conical': FlaskConical,
  'plane': Plane,
  'home': Home, 'car': Car,
  'fish': Fish, 'egg': Egg, 'cookie': Cookie,
};

export function DynamicLucideIcon({
  name,
  className,
  fallback,
}: {
  name?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}) {
  if (!name) return <>{fallback}</>;
  const Icon = ICON_MAP[name];
  if (!Icon) return <>{fallback}</>;
  return <Icon className={className} />;
}
