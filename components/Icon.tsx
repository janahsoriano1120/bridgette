import * as Lucide from 'lucide-react-native'

// Namespace import so a single misspelled or version-missing icon
// resolves to undefined instead of throwing at import time.
const {
  FlaskConical,
  FileText,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Pill,
  Salad,
  BookOpen,
  Camera,
  Image: ImageIcon,
  Paperclip,
  Plus,
  RefreshCw,
  Lightbulb,
  Bell,
  MessageCircle,
  TrendingUp,
  Users,
  Share2,
  Stethoscope,
  Eye,
  Dumbbell,
  Microscope,
  ClipboardList,
  Lock,
  Moon,
  Pencil,
  X,
  Home,
  FolderLock,
  Circle,
  TriangleAlert,
  AlertTriangle,
} = Lucide

// Warning icon was renamed across Lucide versions; pick whichever exists.
const WarnIcon = TriangleAlert ?? AlertTriangle ?? Circle

const ICONS = {
  lab: FlaskConical,
  record: FileText,
  delete: Trash2,
  flagged: WarnIcon,
  ok: Check,
  back: ChevronLeft,
  forward: ChevronRight,
  up: ArrowUp,
  down: ArrowDown,
  steady: ArrowRight,
  medication: Pill,
  diet: Salad,
  story: BookOpen,
  camera: Camera,
  photo: ImageIcon,
  attach: Paperclip,
  add: Plus,
  refresh: RefreshCw,
  insight: Lightbulb,
  bell: Bell,
  message: MessageCircle,
  trends: TrendingUp,
  careteam: Users,
  share: Share2,
  doctor: Stethoscope,
  eye: Eye,
  trainer: Dumbbell,
  diagnosis: Microscope,
  notes: ClipboardList,
  lock: Lock,
  sleep: Moon,
  edit: Pencil,
  close: X,
  home: Home,
  vault: FolderLock,
} as const

type IconName = keyof typeof ICONS

export default function Icon({
  name,
  size = 20,
  color = '#3D3229',
}: {
  name: IconName
  size?: number
  color?: string
}) {
  const LucideIcon = ICONS[name] || Circle
  if (!LucideIcon) return null
  return <LucideIcon size={size} color={color} strokeWidth={1.75} />
}