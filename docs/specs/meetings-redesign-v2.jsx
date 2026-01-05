import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar, Clock, Users, Video, MapPin, FileText, Brain, 
  ChevronRight, ChevronDown, Play, RefreshCw, UserPlus, 
  MoreHorizontal, Sparkles, TrendingUp, AlertCircle, CheckCircle2,
  ExternalLink, MessageSquare, Target, Lightbulb, Building2,
  ArrowRight, Filter, Search, Mic, BarChart3, Zap, X, Check,
  Plus, GripVertical, Send, EyeOff, Link2, Pencil
} from 'lucide-react';

// Mock data
const customers = [
  { id: 1, name: "Burgess Pest", type: "customer" },
  { id: 2, name: "Lawn Doctor of Warren", type: "customer" },
  { id: 3, name: "Cal Termite And Pest", type: "customer" },
  { id: 4, name: "Oasis Turf & Tree", type: "customer" },
  { id: 5, name: "Voiceforpest", type: "customer" },
  { id: 6, name: "Patriot Pest Management", type: "customer" },
  { id: 7, name: "JP McHale Pest Management", type: "customer" },
  { id: 8, name: "Aantex", type: "customer" },
];

const teamMembers = [
  { id: 1, name: "Brent", avatar: "B" },
  { id: 2, name: "Madi", avatar: "M" },
  { id: 3, name: "Engineering", avatar: "E" },
  { id: 4, name: "AI Team", avatar: "AI" },
  { id: 5, name: "Success", avatar: "S" },
  { id: 6, name: "Dev Team", avatar: "D" },
];

const initialUpcomingMeetings = [
  {
    id: 1,
    title: "Discovery Call with Lawn Doctor of Warren",
    company: "Lawn Doctor of Warren",
    customerId: 2,
    time: "11:00 AM",
    duration: "30m",
    attendees: 2,
    type: "video",
    isToday: false,
    isTomorrow: true,
    date: "Tomorrow",
    excluded: false,
    prep: {
      summary: "First discovery call with a mid-size lawn care company in New Jersey. They currently use ServiceTitan but are exploring alternatives due to pricing concerns.",
      keyPoints: [
        "Annual revenue ~$2.4M, 12 technicians",
        "Pain point: ServiceTitan costs increased 40% last renewal",
        "Decision maker: Owner + Operations Manager"
      ],
      suggestedQuestions: [
        "What specific features in ServiceTitan do you use most?",
        "How are you currently handling customer communications?",
        "What's your timeline for making a decision?"
      ],
      relatedDeals: { stage: "Discovery", value: "$18,000 ARR" }
    }
  },
  {
    id: 2,
    title: "Follow Up from Conversations with Margo",
    company: null,
    customerId: null,
    subtitle: "Schedule AI Demo",
    time: "1:30 PM",
    duration: "30m",
    attendees: 3,
    type: "video",
    isToday: false,
    isTomorrow: true,
    date: "Tomorrow",
    excluded: false,
    prep: {
      summary: "Follow-up to discuss AI scheduling capabilities. Margo expressed interest in automating their appointment booking process.",
      keyPoints: [
        "Previous call: Discussed pain points with manual scheduling",
        "Interested in: SMS-based scheduling, calendar integration",
        "Competitor evaluation: Also looking at Jobber"
      ],
      suggestedQuestions: [
        "Have you had a chance to review the proposal I sent?",
        "What questions came up after our last conversation?",
        "Would a pilot program help with the decision process?"
      ],
      relatedDeals: { stage: "Demo", value: "$24,000 ARR" }
    }
  },
  {
    id: 3,
    title: "AI Demo with Cal Termite and Pest Control",
    company: "Cal Termite And Pest",
    customerId: 3,
    time: "2:00 PM",
    duration: "1h",
    attendees: 4,
    type: "video",
    isToday: false,
    isTomorrow: true,
    date: "Tomorrow",
    excluded: false,
    prep: {
      summary: "Full platform demo for California-based pest control company. They're a warm lead from the PestWorld conference.",
      keyPoints: [
        "Met at PestWorld 2024, strong interest in AI features",
        "Current stack: PestPac + manual processes",
        "25 technicians, multi-location operation"
      ],
      suggestedQuestions: [
        "How is PestPac working for your multi-location needs?",
        "What would an ideal AI assistant do for your team?",
        "Who else needs to be involved in the evaluation?"
      ],
      relatedDeals: { stage: "Demo", value: "$36,000 ARR" }
    }
  },
  {
    id: 4,
    title: "Team Standup",
    company: null,
    customerId: null,
    time: "9:00 AM",
    duration: "15m",
    attendees: 5,
    type: "video",
    isToday: false,
    isTomorrow: true,
    date: "Tomorrow",
    excluded: false,
    prep: null
  }
];

