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
  RotateCcw,
  Search,
  PanelRightClose,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Brain,
  FileCheck,
  Users,
  BarChart3,
  Layers,
  Globe,
  Volume2,
  VolumeX
} from 'lucide-react'
import { agentService, type AgentResponseData } from '../../services/agentService'

interface ChatMessage {
  id: string
  sender: 'user' | 'agent'
  text: string
  timestamp: string
  intent?: string
  status?: string
  preview?: any
  data?: any
  confirmationId?: string
  error?: string
}

interface HistoryItem {
  id: string
  title: string
  timestamp: string
}

interface SkillAIFloatingAgentProps {
  isOpen?: boolean
  onOpen?: () => void
  onClose?: () => void
}

export const SkillAIFloatingAgent: React.FC<SkillAIFloatingAgentProps> = ({
  isOpen: propIsOpen,
  onOpen: propOnOpen,
  onClose: propOnClose,
}) => {
  // Controlled or Internal Open State
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('skillAI.isOpen')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen

  const handleOpen = () => {
    if (propOnOpen) propOnOpen()
    else setInternalIsOpen(true)
  }

  const handleClose = () => {
    if (propOnClose) propOnClose()
    else setInternalIsOpen(false)
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'ta-IN'>('en-US')
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileCategory, setFileCategory] = useState<'QUESTIONS' | 'CANDIDATES'>('QUESTIONS')
  const [activeConfirmationId, setActiveConfirmationId] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({})

  // Web Import Modal State
  const [showWebModal, setShowWebModal] = useState(false)
  const [webTab, setWebTab] = useState<'SEARCH' | 'URL' | 'PASTE'>('SEARCH')
  const [webQuery, setWebQuery] = useState('')
  const [webUrl, setWebUrl] = useState('')
  const [webPastedText, setWebPastedText] = useState('')
  const [webCategory, setWebCategory] = useState<'APTITUDE' | 'VERBAL'>('APTITUDE')
  const [webDifficulty, setWebDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM')
  const [webCount, setWebCount] = useState(20)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  // Speech Synthesis Helper
  const speakText = (text: string) => {
    if (!voiceFeedbackEnabled || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const clean = text.replace(/[*_#`\[\]]/g, ' ')
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = voiceLang === 'ta-IN' ? 'ta-IN' : 'en-US'
      utterance.rate = 1.0
      window.speechSynthesis.speak(utterance)
    } catch {
      // non-fatal
    }
  }

  // Persist Open State
  useEffect(() => {
    try {
      localStorage.setItem('skillAI.isOpen', JSON.stringify(isOpen))
    } catch {
      // ignore
    }
  }, [isOpen])

  // Fetch real conversation history
  const loadHistory = async () => {
    try {
      const res = await agentService.getAgentHistory()
      if (res && res.history && res.history.length > 0) {
        const mapped: HistoryItem[] = res.history.slice(-5).reverse().map((item: any, idx: number) => ({
          id: `hist-${idx}`,
          title: item.userMessage?.slice(0, 36) || `Chat ${idx + 1}`,
          timestamp: item.timestamp || 'Recently',
        }))
        setHistoryItems(mapped)
      } else {
        setHistoryItems([])
      }
    } catch {
      setHistoryItems([])
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen])

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen])

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

      recognition.onerror = () => setIsRecording(false)
      recognition.onend = () => setIsRecording(false)

      recognitionRef.current = recognition
    }
  }, [])

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your browser.')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      recognitionRef.current.lang = voiceLang === 'ta-IN' ? 'ta-IN' : 'en-US'
      setIsRecording(true)
      recognitionRef.current.start()
    }
  }

  const togglePreviewExpanded = (id: string) => {
    setExpandedPreviews((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Clear current active conversation without deleting server history
  const handleNewChat = () => {
    setMessages([])
    setActiveConfirmationId(null)
    setInputText('')
    setSelectedFile(null)
    setExpandedPreviews({})
    loadHistory()
  }

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputText
    if (!textToSend.trim() && !selectedFile) return

    const userMsgId = Date.now().toString()
    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (selectedFile) {
      const fileToUpload = selectedFile
      setSelectedFile(null)
      setInputText('')

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          text: `Uploaded file: ${fileToUpload.name} [Category: ${fileCategory}]`,
          timestamp: userTimestamp,
        },
      ])

      setLoading(true)
      try {
        const res = await agentService.uploadAgentFile(fileToUpload, fileCategory)
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
            text: 'File parsing failed.',
            error: err.message || 'File upload error',
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
      if (res.confirmationId) {
        setActiveConfirmationId(res.confirmationId)
      }

      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: 'agent',
          text: res.aiMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          intent: res.intent,
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
          text: 'Operation failed.',
          error: err.message || 'Error processing request.',
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

      // Notify any listeners to refresh active views
      try {
        window.dispatchEvent(new CustomEvent('skillai:action_confirmed', { detail: res }))
      } catch {
        // ignore
      }

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
          text: 'Action execution failed.',
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
    } catch {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleWebImportSubmit = async () => {
    setShowWebModal(false)
    setLoading(true)
    const userMsgId = Date.now().toString()
    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    let promptDesc = ''
    const payload: any = {
      category: webCategory,
      difficulty: webDifficulty,
      count: Number(webCount) || 20,
    }

    if (webTab === 'SEARCH') {
      payload.query = webQuery || 'Aptitude Placement Questions'
      promptDesc = `Online Web Search: "${payload.query}"`
    } else if (webTab === 'URL') {
      payload.url = webUrl
      promptDesc = `Extract Questions from URL: ${webUrl}`
    } else {
      payload.pastedText = webPastedText
      promptDesc = 'Import Questions from Pasted Text / Clipboard'
    }

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: promptDesc,
        timestamp: userTimestamp,
      },
    ])

    try {
      const res = await agentService.webImportQuestions(payload)
      setLoading(false)
      const agentMsgId = (Date.now() + 1).toString()
      if (res.confirmationId) {
        setActiveConfirmationId(res.confirmationId)
      }

      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: 'agent',
          text: res.aiMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          intent: res.intent,
          status: res.status,
          preview: res.preview,
          data: res.data,
          confirmationId: res.confirmationId,
        },
      ])

      speakText(res.aiMessage)
    } catch (err: any) {
      setLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: 'Web import failed.',
          error: err.message || 'Error importing questions from online source.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }

  // EXACTLY FOUR PRIMARY QUICK OPTIONS
  const quickOptions = [
    {
      title: 'Create Questions',
      description: 'Generate Aptitude or Verbal questions',
      prompt: 'Create 20 medium aptitude questions about percentage.',
      icon: Brain,
    },
    {
      title: 'Create Assessment',
      description: 'Build an assessment from the Question Bank',
      prompt: 'Create a 40 minute aptitude assessment with 30 questions.',
      icon: FileCheck,
    },
    {
      title: 'Assign Assessment',
      description: 'Assign an assessment to students',
      prompt: 'Assign Aptitude Test 1 to all third year AI students.',
      icon: Users,
    },
    {
      title: 'Result Analysis',
      description: 'Analyze assessment performance',
      prompt: 'Analyze Aptitude Test 1.',
      icon: BarChart3,
    },
  ]

  // Format bold markdown
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  // COLLAPSED FLOATING TRIGGER BUTTON (When closed)
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white font-semibold text-xs shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-indigo-400/40 cursor-pointer"
        title="Open Skill AI Agent"
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
        </div>
        <span className="tracking-wide">✦ Skill AI</span>
      </button>
    )
  }

  // SPLIT-PANEL RIGHT-SIDE AGENT (Full usable height, compact width 400px, desktop side-by-side flex layout)
  return (
    <aside
      className="w-full md:w-[400px] shrink-0 border-l border-slate-200 bg-white shadow-xl flex flex-col md:h-screen md:sticky md:top-0 h-screen fixed inset-0 z-50 md:z-30 text-slate-800 font-sans transition-all duration-200"
    >
      {/* ========================================================= */}
      {/* 1. COMPACT HEADER WITH BRANDING & TOP-RIGHT CONTROLS */}
      {/* ========================================================= */}
      <div className="h-14 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 select-none">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h2 className="font-extrabold text-xs tracking-tight text-slate-900 leading-tight">Skill AI</h2>
            <p className="text-[10px] text-slate-500 font-medium truncate">SkillsetrA Admin Agent</p>
          </div>
        </div>

        {/* Top-Right Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Voice Response Toggle */}
          <button
            onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              voiceFeedbackEnabled ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title={voiceFeedbackEnabled ? 'Voice feedback: ON (Click to mute)' : 'Voice feedback: OFF (Click to enable)'}
          >
            {voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleNewChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh / New Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleSendMessage('Help: What can Skill AI do for me?')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Search / Help"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Collapse Side Panel"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP TOOLBAR: NEW CHAT & WEB IMPORT */}
      {/* ========================================================= */}
      <div className="p-2.5 bg-slate-50/70 border-b border-slate-100 shrink-0 flex items-center gap-2">
        <button
          onClick={handleNewChat}
          className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>

        <button
          onClick={() => setShowWebModal(true)}
          className="py-1.5 px-3 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          title="Import Questions from Web Search, URL or Clipboard"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
          <span>Web Import</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. SCROLLABLE CONTENT (Four Quick Options + History / Chat) */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-slate-50/30 text-xs">
        {messages.length === 0 ? (
          /* INITIAL SCREEN: EXACTLY FOUR QUICK OPTIONS + RECENT CHATS */
          <div className="space-y-4 py-1">
            {/* Quick Actions Header */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                Quick Actions
              </span>

              {/* EXACTLY FOUR QUICK OPTIONS */}
              <div className="grid grid-cols-1 gap-2 mt-2">
                {quickOptions.map((opt, idx) => {
                  const IconC = opt.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(opt.prompt)}
                      className="w-full p-2.5 rounded-xl bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 text-left transition-all group flex items-start gap-2.5 shadow-2xs cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 mt-0.5">
                        <IconC className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate flex-1">
                        <div className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors">
                          {opt.title}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug truncate mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0 self-center" />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CHAT HISTORY SECTION */}
            <div className="pt-2 border-t border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Recent Chats
                </span>
                <Clock className="w-3 h-3 text-slate-400" />
              </div>

              {historyItems.length === 0 ? (
                <div className="p-3 text-[11px] text-slate-400 italic text-center rounded-xl bg-white border border-slate-200/60">
                  No recent chats
                </div>
              ) : (
                <div className="space-y-1.5">
                  {historyItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSendMessage(item.title)}
                      className="p-2 rounded-lg bg-white hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-300 cursor-pointer transition-all flex items-center justify-between text-left group shadow-2xs"
                    >
                      <span className="truncate text-[11px] text-slate-700 group-hover:text-indigo-700 font-medium">
                        {item.title}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ACTIVE CONVERSATION MESSAGES */
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-indigo-300'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div className="space-y-1.5 max-w-[88%] w-full">
                  {msg.sender === 'agent' && msg.intent && (
                    <div className="text-[9px] font-mono text-indigo-600 px-1 font-semibold uppercase">
                      Intent: {msg.intent}
                    </div>
                  )}

                  <div
                    className={`rounded-2xl p-3 text-xs shadow-2xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none font-medium ml-auto max-w-fit'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none space-y-2.5'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</div>

                    {msg.error && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{msg.error}</span>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* CRITICAL: RICH PREVIEW BEFORE EXECUTION WORKFLOW */}
                    {/* ========================================================= */}
                    {msg.status === 'WAITING_FOR_CONFIRMATION' && msg.preview && (
                      <div className="space-y-2">
                        {/* 1. QUESTION CREATION PREVIEW */}
                        {msg.preview.previewType === 'QUESTION_CREATION' || msg.intent === 'GENERATE_QUESTIONS' ? (
                          <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-3 space-y-2.5 text-xs shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                                <Brain className="w-4 h-4 text-indigo-600" />
                                <span>Question Creation Preview</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                Draft • Review
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-indigo-100/60">
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Topic</span>
                                <span className="font-semibold text-slate-800 truncate block">{msg.preview.topic || 'General'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category</span>
                                <span className="font-semibold text-slate-800">{msg.preview.category || 'APTITUDE'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Difficulty</span>
                                <span className="font-semibold text-slate-800">{msg.preview.difficulty || 'MEDIUM'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Questions</span>
                                <span className="font-bold text-indigo-700">{msg.preview.count || msg.preview.questions?.length || 20}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Marks Per Question</span>
                                <span className="font-semibold text-slate-800">{msg.preview.marks || 1} mark each</span>
                              </div>
                            </div>

                            {/* Preview Questions Toggle Button */}
                            <button
                              type="button"
                              onClick={() => togglePreviewExpanded(msg.id)}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Preview Questions ({msg.preview.questions?.length || msg.preview.count || 0})</span>
                              </span>
                              {expandedPreviews[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {/* Expanded Questions Detailed List */}
                            {expandedPreviews[msg.id] && msg.preview.questions && (
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 pt-1 border-t border-indigo-100">
                                {msg.preview.questions.map((q: any, qIdx: number) => (
                                  <div key={qIdx} className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] space-y-1.5">
                                    <div className="font-bold text-slate-900 leading-snug">
                                      Question {q.index || qIdx + 1}: {q.questionText}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                                      <div className={`p-1 rounded ${q.correctOption === 'A' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                                        A. {q.optionA}
                                      </div>
                                      <div className={`p-1 rounded ${q.correctOption === 'B' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                                        B. {q.optionB}
                                      </div>
                                      <div className={`p-1 rounded ${q.correctOption === 'C' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                                        C. {q.optionC}
                                      </div>
                                      <div className={`p-1 rounded ${q.correctOption === 'D' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                                        D. {q.optionD}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px] text-slate-500">
                                      <span>Correct: <b className="text-emerald-700 font-bold">{q.correctOption}</b></span>
                                      <span>{q.difficulty} • {q.marks || 1} mark</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Confirm & Add to Question Bank Button */}
                            {activeConfirmationId === msg.confirmationId && (
                              <div className="flex items-center gap-2 pt-1 border-t border-indigo-100">
                                <button
                                  onClick={() => msg.confirmationId && handleConfirmAction(msg.confirmationId)}
                                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm & Add to Question Bank</span>
                                </button>
                                <button
                                  onClick={() => msg.confirmationId && handleCancelAction(msg.confirmationId)}
                                  className="py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        ) : msg.preview.previewType === 'ASSESSMENT_CREATION' || msg.intent === 'CREATE_ASSESSMENT' ? (
                          /* 2. ASSESSMENT CREATION PREVIEW */
                          <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-3 space-y-2.5 text-xs shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                                <FileCheck className="w-4 h-4 text-indigo-600" />
                                <span>Assessment Preview</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Status: Draft
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-indigo-100/60">
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Title</span>
                                <span className="font-bold text-slate-900 text-xs">{msg.preview.title || 'Aptitude Assessment'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category</span>
                                <span className="font-semibold text-slate-800">{msg.preview.category || 'APTITUDE'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Duration</span>
                                <span className="font-semibold text-slate-800">{msg.preview.durationMinutes || 40} minutes</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Questions</span>
                                <span className="font-semibold text-slate-800">{msg.preview.questionCount || 30} selected</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Total Marks</span>
                                <span className="font-semibold text-slate-800">{msg.preview.totalMarks || msg.preview.questionCount || 30}</span>
                              </div>
                            </div>

                            {/* View Questions Toggle Button */}
                            <button
                              type="button"
                              onClick={() => togglePreviewExpanded(msg.id)}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View Questions Sample ({msg.preview.questionsSample?.length || msg.preview.questionCount || 0})</span>
                              </span>
                              {expandedPreviews[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {/* Expanded Questions Sample List */}
                            {expandedPreviews[msg.id] && msg.preview.questionsSample && (
                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 pt-1 border-t border-indigo-100">
                                {msg.preview.questionsSample.map((q: any, qIdx: number) => (
                                  <div key={qIdx} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] flex items-start justify-between gap-2">
                                    <div className="truncate flex-1">
                                      <span className="font-semibold text-slate-900 block truncate">
                                        {qIdx + 1}. {q.question_text || q.questionText}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {q.category || 'APTITUDE'} • {q.difficulty || 'MEDIUM'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600 shrink-0">
                                      {q.marks || 1} mark
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Confirm Create Button */}
                            {activeConfirmationId === msg.confirmationId && (
                              <div className="flex items-center gap-2 pt-1 border-t border-indigo-100">
                                <button
                                  onClick={() => msg.confirmationId && handleConfirmAction(msg.confirmationId)}
                                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm Create</span>
                                </button>
                                <button
                                  onClick={() => msg.confirmationId && handleCancelAction(msg.confirmationId)}
                                  className="py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        ) : msg.preview.previewType === 'ASSIGNMENT' || msg.intent === 'BULK_ASSIGN_ASSESSMENT' ? (
                          /* 3. ASSIGNMENT PREVIEW */
                          <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-3 space-y-2.5 text-xs shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span>Assignment Preview</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Cohort Target
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-indigo-100/60">
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Assessment</span>
                                <span className="font-bold text-slate-900 text-xs">{msg.preview.assessmentTitle}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Students</span>
                                <span className="font-semibold text-slate-800">{msg.preview.targetDepartment} • {msg.preview.targetYear}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Students Found</span>
                                <span className="font-bold text-indigo-700">{msg.preview.totalMatchingStudents}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">New Assignments</span>
                                <span className="font-bold text-emerald-700">{msg.preview.newAssignmentsCount}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Assignment Type</span>
                                <span className="text-slate-700">Individual Student Assignments</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Due Date</span>
                                <span className="text-slate-700">{msg.preview.dueAt || 'None (Standard Schedule)'}</span>
                              </div>
                            </div>

                            {/* View Students Toggle Button */}
                            <button
                              type="button"
                              onClick={() => togglePreviewExpanded(msg.id)}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View Students ({msg.preview.sampleStudents?.length || msg.preview.totalMatchingStudents || 0})</span>
                              </span>
                              {expandedPreviews[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {/* Expanded Students Sample List */}
                            {expandedPreviews[msg.id] && msg.preview.sampleStudents && (
                              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 pt-1 border-t border-indigo-100">
                                {msg.preview.sampleStudents.map((s: any, sIdx: number) => (
                                  <div key={sIdx} className="p-1.5 px-2 rounded bg-white border border-slate-200 text-[10px] flex items-center justify-between">
                                    <span className="font-semibold text-slate-800">{s.name}</span>
                                    <span className="text-slate-500 font-mono">{s.registerNumber}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Confirm Assignment Button */}
                            {activeConfirmationId === msg.confirmationId && (
                              <div className="flex items-center gap-2 pt-1 border-t border-indigo-100">
                                <button
                                  onClick={() => msg.confirmationId && handleConfirmAction(msg.confirmationId)}
                                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm Assignment</span>
                                </button>
                                <button
                                  onClick={() => msg.confirmationId && handleCancelAction(msg.confirmationId)}
                                  className="py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* 4. GENERAL PREVIEW CARD */
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-[11px]">
                            <div className="font-bold text-amber-900 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                              <span>Confirmation Required</span>
                            </div>
                            <div className="text-slate-700 font-medium">
                              {msg.preview.actionSummary || 'Action ready for review.'}
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePreviewExpanded(msg.id)}
                              className="text-[10px] font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{expandedPreviews[msg.id] ? 'Hide Details' : 'View Details'}</span>
                              {expandedPreviews[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {expandedPreviews[msg.id] && (
                              <pre className="text-[10px] font-mono bg-white p-2 rounded border border-amber-200 max-h-40 overflow-x-auto text-slate-700">
                                {JSON.stringify(msg.preview, null, 2)}
                              </pre>
                            )}

                            {activeConfirmationId === msg.confirmationId && (
                              <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                                <button
                                  onClick={() => msg.confirmationId && handleConfirmAction(msg.confirmationId)}
                                  className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Confirm</span>
                                </button>
                                <button
                                  onClick={() => msg.confirmationId && handleCancelAction(msg.confirmationId)}
                                  className="py-1.5 px-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* READ DATA / EXECUTION RESULT DISPLAY (Real Data Only) */}
                    {/* ========================================================= */}
                    {msg.data && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
                        {/* Candidates Read Data */}
                        {msg.data.candidates && Array.isArray(msg.data.candidates) && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span>Candidates Found</span>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">
                                {msg.data.totalFound || msg.data.candidates.length} total
                              </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1.5 bg-white">
                              {msg.data.candidates.map((c: any, cIdx: number) => (
                                <div key={cIdx} className="flex items-center justify-between text-[10px] p-1 border-b border-slate-100 last:border-b-0">
                                  <span className="font-semibold text-slate-800">{c.fullName || c.name || c.full_name}</span>
                                  <span className="font-mono text-slate-500">{c.registerNumber || c.register_number} • {c.department}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Result Analysis Read Data */}
                        {(msg.data.assessment || msg.data.passRate !== undefined || msg.data.averageScore !== undefined) && (
                          <div className="space-y-1.5">
                            <div className="font-bold text-indigo-950 flex items-center justify-between">
                              <span>{msg.data.assessment?.title || msg.data.title || 'Assessment Result Analysis'}</span>
                              {msg.data.status && (
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                                  {msg.data.status}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              {msg.data.totalStudents !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Students</span>
                                  <span className="font-bold text-slate-800">{msg.data.totalStudents}</span>
                                </div>
                              )}
                              {msg.data.completedCount !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Completed</span>
                                  <span className="font-bold text-emerald-700">{msg.data.completedCount}</span>
                                </div>
                              )}
                              {msg.data.averageScore !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Average Score</span>
                                  <span className="font-bold text-indigo-700">{msg.data.averageScore}%</span>
                                </div>
                              )}
                              {msg.data.passRate !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Pass Rate</span>
                                  <span className="font-bold text-purple-700">{msg.data.passRate}%</span>
                                </div>
                              )}
                              {msg.data.highestScore !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Highest</span>
                                  <span className="font-bold text-slate-800">{msg.data.highestScore}%</span>
                                </div>
                              )}
                              {msg.data.lowestScore !== undefined && (
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">Lowest</span>
                                  <span className="font-bold text-slate-800">{msg.data.lowestScore}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* General Result fallback */}
                        {!msg.data.candidates && !msg.data.assessment && msg.data.averageScore === undefined && (
                          <div>
                            <div className="font-bold text-emerald-700 flex items-center gap-1 mb-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Execution Output:</span>
                            </div>
                            <pre className="text-[10px] font-mono bg-white p-1.5 rounded overflow-x-auto text-slate-700 max-h-36 border border-slate-100">
                              {JSON.stringify(msg.data, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* DYNAMIC NEXT ACTION BUTTONS */}
                        {msg.status === 'COMPLETED' && (
                          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-1.5">
                            {(msg.intent === 'GENERATE_QUESTIONS' || msg.intent === 'IMPORT_QUESTIONS' || msg.intent === 'WEB_SEARCH_IMPORT') && (
                              <button
                                onClick={() => handleSendMessage('Create a 40 minute assessment using these questions.')}
                                className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] flex items-center gap-1 border border-indigo-200 cursor-pointer transition-colors"
                              >
                                <FileCheck className="w-3 h-3 text-indigo-600" />
                                <span>Create Assessment from these</span>
                              </button>
                            )}

                            {msg.intent === 'CREATE_ASSESSMENT' && (
                              <button
                                onClick={() => handleSendMessage(`Assign ${msg.data?.assessment?.title || 'this assessment'} to all CSE third year students.`)}
                                className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] flex items-center gap-1 border border-indigo-200 cursor-pointer transition-colors"
                              >
                                <Users className="w-3 h-3 text-indigo-600" />
                                <span>Assign to CSE 3rd Year Students</span>
                              </button>
                            )}

                            {(msg.intent === 'BULK_ASSIGN_ASSESSMENT' || msg.intent === 'VIEW_ASSESSMENT') && (
                              <button
                                onClick={() => handleSendMessage('Analyze results for this assessment.')}
                                className="px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-[10px] flex items-center gap-1 border border-purple-200 cursor-pointer transition-colors"
                              >
                                <BarChart3 className="w-3 h-3 text-purple-600" />
                                <span>Analyze Results</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-[9px] text-right text-slate-400 font-mono mt-0.5">{msg.timestamp}</div>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-[11px] py-1 px-1">
                <div className="w-5 h-5 rounded-md bg-slate-900 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-3 h-3 animate-spin" />
                </div>
                <span className="font-mono text-indigo-600 animate-pulse">Skill AI is processing...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Upload Badge */}
      {selectedFile && (
        <div className="px-3 py-1.5 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between text-[11px] text-indigo-950 shrink-0">
          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate font-semibold">{selectedFile.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={fileCategory}
              onChange={(e: any) => setFileCategory(e.target.value)}
              className="bg-white text-slate-800 text-[10px] rounded border border-slate-300 px-1.5 py-0.5 cursor-pointer"
            >
              <option value="QUESTIONS">Questions</option>
              <option value="CANDIDATES">Candidates</option>
            </select>
            <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CHAT INPUT AT THE BOTTOM */}
      {/* ========================================================= */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-1.5 bg-slate-50 rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 px-2.5 py-1.5 transition-all shadow-2xs"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.csv,.txt,.html,.htm"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach File (.xlsx, .csv, .txt, .html)"
            className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isRecording ? 'Listening...' : 'Ask Skill AI anything...'}
            disabled={loading}
            className="flex-1 bg-transparent border-none text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 px-1 py-0.5"
          />

          {/* Language Toggle Badge */}
          <button
            type="button"
            onClick={() => setVoiceLang(voiceLang === 'en-US' ? 'ta-IN' : 'en-US')}
            title={`Voice Language: ${voiceLang === 'en-US' ? 'English (Click for Tamil/Tanglish)' : 'Tamil / Tanglish (Click for English)'}`}
            className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 bg-white cursor-pointer transition-colors"
          >
            {voiceLang === 'en-US' ? 'EN' : 'தமிழ்'}
          </button>

          <button
            type="button"
            onClick={toggleVoiceRecording}
            title={isRecording ? 'Listening...' : `Voice command (${voiceLang === 'en-US' ? 'English' : 'Tamil/Tanglish'})`}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isRecording ? 'text-rose-600 animate-pulse' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            type="submit"
            disabled={loading || (!inputText.trim() && !selectedFile)}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all shadow-2xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* ========================================================= */}
      {/* 5. WEB / ONLINE IMPORT MODAL */}
      {/* ========================================================= */}
      {showWebModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-300" />
                <h3 className="font-bold text-sm">Import Questions from Web</h3>
              </div>
              <button
                onClick={() => setShowWebModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
              <button
                onClick={() => setWebTab('SEARCH')}
                className={`py-2 text-center transition-colors cursor-pointer ${
                  webTab === 'SEARCH' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Web Search
              </button>
              <button
                onClick={() => setWebTab('URL')}
                className={`py-2 text-center transition-colors cursor-pointer ${
                  webTab === 'URL' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Web Page URL
              </button>
              <button
                onClick={() => setWebTab('PASTE')}
                className={`py-2 text-center transition-colors cursor-pointer ${
                  webTab === 'PASTE' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paste Content / AI
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 text-xs">
              {webTab === 'SEARCH' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Search Query / Topic</label>
                  <input
                    type="text"
                    value={webQuery}
                    onChange={(e) => setWebQuery(e.target.value)}
                    placeholder="e.g. Profit and loss aptitude questions for campus placement"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <p className="text-[10px] text-slate-500">Searches approved online resources via configured provider.</p>
                </div>
              )}

              {webTab === 'URL' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Web Page URL</label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/aptitude-practice-questions"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <p className="text-[10px] text-slate-500">Extracts and sanitizes questions safely without running scripts.</p>
                </div>
              )}

              {webTab === 'PASTE' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Pasted Questions (ChatGPT, Notes, etc.)</label>
                  <textarea
                    rows={4}
                    value={webPastedText}
                    onChange={(e) => setWebPastedText(e.target.value)}
                    placeholder={'1. What is 20% of 200?\nA. 20\nB. 30\n>C. 40\nD. 50'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Use &gt; marker or standard Option A-D format for correct answer.</p>
                </div>
              )}

              {/* Category, Difficulty & Count */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Category</label>
                  <select
                    value={webCategory}
                    onChange={(e: any) => setWebCategory(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-xs bg-white"
                  >
                    <option value="APTITUDE">Aptitude</option>
                    <option value="VERBAL">Verbal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Difficulty</label>
                  <select
                    value={webDifficulty}
                    onChange={(e: any) => setWebDifficulty(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-xs bg-white"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={webCount}
                    onChange={(e) => setWebCount(Math.max(1, Math.min(50, Number(e.target.value) || 20)))}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWebModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWebImportSubmit}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Fetch &amp; Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
