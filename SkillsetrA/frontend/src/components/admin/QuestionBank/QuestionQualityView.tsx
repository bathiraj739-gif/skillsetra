import React, { useEffect, useState } from 'react';
import { intelligenceService } from '../../../services/intelligenceService';
import type { QuestionQualityResponse } from '../../../services/intelligenceService';
import {
  Search,
  BarChart2,
  AlertTriangle,
  HelpCircle,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  X
} from 'lucide-react';

export const QuestionQualityView: React.FC = () => {
  const [data, setData] = useState<QuestionQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState('ALL');
  const [difficulty, setDifficulty] = useState('ALL');
  const [quality, setQuality] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [sortBy, setSortBy] = useState('total_attempts');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  // Detail Modal
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadQualityData();
  }, [category, difficulty, quality, page, sortBy, sortDir]);

  const loadQualityData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await intelligenceService.getQuestionQualityList({
        category,
        difficulty,
        quality,
        search,
        page,
        limit,
        sortBy,
        sortDir
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load question quality data:', err);
      setError(err?.message || 'Failed to load question quality analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadQualityData();
  };

  const openDetailModal = async (questionId: string) => {
    setSelectedQuestionId(questionId);
    setLoadingDetail(true);
    setDetailData(null);
    try {
      const res = await intelligenceService.getQuestionDetailedAnalytics(questionId);
      setDetailData(res);
    } catch (err: any) {
      console.error('Failed to load detail analytics:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getQualityBadge = (indicator: string) => {
    switch (indicator) {
      case 'VERY_EASY':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            Very Easy
          </span>
        );
      case 'EASY':
        return (
          <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-bold">
            Easy
          </span>
        );
      case 'NORMAL':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
            Normal / Calibrated
          </span>
        );
      case 'DIFFICULT':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
            Difficult
          </span>
        );
      case 'VERY_DIFFICULT':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
            Very Difficult
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold">
            Insufficient Data
          </span>
        );
    }
  };

  const summary = data?.summary;
  const questions = data?.questions || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Items</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{summary?.total_questions ?? '...'}</div>
          <span className="text-[10px] text-slate-400">In Question Bank</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Very Easy (&gt;85%)</span>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{summary?.very_easy_count ?? '...'}</div>
          <span className="text-[10px] text-slate-400">High pass rate</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-teal-600">Easy (65-85%)</span>
          <div className="text-xl font-extrabold text-teal-600 mt-1">{summary?.easy_count ?? '...'}</div>
          <span className="text-[10px] text-slate-400">Moderate ease</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">Normal (40-65%)</span>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{summary?.normal_count ?? '...'}</div>
          <span className="text-[10px] text-slate-400">Ideal discrimination</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">Difficult (20-40%)</span>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{summary?.difficult_count ?? '...'}</div>
          <span className="text-[10px] text-slate-400">Challenging</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-rose-600">Very Difficult (&lt;20%)</span>
          <div className="text-xl font-extrabold text-rose-600 mt-1">{summary?.very_difficult_count ?? '...'}</div>
          <span className="text-[10px] text-slate-400">High failure</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Needs Review</span>
          </span>
          <div className="text-xl font-extrabold text-amber-900 mt-1">{summary?.flagged_count ?? '...'}</div>
          <span className="text-[10px] text-amber-700">Flagged for admin</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question text for quality analytics..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="APTITUDE">Aptitude</option>
              <option value="VERBAL">Verbal</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            <select
              value={quality}
              onChange={(e) => { setQuality(e.target.value); setPage(1); }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="ALL">All Quality Indicators</option>
              <option value="VERY_EASY">Very Easy</option>
              <option value="EASY">Easy</option>
              <option value="NORMAL">Normal</option>
              <option value="DIFFICULT">Difficult</option>
              <option value="VERY_DIFFICULT">Very Difficult</option>
              <option value="INSUFFICIENT_DATA">Insufficient Data</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="total_attempts">Sort by Attempts</option>
              <option value="accuracy">Sort by Accuracy</option>
              <option value="answered">Sort by Answered</option>
              <option value="created_at">Sort by Date</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC')}
              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              title={`Sort order: ${sortDir}`}
            >
              {sortDir === 'ASC' ? '▲ Asc' : '▼ Desc'}
            </button>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Analytics Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 text-xs font-semibold text-slate-500">Calculating Question Quality Aggregations in PostgreSQL...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Questions Matching Criteria</h3>
            <p className="text-xs text-slate-500">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Question & Details</th>
                  <th className="py-3.5 px-4 text-center">Attempts</th>
                  <th className="py-3.5 px-4 text-center">Answered / Skip</th>
                  <th className="py-3.5 px-4 text-center">Correct / Wrong</th>
                  <th className="py-3.5 px-4 text-center">Accuracy %</th>
                  <th className="py-3.5 px-4 text-center">Quality Classification</th>
                  <th className="py-3.5 px-4 text-center">Option Dist (%)</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {questions.map((q) => {
                  const hasFlag = q.flags.high_failure_rate || q.flags.high_skip_rate || q.flags.ambiguous;

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              q.category === 'APTITUDE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {q.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                            Tag: {q.difficulty}
                          </span>
                          {hasFlag && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Flagged</span>
                            </span>
                          )}
                        </div>
                        <p className="text-slate-900 font-semibold line-clamp-2">{q.question_text}</p>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {q.total_attempts}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="text-slate-800 font-bold">{q.answered_count}</span>
                        <span className="text-slate-400 font-normal text-[10px] block">
                          Skip: {q.unanswered_count}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="text-emerald-600 font-bold">{q.correct_count}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-600 font-bold">{q.wrong_count}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`font-extrabold ${
                              q.accuracy_percentage >= 70
                                ? 'text-emerald-600'
                                : q.accuracy_percentage >= 40
                                ? 'text-blue-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {q.accuracy_percentage}%
                          </span>
                          <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full ${
                                q.accuracy_percentage >= 70
                                  ? 'bg-emerald-500'
                                  : q.accuracy_percentage >= 40
                                  ? 'bg-blue-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, q.accuracy_percentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {getQualityBadge(q.quality_indicator)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-mono">
                          <span className={`px-1.5 py-0.5 rounded ${q.correct_option === 'A' ? 'bg-emerald-100 font-bold text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            A:{q.option_distribution.A.percentage}%
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${q.correct_option === 'B' ? 'bg-emerald-100 font-bold text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            B:{q.option_distribution.B.percentage}%
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${q.correct_option === 'C' ? 'bg-emerald-100 font-bold text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            C:{q.option_distribution.C.percentage}%
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${q.correct_option === 'D' ? 'bg-emerald-100 font-bold text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            D:{q.option_distribution.D.percentage}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openDetailModal(q.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} questions)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Question Review Modal */}
      {selectedQuestionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Question Quality Deep Dive</h3>
                  <p className="text-xs text-slate-400">Aggregated student attempt telemetry & diagnostics</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedQuestionId(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {loadingDetail ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">Loading question metrics...</p>
                </div>
              ) : detailData ? (
                <>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                          {detailData.question.category}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                          Difficulty Tag: {detailData.question.difficulty}
                        </span>
                      </div>
                      {getQualityBadge(detailData.analytics.quality_indicator)}
                    </div>

                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {detailData.question.question_text}
                    </p>

                    {/* Options list with correct option highlighted */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const isCorrect = detailData.question.correct_option === opt;
                        const dist = detailData.analytics.option_distribution[opt];
                        const optKey = `option_${opt.toLowerCase()}`;
                        const optText = detailData.question[optKey];

                        return (
                          <div
                            key={opt}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {opt}
                              </span>
                              <span>{optText}</span>
                              {isCorrect && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Correct Key
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600">
                              {dist?.percentage || 0}% ({dist?.count || 0} picks)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Metrics Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Total Attempts</span>
                      <div className="text-lg font-extrabold text-slate-900 mt-0.5">{detailData.analytics.total_attempts}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold">Correct Answers</span>
                      <div className="text-lg font-extrabold text-emerald-700 mt-0.5">{detailData.analytics.correct_count}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] text-rose-700 uppercase font-bold">Wrong Answers</span>
                      <div className="text-lg font-extrabold text-rose-700 mt-0.5">{detailData.analytics.wrong_count}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 uppercase font-bold">Accuracy Rate</span>
                      <div className="text-lg font-extrabold text-indigo-700 mt-0.5">{detailData.analytics.accuracy_percentage}%</div>
                    </div>
                  </div>

                  {/* Recommendation Note */}
                  <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950">
                      <Info className="w-4 h-4 text-blue-600" />
                      <span>Quality Engine Diagnostic:</span>
                    </div>
                    <p className="leading-relaxed">{detailData.analytics.recommendation}</p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedQuestionId(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