const initialPastMeetings = [
  {
    id: 101,
    title: "x-rai - AI Agent Session - Burgess Pest",
    company: "Burgess Pest",
    customerId: 1,
    date: "Dec 7, 2025",
    duration: "47m",
    attendees: 3,
    excluded: false,
    hasTranscript: true,
    transcript: {
      status: "analyzed",
      words: 12286,
      sentiment: "very_positive",
      signals: 3,
      actions: 7,
      summary: "Productive session covering AI agent configuration and workflow setup. Customer showed strong enthusiasm for automation capabilities.",
      keyInsights: [
        "Customer wants to automate 80% of inbound calls",
        "Concerned about AI handling complex pest identification",
        "Ready to move forward with pilot program"
      ],
      actionItems: [
        { id: 1, text: "Send pilot program proposal", assigneeId: 1, assignee: "Brent", due: "2025-12-10", status: "pending" },
        { id: 2, text: "Schedule technical setup call", assigneeId: 3, assignee: "Engineering", due: "2025-12-12", status: "pending" },
        { id: 3, text: "Prepare custom AI training data", assigneeId: 4, assignee: "AI Team", due: "2025-12-15", status: "in_progress" }
      ]
    }
  },
  {
    id: 102,
    title: "ATS/VFP Mobile App Meeting",
    company: "Voiceforpest",
    customerId: 5,
    subtitle: "Rose Pest/Franklin Pest",
    date: "Dec 7, 2025",
    duration: "52m",
    attendees: 4,
    excluded: false,
    hasTranscript: true,
    transcript: {
      status: "analyzed",
      words: 4954,
      sentiment: "positive",
      signals: 4,
      actions: 5,
      summary: "Technical setup meeting for mobile app trial implementation. Discussed integration requirements and timeline.",
      keyInsights: [
        "Need API integration with existing ATS system",
        "Mobile app rollout planned for Q1 2026",
        "Training required for 15 field technicians"
      ],
      actionItems: [
        { id: 4, text: "Provide API documentation", assigneeId: 6, assignee: "Dev Team", due: "2025-12-14", status: "done" },
        { id: 5, text: "Create training materials", assigneeId: 5, assignee: "Success", due: "2025-12-20", status: "pending" }
      ]
    }
  },
  {
    id: 103,
    title: "x-rai - Marketing Setup - Oasis Turf",
    company: "Oasis Turf & Tree",
    customerId: 4,
    date: "Dec 11, 2025",
    duration: "35m",
    attendees: 2,
    excluded: false,
    hasTranscript: true,
    transcript: {
      status: "analyzed",
      words: 2496,
      sentiment: "positive",
      signals: 3,
      actions: 6,
      summary: "Marketing setup call to integrate Oasis Turf's call tracking with the X-Ray platform.",
      keyInsights: [
        "Currently using CallRail for tracking",
        "Want unified reporting dashboard",
        "Interested in AI-powered lead scoring"
      ],
      actionItems: [
        { id: 6, text: "Set up CallRail integration", assigneeId: 3, assignee: "Integrations", due: "2025-12-18", status: "pending" }
      ]
    }
  },
  {
    id: 104,
    title: "PestPac Training with Madi",
    company: null,
    customerId: null,
    date: "Dec 14, 2025",
    duration: "1h 12m",
    attendees: 2,
    excluded: false,
    hasTranscript: true,
    transcript: {
      status: "pending",
      words: 12882,
      sentiment: null,
      signals: null,
      actions: null,
      summary: null
    }
  }
];

