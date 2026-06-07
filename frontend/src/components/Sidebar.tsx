import { useRef, useEffect, useState } from 'react';
import { HiMusicalNote, HiHome, HiBookOpen, HiBookmark, HiClock, HiTag, HiCog6Tooth, HiChartBar, HiPencilSquare, HiHeart, HiQueueList, HiCloudArrowUp } from 'react-icons/hi2';

export type NavSection = 'home' | 'courses' | 'clips' | 'words' | 'stats' | 'dictation' | 'favorites' | 'playlist' | 'recent' | 'import' | 'settings';

interface Props {
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
  lessonCount: number;
  clipsCount: number;
  wordCount: number;
  favCount: number;
}

const NAV_ITEMS: [NavSection, string, React.ComponentType<{size:number}>, number][] = [
  ['home', '首页', HiHome, 0],
  ['courses', '音频', HiBookOpen, 0], // count dynamic
  ['clips', '片段', HiBookmark, 0],   // count dynamic
  ['words', '单词', HiTag, 0],        // count dynamic
  ['playlist', '播放队列', HiQueueList, 0],
  ['stats', '统计', HiChartBar, 0],
  ['favorites', '收藏', HiHeart, 0],  // count dynamic
  ['dictation', '听写记录', HiPencilSquare, 0],
  ['recent', '最近播放', HiClock, 0],
  ['import', '导入', HiCloudArrowUp, 0],
];

export default function Sidebar({ activeSection, onSectionChange, lessonCount, clipsCount, wordCount, favCount }: Props) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number }>({ top: 0, height: 0 });

  // Build count map
  const counts: Record<string, number> = {
    courses: lessonCount,
    clips: clipsCount,
    words: wordCount,
    favorites: favCount,
  };

  // Animate indicator to active item
  useEffect(() => {
    const el = itemRefs.current.get(activeSection);
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const next = {
      top: elRect.top - navRect.top,
      height: elRect.height,
    };
    setIndicatorStyle(prev => (
      Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    ));
  }, [activeSection, lessonCount, clipsCount, wordCount, favCount]);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full glass border-r border-[var(--border-primary)] select-none">
      {/* Logo */}
      <div className="flex-shrink-0 px-5 pt-7 pb-4">
        <h1 className="text-sm font-bold text-primary tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
            <HiMusicalNote size={11} />
          </span>
          听力练习
        </h1>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="flex-shrink-0 px-2 relative">
        {/* Sliding active indicator */}
        <div
          className="absolute left-2 right-2 rounded-md bg-[var(--bg-active)] transition-all duration-200 ease-out pointer-events-none"
          style={{
            top: indicatorStyle.top,
            height: indicatorStyle.height || 0,
            opacity: indicatorStyle.height > 0 ? 1 : 0,
          }}
        />

        {NAV_ITEMS.map(([key, label, Icon]) => (
          <div key={key}
            ref={el => { if (el) itemRefs.current.set(key, el); }}
            onClick={() => onSectionChange(key)}
            className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
              activeSection === key ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-[var(--bg-hover)]'
            }`}>
            <Icon size={16} /> {label}
            {counts[key] > 0 && <span className="ml-auto text-sm text-tertiary">{counts[key]}</span>}
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex-shrink-0 px-2 pb-4">
        <div onClick={() => onSectionChange('settings')}
          ref={el => { if (el) itemRefs.current.set('settings', el); }}
          className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
            activeSection === 'settings' ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-[var(--bg-hover)]'
          }`}>
          <HiCog6Tooth size={16} /> 设置
        </div>
      </div>
    </aside>
  );
}
