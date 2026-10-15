import React, { useEffect, useState } from 'react';
import { intelligenceService } from '../../services/intelligenceService';
import type {
  PlacementOverviewData,
  DepartmentIntelligenceData,
  YearIntelligenceData,
  PerformanceTrendItem,
  StudentSkillProfile
} from '../../services/intelligenceService';
import {
  TrendingUp,
  Brain,
  MessageSquare,
  Target,
  BarChart3,
  Sparkles,
  AlertCircle,
  BookOpen
} from 'lucide-react';

export const PlacementIntelligenceView: React.FC = () => {
  const [overview, setOverview] = useState<PlacementOverviewData | null>(null);
  const [departments, setDepartments] = useState<DepartmentIntelligenceData[]>([]);
  const [years, setYears] = useState<YearIntelligenceData[]>([]);
  const [trends, setTrends] = useState<PerformanceTrendItem[]>([]);
  const [studentSkills, setStudentSkills] = useState<StudentSkillProfile[]>([]);
  const [topicInfo, setTopicInfo] = useState<{ available: boolean; message?: string; topics?: any[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'departments' | 'years' | 'skills' | 'trends'>('overview');

  useEffect(() => {
    loadAllIntelligence();
  }, []);

  const loadAllIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovData, deptData, yearData, trendData, skillData, topData] = await Promise.all([
        intelligenceService.getOverview(),
        intelligenceService.getDepartments(),
        intelligenceService.getYears(),
        intelligenceService.getTrends(),
        intelligenceService.getStudentSkills(15),
        intelligenceService.getTopics()
      ]);

      setOverview(ovData);
      setDepartments(deptData || []);
      setYears(yearData || []);
      setTrends(trendData || []);
      setStudentSkills(skillData || []);
      setTopicInfo(topData);
    } catch (err: any) {
      console.error('Failed to load placement intelligence:', err);
      setError(err?.message || 'Unable to fetch placement intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            SkillsetrA Placement Readiness Engine
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Placement Intelligence Dashboard
          </h2>
        </div>

        {/* Sub-tabs navigation */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'overview' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSubTab('departments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'departments' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setActiveSubTab('years')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'years' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Year-wise ({years.length})
          </button>
          <button
            onClick={() => setActiveSubTab('skills')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'skills' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Student Profiles
          </button>
          <button
            onClick={() => setActiveSubTab('trends')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'trends' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Trends ({trends.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Aggregating Placement Intelligence...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeSubTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* Primary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Evaluated Attempts</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{overview.completed_attempts}</div>
                  <span className="text-[10px] text-slate-400">Total: {overview.total_attempts}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-indigo-600">Avg Placement Score</span>
                  <div className="text-2xl font-extrabold text-indigo-600 mt-1">{overview.avg_percentage}%</div>
                  <span className="text-[10px] text-slate-400">Raw Avg: {overview.avg_score} marks</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Pass Rate (&gt;=50%)</span>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-1">{overview.pass_rate}%</div>
                  <span className="text-[10px] text-emerald-700 font-medium">Campus benchmark</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-purple-600">Completion Rate</span>
                  <div className="text-2xl font-extrabold text-purple-600 mt-1">{overview.completion_rate}%</div>
                  <span className="text-[10px] text-slate-400">Submitted / Started</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-600">Aptitude Accuracy</span>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">{overview.sections.aptitude.accuracy}%</div>
                  <span className="text-[10px] text-slate-400">{overview.sections.aptitude.correct} correct</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-teal-600">Verbal Accuracy</span>
                  <div className="text-2xl font-extrabold text-teal-600 mt-1">{overview.sections.verbal.accuracy}%</div>
                  <span className="text-[10px] text-slate-400">{overview.sections.verbal.correct} correct</span>
                </div>
              </div>

              {/* Section Capability Deep Dive */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Quantitative & Logical Aptitude</h3>
                        <p className="text-[11px] text-slate-500">Problem solving & analytical readiness</p>
                      </div>
                    </div>
                    <span className="text-xl font-extrabold text-amber-600">{overview.sections.aptitude.accuracy}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Total Answered</span>
                      <div className="text-base font-extrabold text-slate-900 mt-0.5">{overview.sections.aptitude.total_answers}</div>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold">Correct</span>
                      <div className="text-base font-extrabold text-emerald-700 mt-0.5">{overview.sections.aptitude.correct}</div>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                      <span className="text-[10px] text-rose-700 uppercase font-bold">Wrong</span>
                      <div className="text-base font-extrabold text-rose-700 mt-0.5">{overview.sections.aptitude.wrong}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Verbal Ability & Comprehension</h3>
                        <p className="text-[11px] text-slate-500">Grammar, vocabulary & communicative logic</p>
                      </div>
                    </div>
                    <span className="text-xl font-extrabold text-teal-600">{overview.sections.verbal.accuracy}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Total Answered</span>
                      <div className="text-base font-extrabold text-slate-900 mt-0.5">{overview.sections.verbal.total_answers}</div>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold">Correct</span>
                      <div className="text-base font-extrabold text-emerald-700 mt-0.5">{overview.sections.verbal.correct}</div>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                      <span className="text-[10px] text-rose-700 uppercase font-bold">Wrong</span>
                      <div className="text-base font-extrabold text-rose-700 mt-0.5">{overview.sections.verbal.wrong}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Difficulty Calibration */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Student Accuracy Across Difficulty Tiers</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-950">
                      <span>EASY TIER</span>
                      <span>{overview.difficulty_breakdown.easy}%</span>
                    </div>
                    <div className="w-full bg-emerald-200/60 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, overview.difficulty_breakdown.easy)}%` }}></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-blue-950">
                      <span>MEDIUM TIER</span>
                      <span>{overview.difficulty_breakdown.medium}%</span>
                    </div>
                    <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, overview.difficulty_breakdown.medium)}%` }}></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-purple-950">
                      <span>HARD TIER</span>
                      <span>{overview.difficulty_breakdown.hard}%</span>
                    </div>
                    <div className="w-full bg-purple-200/60 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full" style={{ width: `${Math.min(100, overview.difficulty_breakdown.hard)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Topic Analytics Note */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>Topic Analytics: {topicInfo?.available ? 'Available' : (topicInfo?.message || 'Topic-level analytics require topic metadata.')}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPARTMENTS */}
          {activeSubTab === 'departments' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Department-wise Placement Performance</h3>
                  <p className="text-xs text-slate-500">Aggregated campus benchmarks across academic branches</p>
                </div>
              </div>

              {departments.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No department evaluation records available yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Department</th>
                        <th className="py-3.5 px-4 text-center">Students</th>
                        <th className="py-3.5 px-4 text-center">Evaluations</th>
                        <th className="py-3.5 px-4 text-center">Avg %</th>
                        <th className="py-3.5 px-4 text-center">Avg Score</th>
                        <th className="py-3.5 px-4 text-center">Aptitude Avg</th>
                        <th className="py-3.5 px-4 text-center">Verbal Avg</th>
                        <th className="py-3.5 px-4 text-center">Pass Rate</th>
                        <th className="py-3.5 px-4 text-center">Completion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {departments.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-extrabold">
                              {i + 1}
                            </span>
                            <span>{d.department}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-700">{d.student_count}</td>
                          <td className="py-3.5 px-4 text-center text-slate-700">{d.completed_evaluations}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-indigo-600">{d.avg_percentage}%</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{d.avg_score}</td>
                          <td className="py-3.5 px-4 text-center text-amber-700 font-semibold">{d.aptitude_accuracy}%</td>
                          <td className="py-3.5 px-4 text-center text-teal-700 font-semibold">{d.verbal_accuracy}%</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${d.pass_rate >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {d.pass_rate}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600">{d.completion_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: YEARS */}
          {activeSubTab === 'years' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Academic Year Performance</h3>
                  <p className="text-xs text-slate-500">Aggregated performance strictly for years existing in the database</p>
                </div>
              </div>

              {years.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No year-specific student evaluations recorded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
                  {years.map((y, i) => (
                    <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-900 text-xs font-extrabold">
                          {y.year.includes('Year') || y.year.includes('year') ? y.year : `${y.year}${y.year === '1' ? 'st' : y.year === '2' ? 'nd' : y.year === '3' ? 'rd' : 'th'} Year`}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{y.student_count} Candidates</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Average Performance</span>
                        <div className="text-2xl font-black text-indigo-600">{y.avg_percentage}%</div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-slate-600">
                          <span>Aptitude:</span> <strong className="text-amber-700">{y.aptitude_accuracy}%</strong>
                        </div>
                        <div className="text-slate-600">
                          <span>Verbal:</span> <strong className="text-teal-700">{y.verbal_accuracy}%</strong>
                        </div>
                        <div className="text-slate-600">
                          <span>Pass Rate:</span> <strong className="text-emerald-700">{y.pass_rate}%</strong>
                        </div>
                        <div className="text-slate-600">
                          <span>Evaluations:</span> <strong className="text-slate-800">{y.completed_evaluations}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STUDENT SKILL PROFILES */}
          {activeSubTab === 'skills' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Candidate Placement Skill Profiles</h3>
                  <p className="text-xs text-slate-500">Deterministic skill analysis aggregated across completed assessments</p>
                </div>
              </div>

              {studentSkills.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No completed student assessments available to calculate skill profiles.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Student</th>
                        <th className="py-3.5 px-4">Department & Year</th>
                        <th className="py-3.5 px-4 text-center">Tests Taken</th>
                        <th className="py-3.5 px-4 text-center">Overall %</th>
                        <th className="py-3.5 px-4 text-center">Aptitude %</th>
                        <th className="py-3.5 px-4 text-center">Verbal %</th>
                        <th className="py-3.5 px-4">Strong Area</th>
                        <th className="py-3.5 px-4">Improvement Area</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {studentSkills.map((s) => (
                        <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{s.full_name}</div>
                            <span className="text-[10px] text-slate-400">{s.register_number}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            <div>{s.department}</div>
                            <span className="text-[10px] text-slate-400">Year {s.year}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-800 font-bold">{s.assessments_completed}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-indigo-600">{s.overall_percentage}%</td>
                          <td className="py-3.5 px-4 text-center text-amber-700 font-bold">{s.aptitude_accuracy}%</td>
                          <td className="py-3.5 px-4 text-center text-teal-700 font-bold">{s.verbal_accuracy}%</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                              {s.strong_section}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                              {s.needs_improvement}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TRENDS */}
          {activeSubTab === 'trends' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Assessment Cohort Performance Trends</span>
                  </h3>
                  <p className="text-xs text-slate-500">Historical progression across completed placement assessments</p>
                </div>
              </div>

              {trends.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">Insufficient Historical Data</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Complete multiple student assessments to generate comparative performance trends.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {trends.map((t, idx) => (
                      <div key={t.assessment_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 truncate max-w-[140px]">{t.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                        </div>
                        <div className="text-xl font-extrabold text-indigo-600">{t.avg_percentage}%</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                          <span>{t.participants} Candidates</span>
                          <span className="text-emerald-600 font-bold">{t.pass_rate}% Pass</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