const processingQueue = [
  { id: 201, title: "x-rai Review - Aantex", status: "analyzing", progress: 75, words: 4846 },
  { id: 202, title: "Training - JP McHale", status: "queued", progress: 0, words: 9258 },
  { id: 203, title: "Onboarding - Patriot Pest", status: "queued", progress: 0, words: 12888 }
];

// Inline Editable Text Component
const EditableText = ({ value, onSave, className = "", placeholder = "Enter text..." }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleSave = () => {
    onSave(text);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setText(value);
      setIsEditing(false);
    }
  };
  
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-white border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        placeholder={placeholder}
      />
    );
  }
  
  return (
    <span 
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 ${className}`}
    >
      {value || <span className="text-slate-400 italic">{placeholder}</span>}
    </span>
  );
};

// Assignee Dropdown Component
const AssigneeDropdown = ({ assigneeId, assignee, onAssign }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        @{assignee}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
          {teamMembers.map(member => (
            <button
              key={member.id}
              onClick={() => { onAssign(member); setIsOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                member.id === assigneeId ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                {member.avatar}
              </span>
              {member.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Date Picker Dropdown
const DateDropdown = ({ date, onDateChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        Due {formatDate(date)}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
          <input
            type="date"
            value={date}
            onChange={(e) => { onDateChange(e.target.value); setIsOpen(false); }}
            className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
};

// Customer Assignment Dropdown
const CustomerDropdown = ({ customerId, company, onAssign, customers }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-colors ${
          customerId 
            ? 'text-slate-600 hover:bg-slate-100' 
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        }`}
      >
        <Building2 className="w-3.5 h-3.5" />
        {company || 'Assign Customer'}
        {!customerId && <Plus className="w-3 h-3" />}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[220px]">
          <div className="px-2 pb-1">
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {customerId && (
              <button
                onClick={() => { onAssign(null, null); setIsOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Remove assignment
              </button>
            )}
            {filteredCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => { onAssign(customer.id, customer.name); setIsOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                  customer.id === customerId ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                {customer.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Action Item Row Component
const ActionItemRow = ({ action, onUpdate, onDelete, onStatusChange }) => {
  const statusStyles = {
    pending: "border-slate-300 bg-white",
    in_progress: "border-blue-400 bg-blue-100",
    done: "border-emerald-400 bg-emerald-400"
  };
  
  const cycleStatus = () => {
    const order = ['pending', 'in_progress', 'done'];
    const currentIndex = order.indexOf(action.status);
    const nextStatus = order[(currentIndex + 1) % order.length];
    onStatusChange(action.id, nextStatus);
  };
  
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg bg-slate-50 group hover:bg-slate-100 transition-colors ${
      action.status === 'done' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={cycleStatus}
          className={`w-4.5 h-4.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${statusStyles[action.status]}`}
        >
          {action.status === 'done' && <Check className="w-3 h-3 text-white" />}
          {action.status === 'in_progress' && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
        </button>
        <span className={`text-sm text-slate-700 ${action.status === 'done' ? 'line-through text-slate-400' : ''}`}>
          <EditableText 
            value={action.text} 
            onSave={(newText) => onUpdate(action.id, { text: newText })}
          />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AssigneeDropdown
          assigneeId={action.assigneeId}
          assignee={action.assignee}
          onAssign={(member) => onUpdate(action.id, { assigneeId: member.id, assignee: member.name })}
        />
        <span className="text-slate-300">•</span>
        <DateDropdown
          date={action.due}
          onDateChange={(newDate) => onUpdate(action.id, { due: newDate })}
        />
        <button
          onClick={() => onDelete(action.id)}
          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const SentimentBadge = ({ sentiment }) => {
  const configs = {
    very_positive: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Very Positive" },
    positive: { bg: "bg-green-100", text: "text-green-700", label: "Positive" },
    neutral: { bg: "bg-slate-100", text: "text-slate-600", label: "Neutral" },
    negative: { bg: "bg-orange-100", text: "text-orange-700", label: "Negative" }
  };
  const config = configs[sentiment] || configs.neutral;
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

const MeetingPrepCard = ({ meeting, isExpanded, onToggle, onExclude, onAssignCustomer }) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div 
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{meeting.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.customerId}
                company={meeting.company}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {meeting.time} · {meeting.duration}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {meeting.attendees}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {meeting.prep?.relatedDeals && (
            <div className="text-right mr-2 hidden sm:block">
              <div className="text-xs text-slate-400">{meeting.prep.relatedDeals.stage}</div>
              <div className="text-sm font-semibold text-emerald-600">{meeting.prep.relatedDeals.value}</div>
            </div>
          )}
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors">
            <Video className="w-4 h-4" />
            Join
          </button>
          <button 
            onClick={onExclude}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            title="Exclude meeting"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button 
            onClick={onToggle}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </div>
      
      {/* Expanded Content - Meeting Prep */}
      {isExpanded && meeting.prep && (
        <div className="border-t border-slate-100">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-slate-50">
            {[
              { id: 'overview', label: 'Overview', icon: Sparkles },
              { id: 'questions', label: 'Questions', icon: MessageSquare },
              { id: 'insights', label: 'Key Points', icon: Lightbulb }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600 leading-relaxed">{meeting.prep.summary}</p>
                </div>
              </div>
            )}
            
            {activeTab === 'questions' && (
              <div className="space-y-2">
                {meeting.prep.suggestedQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <Target className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{q}</span>
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'insights' && (
              <div className="space-y-2">
                {meeting.prep.keyPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{point}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* No Prep Available */}
      {isExpanded && !meeting.prep && (
        <div className="border-t border-slate-100 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No meeting prep available</p>
          <p className="text-xs text-slate-400 mt-1">This appears to be an internal meeting</p>
        </div>
      )}
    </div>
  );
};

const PastMeetingCard = ({ meeting, isExpanded, onToggle, onExclude, onAssignCustomer, onUpdateAction, onDeleteAction, onStatusChange, onAddAction }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [newActionText, setNewActionText] = useState('');
  const t = meeting.transcript;
  
  const handleAddAction = () => {
    if (newActionText.trim()) {
      onAddAction(meeting.id, {
        id: Date.now(),
        text: newActionText.trim(),
        assigneeId: 1,
        assignee: "Brent",
        due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "pending"
      });
      setNewActionText('');
    }
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div 
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            t.status === 'analyzed' ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {t.status === 'analyzed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 truncate">{meeting.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.customerId}
                company={meeting.company}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span>{meeting.date}</span>
              <span>{meeting.duration}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {t.status === 'analyzed' && (
            <div className="hidden sm:flex items-center gap-3">
              <SentimentBadge sentiment={t.sentiment} />
              <div className="flex items-center gap-1 text-sm">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="text-purple-600 font-medium">{t.signals}</span>
                <span className="text-slate-300">/</span>
                <span className="text-blue-600 font-medium">{t.actions}</span>
              </div>
            </div>
          )}
          {t.status === 'pending' && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
              Pending Analysis
            </span>
          )}
          <button 
            onClick={onExclude}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            title="Exclude meeting"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button 
            onClick={onToggle}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && t.status === 'analyzed' && (
        <div className="border-t border-slate-100">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-slate-50">
            {[
              { id: 'summary', label: 'Summary', icon: FileText },
              { id: 'insights', label: 'Insights', icon: Lightbulb },
              { id: 'actions', label: `Actions (${t.actionItems?.length || 0})`, icon: Target }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
              <Brain className="w-4 h-4" />
              Full AI Analysis
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'summary' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">{t.summary}</p>
                <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
                  <span>{t.words.toLocaleString()} words</span>
                  <span>•</span>
                  <span>{meeting.attendees} participants</span>
                </div>
              </div>
            )}
            
            {activeTab === 'insights' && (
              <div className="space-y-2">
                {t.keyInsights?.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{insight}</span>
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'actions' && (
              <div className="space-y-2">
                {t.actionItems?.map((action) => (
                  <ActionItemRow
                    key={action.id}
                    action={action}
                    onUpdate={(actionId, updates) => onUpdateAction(meeting.id, actionId, updates)}
                    onDelete={(actionId) => onDeleteAction(meeting.id, actionId)}
                    onStatusChange={onStatusChange}
                  />
                ))}
                
                {/* Add New Action Item */}
                <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-slate-200 mt-3">
                  <Plus className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={newActionText}
                    onChange={(e) => setNewActionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                    placeholder="Add new action item..."
                    className="flex-1 text-sm bg-transparent focus:outline-none text-slate-600 placeholder-slate-400"
                  />
                  {newActionText && (
                    <button
                      onClick={handleAddAction}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Pending Analysis State */}
      {isExpanded && t.status === 'pending' && (
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center justify-center gap-3 py-6">
            <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-sm text-slate-500">Analysis in progress...</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ProcessingQueue = ({ items }) => {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              item.status === 'analyzing' ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              {item.status === 'analyzing' ? (
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-slate-900 truncate">{item.title}</div>
              <div className="text-xs text-slate-400">{item.words.toLocaleString()} words</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {item.status === 'analyzing' && (
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              item.status === 'analyzing' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              {item.status === 'analyzing' ? `${item.progress}%` : 'Queued'}
            </span>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors">
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function MeetingsPage() {
  const [upcomingMeetings, setUpcomingMeetings] = useState(initialUpcomingMeetings);
  const [pastMeetings, setPastMeetings] = useState(initialPastMeetings);
  const [expandedUpcoming, setExpandedUpcoming] = useState(new Set([1]));
  const [expandedPast, setExpandedPast] = useState(new Set([101]));
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [pastFilter, setPastFilter] = useState('all');
  const [showExcluded, setShowExcluded] = useState(false);
  
  const toggleUpcoming = (id) => {
    const newSet = new Set(expandedUpcoming);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedUpcoming(newSet);
  };
  
  const togglePast = (id) => {
    const newSet = new Set(expandedPast);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedPast(newSet);
  };
  
  const excludeUpcoming = (id) => {
    setUpcomingMeetings(prev => prev.map(m => 
      m.id === id ? { ...m, excluded: true } : m
    ));
  };
  
  const excludePast = (id) => {
    setPastMeetings(prev => prev.map(m => 
      m.id === id ? { ...m, excluded: true } : m
    ));
  };
  
  const assignCustomerUpcoming = (meetingId, customerId, company) => {
    setUpcomingMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, customerId, company } : m
    ));
  };
  
  const assignCustomerPast = (meetingId, customerId, company) => {
    setPastMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, customerId, company } : m
    ));
  };
  
  const updateAction = (meetingId, actionId, updates) => {
    setPastMeetings(prev => prev.map(m => {
      if (m.id !== meetingId) return m;
      return {
        ...m,
        transcript: {
          ...m.transcript,
          actionItems: m.transcript.actionItems.map(a =>
            a.id === actionId ? { ...a, ...updates } : a
          )
        }
      };
    }));
  };
  
  const deleteAction = (meetingId, actionId) => {
    setPastMeetings(prev => prev.map(m => {
      if (m.id !== meetingId) return m;
      return {
        ...m,
        transcript: {
          ...m.transcript,
          actionItems: m.transcript.actionItems.filter(a => a.id !== actionId)
        }
      };
    }));
  };
  
  const changeActionStatus = (meetingId, actionId, status) => {
    updateAction(meetingId, actionId, { status });
  };
  
  const addAction = (meetingId, action) => {
    setPastMeetings(prev => prev.map(m => {
      if (m.id !== meetingId) return m;
      return {
        ...m,
        transcript: {
          ...m.transcript,
          actionItems: [...m.transcript.actionItems, action]
        }
      };
    }));
  };
  
  const visibleUpcoming = upcomingMeetings.filter(m => showExcluded || !m.excluded);
  const visiblePast = pastMeetings.filter(m => showExcluded || !m.excluded);
  
  const filteredPast = visiblePast.filter(m => {
    if (pastFilter === 'all') return true;
    if (pastFilter === 'analyzed') return m.transcript.status === 'analyzed';
    if (pastFilter === 'pending') return m.transcript.status === 'pending';
    return true;
  });
  
  const excludedCount = upcomingMeetings.filter(m => m.excluded).length + pastMeetings.filter(m => m.excluded).length;
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Stats Bar */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
              <p className="text-sm text-slate-500 mt-0.5">Prepare, review, and analyze your meetings</p>
            </div>
            <div className="flex items-center gap-3">
              {excludedCount > 0 && (
                <button 
                  onClick={() => setShowExcluded(!showExcluded)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
                    showExcluded 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <EyeOff className="w-4 h-4" />
                  {excludedCount} excluded
                </button>
              )}
              <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Mic className="w-4 h-4" />
                Upload Recording
              </button>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[
              { label: "Today", value: "2", sublabel: "meetings", color: "text-blue-600", bg: "bg-blue-50" },
              { label: "This Week", value: "8", sublabel: "scheduled", color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Analyzed", value: "72", sublabel: "transcripts", color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Action Items", value: "23", sublabel: "pending", color: "text-amber-600", bg: "bg-amber-50" }
            ].map((stat, i) => (
              <div key={i} className={`${stat.bg} rounded-lg p-3 border border-slate-100`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                  <span className="text-sm text-slate-500">{stat.sublabel}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Upcoming Meetings Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming Meetings</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                {visibleUpcoming.length} scheduled
              </span>
            </div>
            <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors">
              View Calendar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Tomorrow Label */}
            <div className="flex items-center gap-2 text-sm text-slate-400 uppercase tracking-wide font-medium">
              <Calendar className="w-4 h-4" />
              Tomorrow
            </div>
            
            {visibleUpcoming.slice(0, showAllUpcoming ? undefined : 3).map(meeting => (
              <div key={meeting.id} className={meeting.excluded ? 'opacity-50' : ''}>
                <MeetingPrepCard
                  meeting={meeting}
                  isExpanded={expandedUpcoming.has(meeting.id)}
                  onToggle={() => toggleUpcoming(meeting.id)}
                  onExclude={() => excludeUpcoming(meeting.id)}
                  onAssignCustomer={(customerId, company) => assignCustomerUpcoming(meeting.id, customerId, company)}
                />
              </div>
            ))}
            
            {visibleUpcoming.length > 3 && (
              <button 
                onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllUpcoming ? 'Show less' : `Show ${visibleUpcoming.length - 3} more this week`}
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllUpcoming ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </section>
        
        {/* Past Meetings & Transcripts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Past Meetings & Analysis</h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded">
                {visiblePast.filter(m => m.transcript.status === 'analyzed').length} analyzed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'analyzed', label: 'Analyzed' },
                  { id: 'pending', label: 'Pending' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPastFilter(f.id)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      pastFilter === f.id 
                        ? 'bg-slate-100 text-slate-900' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-slate-400" />
              </button>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredPast.slice(0, showAllPast ? undefined : 4).map(meeting => (
              <div key={meeting.id} className={meeting.excluded ? 'opacity-50' : ''}>
                <PastMeetingCard
                  meeting={meeting}
                  isExpanded={expandedPast.has(meeting.id)}
                  onToggle={() => togglePast(meeting.id)}
                  onExclude={() => excludePast(meeting.id)}
                  onAssignCustomer={(customerId, company) => assignCustomerPast(meeting.id, customerId, company)}
                  onUpdateAction={updateAction}
                  onDeleteAction={deleteAction}
                  onStatusChange={(actionId, status) => changeActionStatus(meeting.id, actionId, status)}
                  onAddAction={addAction}
                />
              </div>
            ))}
            
            {filteredPast.length > 4 && (
              <button 
                onClick={() => setShowAllPast(!showAllPast)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllPast ? 'Show less' : `Show ${filteredPast.length - 4} more`}
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllPast ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </section>
        
        {/* Processing Queue Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Processing Queue</h2>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-sm font-medium rounded">
                {processingQueue.length} in queue
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors">
                <UserPlus className="w-4 h-4" />
                Bulk Assign
              </button>
            </div>
          </div>
          
          <ProcessingQueue items={processingQueue} />
        </section>
      </div>
    </div>
  );
}
