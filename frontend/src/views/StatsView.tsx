import { useState, useEffect } from 'react';
import { getOverview, getDailyTime, getRecentActivity, type Overview, type DailyDay, type Activity } from '../lib/api';
import OverviewCards from '../components/stats/OverviewCards';
import DailyTimeChart from '../components/stats/DailyTimeChart';
import ActivityTimeline from '../components/stats/ActivityTimeline';

export default function StatsView() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dailyTime, setDailyTime] = useState<DailyDay[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<'7d'|'30d'>('7d');

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    getOverview().then(setOverview).finally(()=>setOverviewLoading(false));
    getRecentActivity().then(d=>setActivities(d.activities)).finally(()=>setActivityLoading(false));
  }, []);

  useEffect(() => {
    setDailyLoading(true);
    getDailyTime(tab==='7d'?7:30).then(d=>setDailyTime(d.days)).finally(()=>setDailyLoading(false));
  }, [tab]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary tracking-tight">学习统计</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        <OverviewCards overview={overviewLoading ? null : overview} />
        <DailyTimeChart dailyTime={dailyTime} tab={tab} setTab={setTab} loading={dailyLoading} />
        <ActivityTimeline activities={activities} loading={activityLoading} />
      </div>
    </div>
  );
}
