import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileSpreadsheet,
  Bot,
  User,
  Plus,
  MessageSquare,
  Cpu,
  Search,
  Brain,
  Users,
  Radio,
  FileCheck,
  BarChart3,
  HelpCircle,
} from 'lucide-react'
import { agentService, type AgentResponseData } from '../../services/agentService'
import { useAuth } from '../../context/AuthContext'

interface ChatMessage {
  id: string
  sender: 'user' | 'agent'
  text: string
  timestamp: string
  intent?: string
  explanation?: string
  status?: string
  preview?: any
  data?: any
  confirmationId?: string
  error?: string
}

interface ChatSession {
  id: string
  title: string
  timestamp: string
}

export const AdminAgentPage: React.FC = () => {
  const { profile } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileCategory, setFileCategory] = useState<'QUESTIONS' | 'CANDIDATES'>('QUESTIONS')
  const [activeConfirmationId, setActiveConfirmationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chats' | 'tools'>('chats')

  // Real Sessions History from Backend
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('default')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Fetch Session History on Mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await agentService.getAgentHistory()
        if (res.history && res.history.length > 0) {
          const loadedSessions: ChatSession[] = res.history.map((item: any, idx: number) => ({
            id: `hist-${idx}`,
            title: item.userMessage?.slice(0, 30) || `Conversation ${idx + 1}`,
            timestamp: 'Recent',
          }))
          setSessions(loadedSessions)
        }
      } catch (err) {
        console.error('Failed to fetch agent history:', err)
      }
    }
    fetchHistory()
  }, [])

  // Speech Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInputText(transcript)
        setIsRecording(false)
      }

      recognition.onerror = () => {
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your command.')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsRecording(true)
      } catch (err) {
        setIsRecording(false)
      }
    }
  }

  const handleNewChat = () => {
    setMessages([])
    const newId = Date.now().toString()
    setCurrentSessionId(newId)
  }

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText
    if (!textToSend.trim() && !selectedFile) return

    const userMsgId = Date.now().toString()
    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Track session title if first message
    if (messages.length === 0) {
      const titleSnippet = textToSend.slice(0, 28) + (textToSend.length > 28 ? '...' : '')
      setSessions((prev) => [
        { id: currentSessionId, title: titleSnippet, timestamp: 'Today' },
        ...prev,
      ])
    }

    if (selectedFile) {
      const fileToUpload = selectedFile
      const currentCategory = fileCategory
      setSelectedFile(null)
      setInputText('')

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          text: `📎 File Upload: ${fileToUpload.name} (${currentCategory}) ${textToSend ? `\nCommand: ${textToSend}` : ''}`,
          timestamp: userTimestamp,
        },
      ])

      setLoading(true)

      try {
        const res: AgentResponseData = await agentService.uploadAgentFile(fileToUpload, currentCategory)
        setLoading(false)

        const agentMsgId = (Date.now() + 1).toString()
        if (res.confirmationId) setActiveConfirmationId(res.confirmationId)

        setMessages((prev) => [
          ...prev,
          {
            id: agentMsgId,
            sender: 'agent',
            text: res.aiMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            intent: res.intent,
            explanation: res.explanation,
            status: res.status,
            preview: res.preview,
            data: res.data,
            confirmationId: res.confirmationId,
          },
        ])
      } catch (err: any) {
        setLoading(false)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: 'An error occurred while processing the file upload.',
            error: err.message || 'File upload failed',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      }
      return
    }

    setInputText('')
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        timestamp: userTimestamp,
      },
    ])

    setLoading(true)

    try {
      const res: AgentResponseData = await agentService.sendAgentMessage(textToSend)
      setLoading(false)

      const agentMsgId = (Date.now() + 1).toString()
      if (res.confirmationId) setActiveConfirmationId(res.confirmationId)

      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: 'agent',
          text: res.aiMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          intent: res.intent,
          explanation: res.explanation,
          status: res.status,
          preview: res.preview,
          data: res.data,
          confirmationId: res.confirmationId,
        },
      ])
    } catch (err: any) {
      setLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: 'Operation request failed.',
          error: err.message || 'Error processing command.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }

  const handleConfirmAction = async (confirmationId: string) => {
    setLoading(true)
    try {
      const res = await agentService.confirmAgentAction(confirmationId)
      setLoading(false)
      setActiveConfirmationId(null)

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: res.aiMessage,
          status: 'COMPLETED',
          intent: res.intent,
          data: res.data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err: any) {
      setLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: 'Execution of action failed.',
          error: err.message || 'Confirmation failed.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }

  const handleCancelAction = async (confirmationId: string) => {
    setLoading(true)
    try {
      const res = await agentService.cancelAgentAction(confirmationId)
      setLoading(false)
      setActiveConfirmationId(null)

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: res.aiMessage,
          status: 'CANCELLED',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err: any) {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  // Quick Action Shortcut Cards
  const actionCards = [
    {
      title: 'Create Questions',
      description: 'Generate Aptitude or Verbal questions',
      prompt: 'Create 10 medium aptitude questions about percentage.',
      icon: Brain,
    },
    {
      title: 'Create Assessment',
      description: 'Build an assessment from your Question Bank',
      prompt: 'Create a 40 minute aptitude assessment with 30 questions.',
      icon: FileCheck,
    },
    {
      title: 'Assign Assessment',
      description: 'Assign tests to selected students',
      prompt: 'Assign Aptitude Test 1 to all third year AI students.',
      icon: Users,
    },
    {
      title: 'Candidate Management',
      description: 'Find, import, or manage candidates',
      prompt: 'Show all AI third year students.',
      icon: Search,
    },
    {
      title: 'Result Analysis',
      description: 'Analyze assessment performance',
      prompt: 'Analyze the latest aptitude assessment results.',
      icon: BarChart3,
    },
    {
      title: 'Live Monitoring',
      description: 'See students currently taking assessments',
      prompt: 'Who is currently writing the exam?',
      icon: Radio,
    },
    {
      title: 'Question Bank',
      description: 'Search and manage questions',
      prompt: 'Find duplicate questions in the Question Bank.',
      icon: HelpCircle,
    },
    {
      title: 'Admin Copilot Help',
      description: 'Platform guidance, features & command guide',
      prompt: 'Help: What can Skill AI Copilot do for me as an Admin?',
      icon: Sparkles,
    },
  ]

  // Render text formatting (markdown bolding)
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-sans">
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR: SKILL AI COMPACT NAVIGATION */}
      {/* ========================================================= */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 p-4 border-r border-slate-800">
        <div className="space-y-4">
          {/* Top Brand Header */}
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h2 className="font-extrabold text-white text-base tracking-tight leading-tight">SKILL AI</h2>
              <p className="text-[11px] text-indigo-300 font-medium truncate">Admin Copilot & Agent</p>
            </div>
          </div>

          {/* + New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-1 text-xs pt-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                activeTab === 'chats'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Chats</span>
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                activeTab === 'tools'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>API / Tools</span>
            </button>
          </nav>

          {/* Recent Conversations History */}
          <div className="pt-2 space-y-2 overflow-y-auto max-h-[calc(100vh-23rem)] text-xs">
            <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Recent Conversations</span>
              <Clock className="w-3 h-3 text-slate-400" />
            </div>

            {sessions.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-400 text-center italic rounded-xl bg-slate-800/30 border border-slate-800">
                No recent conversations
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    currentSessionId === s.id
                      ? 'bg-slate-800 text-white font-semibold border border-indigo-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[170px]">{s.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Sidebar: Admin Account & Real Status */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Status</span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">Gemini Engine API via Backend</p>
          </div>

          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="truncate text-xs">
              <p className="font-semibold text-white truncate">{profile?.name || 'Admin User'}</p>
              <p className="text-[10px] text-slate-400 truncate">Admin Account</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN WORKSPACE: WHITE PREMIUM LIGHT CANVAS */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-50/50">
        {/* Workspace Canvas Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-center">
          {messages.length === 0 ? (
            /* WELCOME SCREEN */
            <div className="max-w-4xl w-full flex flex-col items-center justify-center text-center space-y-6 my-auto">
              {/* SKILL AI Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>

              {/* Header Titles */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>SKILL AI • ADMIN OPERATING COPILOT</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  How can Skill AI Copilot assist you?
                </h1>
                <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
                  Your dedicated Admin Copilot for natural language test creation, student batch assignment, real-time proctoring telemetry, and instant platform guidance.
                </p>
              </div>

              {/* Quick Action Shortcut Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full pt-4">
                {actionCards.map((card, idx) => {
                  const IconComp = card.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.prompt)}
                      className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md text-left transition-all space-y-2.5 group flex flex-col justify-between"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors">
                          {card.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{card.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* ACTIVE CONVERSATION THREAD */
            <div className="w-full max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-900 text-indigo-400 shadow-xs'
                    }`}
                  >
                    {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-2 max-w-2xl">
                    {msg.sender === 'agent' && msg.intent && (
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-700 font-mono w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        <span>Intent: <b className="uppercase">{msg.intent}</b></span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl p-5 text-xs sm:text-sm shadow-xs ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none space-y-4'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{renderFormattedText(msg.text)}</div>

                      {msg.error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{msg.error}</span>
                        </div>
                      )}

                      {/* Interactive Action Confirmation Card */}
                      {msg.status === 'WAITING_FOR_CONFIRMATION' && msg.preview && (
                        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-3">
                          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                            <span className="text-amber-800 font-bold text-xs flex items-center gap-1.5">
                              <Clock className="w-4 h-4 animate-spin text-amber-600" /> Confirmation Required
                            </span>
                            <span className="text-[10px] font-mono text-amber-700">Ref: {msg.confirmationId?.substring(0, 8)}</span>
                          </div>

                          <div className="text-xs space-y-1.5 text-slate-700">
                            <div className="font-bold text-slate-900 text-sm">{msg.preview.actionSummary}</div>
                            {msg.preview.totalMatchingStudents != null && (
                              <div className="text-slate-600">
                                Target Candidates: <b className="text-slate-900">{msg.preview.totalMatchingStudents}</b> | New Assignments: <b className="text-emerald-700">{msg.preview.newAssignmentsCount}</b>
                              </div>
                            )}
                          </div>

                          {activeConfirmationId === msg.confirmationId && (
                            <div className="flex items-center gap-2.5 pt-2">
                              <button
                                onClick={() => msg.confirmationId && handleConfirmAction(msg.confirmationId)}
                                className="flex-1 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirm Action</span>
                              </button>
                              <button
                                onClick={() => msg.confirmationId && handleCancelAction(msg.confirmationId)}
                                className="py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                              >
                                <XCircle className="w-4 h-4 text-slate-500" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Executed Data Result Card */}
                      {msg.status === 'COMPLETED' && msg.data && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                            <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Operational Result
                            </span>
                          </div>

                          {msg.data.domains && (
                            <div className="space-y-3 text-xs">
                              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                <span>{msg.data.role} ({msg.data.copilot})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {msg.data.domains.map((dom: any, dIdx: number) => (
                                  <div key={dIdx} className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                                    <h4 className="font-bold text-slate-900 text-xs">{dom.title}</h4>
                                    <ul className="space-y-1">
                                      {dom.examples.map((ex: string, eIdx: number) => (
                                        <li
                                          key={eIdx}
                                          onClick={() => handleSendMessage(ex)}
                                          className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                                          title="Click to run command"
                                        >
                                          <span>→</span>
                                          <span className="truncate">{ex}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.data.candidates && (
                            <div className="space-y-2 text-xs">
                              <div className="text-slate-600">Candidates Found: <b className="text-slate-900">{msg.data.totalFound || msg.data.candidates.length}</b></div>
                              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                                {msg.data.candidates.slice(0, 10).map((c: any) => (
                                  <div key={c.id || c.register_number} className="p-2.5 flex items-center justify-between">
                                    <div>
                                      <div className="font-bold text-slate-900">{c.full_name}</div>
                                      <div className="text-[11px] text-slate-500 font-mono">{c.register_number} | {c.department || 'N/A'} {c.year ? `Year ${c.year}` : ''}</div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">Active</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!msg.data.candidates && !msg.data.domains && (
                            <pre className="text-[11px] font-mono bg-white p-3 rounded-lg overflow-x-auto text-slate-800 border border-slate-200 max-h-48">
                              {JSON.stringify(msg.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] mt-1 text-right text-slate-400 font-mono">{msg.timestamp}</div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 text-slate-500 text-xs py-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center shadow-xs">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <span className="font-mono text-indigo-600 animate-pulse">Skill AI is selecting tools and executing operation...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Selected File Upload Badge */}
        {selectedFile && (
          <div className="px-6 py-2.5 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
              <span>Ready for import: <b className="font-bold">{selectedFile.name}</b> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={fileCategory}
                onChange={(e: any) => setFileCategory(e.target.value)}
                className="bg-white text-slate-800 text-xs rounded-lg border border-slate-300 px-2.5 py-1 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="QUESTIONS">Question Bank File (.xlsx/.csv/.txt/.html)</option>
                <option value="CANDIDATES">Candidate List File (.xlsx/.csv)</option>
              </select>
              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-600">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. CHAT COMPOSER: PREMIUM LIGHT CHAT INPUT */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto rounded-2xl bg-white border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 shadow-sm transition-all p-3 space-y-3">
            {/* Input Field */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="w-full"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isRecording ? 'Listening to voice command...' : 'Ask Skill AI Copilot anything... (e.g. create questions, assign test, or "help")'}
                disabled={loading}
                className="w-full bg-transparent border-none text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 px-2 py-1"
              />
            </form>

            {/* Toolbar Row */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 px-1 text-xs text-slate-500">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.csv,.txt,.html,.htm"
                className="hidden"
              />

              {/* Left File Attachment */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Question Bank or Candidate List"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  <span>Attach File</span>
                </button>
              </div>

              {/* Right Model Badge & Mic & Send */}
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Skill AI Copilot | Connected</span>
                </div>

                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  title={isRecording ? 'Listening...' : 'Voice command'}
                  className={`p-2 rounded-xl transition-all ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || (!inputText.trim() && !selectedFile)}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-xs shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
