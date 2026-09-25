import React, { useEffect, useState } from 'react'
import { attemptService } from '../../services/attemptService'
import { Radio, RefreshCw, CheckCircle2, HelpCircle, AlertCircle, Zap, Clock, CheckSquare } from 'lucide-react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export const LiveMonitoring: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({
    activeSessionsCount: 0,
    completedTodayCount: 0,
    totalAttemptsCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isLiveConnected, setIsLiveConnected] = useState(false)

  useEffect(() => {
    loadLiveFeed()

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setIsLiveConnected(true)
      socket.emit('join_admin')
    })

    socket.on('disconnect', () => {
      setIsLiveConnected(false)
    })

    const handleRealtimeEvent = () => {
      loadLiveFeed()
    }

    socket.on('student_started', handleRealtimeEvent)
    socket.on('answer_saved', handleRealtimeEvent)
    socket.on('student_submitted', handleRealtimeEvent)
    socket.on('result_generated', handleRealtimeEvent)
    socket.on('proctor_event', handleRealtimeEvent)

    const interval = setInterval(() => {
      loadLiveFeed()
    }, 5000)

    return () => {
      socket.disconnect()
      clearInterval(interval)
    }
  }, [])

  const loadLiveFeed = async () => {
    try {
      const feed = await attemptService.getLiveMonitoringFeed()
      setActiveSessions(feed?.activeSessions || [])
      setActivities(feed?.activities || [])
      setSummary(feed?.summary || {})
      setLastUpdated(new Date().toLocaleTimeString())
      setError(null)
    } catch (err: any) {
      console.error('Failed to load live feed:', err)
      setError('Unable to load live proctored feed.')
    } finally {
      setLoading(false)
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'ATTEMPT_STARTED':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'ATTEMPT_SUBMITTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'ANSWER_SAVED':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'ASSIGNMENT_CREATED':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-500 animate-pulse" />
            <span>Live Exam Monitoring Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time candidate attempt progress, active test takers & Socket.IO event feed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isLiveConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isLiveConnected ? 'Socket.IO Live' : 'Polling'}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Last Sync: {lastUpdated || 'Connecting...'}</span>
          <button
            onClick={loadLiveFeed}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh Feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Test Takers</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>{activeSessions.length}</span>
              {activeSessions.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Today</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{summary.completedTodayCount || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Attempts Logged</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{summary.totalAttemptsCount || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Active Exam Sessions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>In-Progress Exam Sessions</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-100 text-indigo-700 font-bold">
              {activeSessions.length}
            </span>
          </h2>
        </div>

        {activeSessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-xs space-y-2">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Candidate Exams In Progress</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When a registered candidate starts an assessment, their real-time progress, time elapsed, and answers will stream here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-xs space-y-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-100">
                      {session.studentName ? session.studentName.substring(0, 2).toUpperCase() : 'ST'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{session.studentName}</h4>
                      <p className="text-xs text-slate-500 font-mono">
                        {session.registerNumber} {session.department ? `| ${session.department}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Testing</span>
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate">{session.assessmentTitle}</span>
                    <span className="font-mono text-slate-500 text-[11px] shrink-0">{session.durationMinutes} Mins</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Progress: {session.answeredQuestions} of {session.totalQuestions} Questions</span>
                      <span className="font-bold text-indigo-600">{session.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, session.progressPercentage)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
                  <span>Expires: {new Date(session.expiresAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Activity Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>Live Audit & Event Stream</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-bold">
              {activities.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-xs font-semibold text-slate-500">Connecting live stream...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs space-y-2">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Recent Activity</h3>
            <p className="text-xs text-slate-500">Events will appear here as candidates register, start exams, and submit tests.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {activities.map((act) => (
              <div
                key={act.id}
                className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {act.studentName ? act.studentName.substring(0, 2).toUpperCase() : act.username ? act.username.substring(0, 2).toUpperCase() : 'ST'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{act.description || act.action}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {act.registerNumber ? `${act.registerNumber} • ` : ''}
                      {new Date(act.created_at || act.createdAt).toLocaleTimeString()} ({new Date(act.created_at || act.createdAt).toLocaleDateString()})
                    </p>
                  </div>
                </div>

                <div
                  className={`self-start sm:self-auto inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-xl border shrink-0 ${getActionBadgeColor(
                    act.action
                  )}`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{act.action ? act.action.replace(/_/g, ' ') : 'EVENT'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
