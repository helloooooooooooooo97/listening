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
    <aside className="w-52 flex-shrink-0 flex flex-col h-full glass border-r border-white/[0.06] select-none">
      {/* Logo */}
      <div className="flex-shrink-0 px-5 pt-7 pb-4">
        <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fa2d48, #ff6b7f)' }}>
            <HiMusicalNote size={11} />
          </span>
          听力练习
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-shrink-0 px-2">
        <div onClick={() => onSectionChange('home')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='home' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiHome size={15} /> 首页
        </div>
        <div onClick={() => onSectionChange('courses')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='courses' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiBookOpen size={15} /> 音频
          <span className="ml-auto text-[10px] text-white/20">{lessonCount}</span>
        </div>
        <div onClick={() => onSectionChange('clips')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='clips' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiBookmark size={15} /> 片段
          <span className="ml-auto text-[10px] text-white/20">{clipsCount}</span>
        </div>
        <div onClick={() => onSectionChange('words')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='words' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiTag size={15} /> 单词
          <span className="ml-auto text-[10px] text-white/20">{wordCount}</span>
        </div>
        <div onClick={() => onSectionChange('stats')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='stats' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiChartBar size={15} /> 统计
        </div>
        <div onClick={() => onSectionChange('favorites')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='favorites' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiHeart size={15} /> 收藏
          <span className="ml-auto text-[10px] text-white/20">{favCount}</span>
        </div>
        <div onClick={() => onSectionChange('dictation')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='dictation' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiPencilSquare size={15} /> 听写记录
        </div>
        <div onClick={() => onSectionChange('recent')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='recent' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiClock size={15} /> 最近播放
          <span className="ml-auto text-[10px] text-white/20">{lessonCount}</span>
        </div>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex-shrink-0 px-2 pb-4">
        <div onClick={() => onSectionChange('settings')}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
            activeSection==='settings' ? 'text-white bg-white/[0.08]' : 'text-white/45 hover:text-white/75'
          }`}>
          <HiCog6Tooth size={15} /> 设置
        </div>
      </div>
    </aside>
  );
}
