import { HiMusicalNote, HiHome, HiBookOpen, HiBookmark, HiClock, HiTag, HiCog6Tooth, HiChartBar, HiPencilSquare, HiHeart } from 'react-icons/hi2';

export type NavSection = 'home' | 'courses' | 'clips' | 'words' | 'stats' | 'dictation' | 'favorites' | 'recent' | 'settings';

interface Props {
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
  lessonCount: number;
  clipsCount: number;
  wordCount: number;
  favCount: number;
}

export default function Sidebar({ activeSection, onSectionChange, lessonCount, clipsCount, wordCount, favCount }: Props) {

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
      <nav className="flex-shrink-0 px-2">
        {([
          ['home', '首页', HiHome, 0],
          ['courses', '音频', HiBookOpen, lessonCount],
          ['clips', '片段', HiBookmark, clipsCount],
          ['words', '单词', HiTag, wordCount],
          ['stats', '统计', HiChartBar, 0],
          ['favorites', '收藏', HiHeart, favCount],
          ['dictation', '听写记录', HiPencilSquare, 0],
          ['recent', '最近播放', HiClock, lessonCount],
        ] as const).map(([key, label, Icon, count]) => (
          <div key={key} onClick={() => onSectionChange(key as NavSection)}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
              activeSection===key ? 'text-primary bg-[var(--bg-active)]' : 'text-secondary hover:text-primary hover:bg-[var(--bg-hover)]'
            }`}>
            <Icon size={16} /> {label}
            {count > 0 && <span className="ml-auto text-sm text-tertiary">{count}</span>}
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex-shrink-0 px-2 pb-4">
        <div onClick={() => onSectionChange('settings')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
            activeSection==='settings' ? 'text-primary bg-[var(--bg-active)]' : 'text-secondary hover:text-primary hover:bg-[var(--bg-hover)]'
          }`}>
          <HiCog6Tooth size={16} /> 设置
        </div>
      </div>
    </aside>
  );
}
