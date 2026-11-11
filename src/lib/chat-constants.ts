export const ROOMS = [
  {
    id: "global",
    name: "الصالون العام المباشر",
    description: "الدردشة الجماعية الفورية لجميع المتواجدين في الموقع",
    icon: "globe",
  },
  {
    id: "media",
    name: "استوديو الصور والمرئيات",
    description: "مساحة مشاركة المقاطع المرئية، اللقطات، والتسجيلات الصوتية",
    icon: "sparkles",
  },
  {
    id: "tech",
    name: "مجلس التقنية والإبداع",
    description: "نقاشات البرمجة، التصميم، وتجارب الويب التفاعلية",
    icon: "cpu",
  },
] as const;

export const AVATAR_PRESETS = [
  { id: "falcon", emoji: "🦅", label: "صقر الجزيرة", color: "from-indigo-500 to-cyan-400" },
  { id: "star", emoji: "✨", label: "نجم سهيل", color: "from-violet-500 to-fuchsia-500" },
  { id: "wave", emoji: "🌊", label: "موج الخليج", color: "from-cyan-500 to-teal-400" },
  { id: "flame", emoji: "🔥", label: "شعلة الإبداع", color: "from-amber-500 to-rose-500" },
  { id: "crown", emoji: "👑", label: "النخبة", color: "from-emerald-500 to-teal-500" },
  { id: "rocket", emoji: "🚀", label: "رائد فضاء", color: "from-blue-500 to-indigo-600" },
  { id: "headphones", emoji: "🎧", label: "صوت السهر", color: "from-pink-500 to-rose-500" },
  { id: "palm", emoji: "🌴", label: "واحة النخيل", color: "from-teal-500 to-emerald-400" },
];
