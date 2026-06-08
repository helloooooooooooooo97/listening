import { HiHome, HiBookOpen, HiBookmark, HiHeart, HiCog6Tooth, HiChartBar, HiFolderOpen } from 'react-icons/hi2';
import type { NavSection } from './Sidebar';

interface Props {
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
}

const TABS: { key: NavSection; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'home', label: '首页', icon: HiHome },
  { key: 'courses', label: '音频', icon: HiBookOpen },
  { key: 'clips', label: '片段', icon: HiBookmark },
  { key: 'favorites', label: '收藏', icon: HiHeart },
  { key: 'collections', label: '合集', icon: HiFolderOpen },
  { key: 'stats', label: '统计', icon: HiChartBar },
  { key: 'settings', label: '设置', icon: HiCog6Tooth },
];

export default function MobileTabBar({ activeSection, onSectionChange }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around px-2 py-1.5"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderTop: '1px solid var(--border-primary)',
      }}>
      {TABS.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => onSectionChange(key)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer min-w-0 ${
            activeSection === key ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'
          }`}>
          <Icon size={18} />
          <span className="text-[9px] font-medium truncate max-w-full">{label}</span>
        </button>
      ))}
    </nav>
  );
}
