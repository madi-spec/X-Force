'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  Video,
  Loader2,
  Plus,
  Trash2,
  Building2,
  Briefcase,
  Phone,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  MEETING_TYPES,
  MEETING_PLATFORMS,
  type MeetingType,
  type MeetingPlatform,
} from '@/lib/scheduler/types';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  dealId?: string;
  companyId?: string;
  companyProductId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
}

interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  title?: string;
  company_id?: string;
  company?: { id: string; name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface Deal {
  id: string;
  name: string;
  company_id: string;
  company?: { id: string; name: string } | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AvailableSlot {
  start: string;
  end: string;
  formatted: string;
}

const MEETING_TYPE_OPTIONS = [
  { value: MEETING_TYPES.DISCOVERY, label: 'Discovery Call' },
  { value: MEETING_TYPES.DEMO, label: 'Product Demo' },
  { value: MEETING_TYPES.FOLLOW_UP, label: 'Follow-up' },
  { value: MEETING_TYPES.TECHNICAL, label: 'Technical' },
  { value: MEETING_TYPES.EXECUTIVE, label: 'Executive' },
  { value: MEETING_TYPES.CUSTOM, label: 'Custom' },
];

const PLATFORM_OPTIONS = [
  { value: MEETING_PLATFORMS.TEAMS, label: 'Microsoft Teams' },
  { value: MEETING_PLATFORMS.ZOOM, label: 'Zoom' },
  { value: MEETING_PLATFORMS.GOOGLE_MEET, label: 'Google Meet' },
  { value: MEETING_PLATFORMS.PHONE, label: 'Phone Call' },
  { value: MEETING_PLATFORMS.IN_PERSON, label: 'In Person' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

export function QuickBookModal({
  isOpen,
  onClose,
  onSuccess,
  dealId: initialDealId,
  companyId: initialCompanyId,
  companyProductId: initialCompanyProductId,
  contactId,
  contactName,
  contactEmail,
}: QuickBookModalProps) {
  const supabase = createClient();

  // Form state
  const [meetingType, setMeetingType] = useState<MeetingType>(MEETING_TYPES.DISCOVERY);
  const [duration, setDuration] = useState(30);
  const [platform, setPlatform] = useState<MeetingPlatform>(MEETING_PLATFORMS.TEAMS);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');

  // Associations
  const [dealId, setDealId] = useState(initialDealId || '');
  const [companyId, setCompanyId] = useState(initialCompanyId || '');
  const [companyProductId, setCompanyProductId] = useState(initialCompanyProductId || '');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [companyProducts, setCompanyProducts] = useState<CompanyProduct[]>([]);

  // Search state
  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [dealSearch, setDealSearch] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);
  const [showCompanyResults, setShowCompanyResults] = useState(false);
  const [showDealResults, setShowDealResults] = useState(false);

  // Attendees
  const [internalAttendees, setInternalAttendees] = useState<Array<{ user_id: string; email: string }>>([]);
  const [externalAttendees, setExternalAttendees] = useState<Array<{
    contact_id?: string;
    name: string;
    email: string;
    title?: string;
  }>>([]);

  // Data for search
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Availability
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Date filtering for availability
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'availability'>('details');

  // Refs for click outside
  const contactSearchRef = useRef<HTMLDivElement>(null);
  const companySearchRef = useRef<HTMLDivElement>(null);
  const dealSearchRef = useRef<HTMLDivElement>(null);

  // Filtered results
  const filteredContacts = contacts.filter(c =>
    contactSearch.length >= 2 && (
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(contactSearch.toLowerCase())
    )
  ).slice(0, 8);

  const filteredCompanies = companies.filter(c =>
    companySearch.length >= 2 &&
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  ).slice(0, 8);

  const filteredDeals = deals.filter(d =>
    dealSearch.length >= 2 &&
    d.name.toLowerCase().includes(dealSearch.toLowerCase())
  ).slice(0, 8);

  // Filter slots by date
  const filteredSlots = availableSlots.filter(slot => {
    if (!filterDate && !filterDateEnd) return true;
    const slotDate = new Date(slot.start).toISOString().split('T')[0];
    if (filterDate && filterDateEnd) {
      return slotDate >= filterDate && slotDate <= filterDateEnd;
    }
    if (filterDate) {
      return slotDate === filterDate;
    }
    return true;
  });

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactSearchRef.current && !contactSearchRef.current.contains(e.target as Node)) {
        setShowContactResults(false);
      }
      if (companySearchRef.current && !companySearchRef.current.contains(e.target as Node)) {
        setShowCompanyResults(false);
      }
      if (dealSearchRef.current && !dealSearchRef.current.contains(e.target as Node)) {
        setShowDealResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-fill external attendee if contact info provided
  useEffect(() => {
    if (contactEmail && contactName && externalAttendees.length === 0) {
      setExternalAttendees([{
        contact_id: contactId,
        name: contactName,
        email: contactEmail,
      }]);
    }
  }, [contactId, contactName, contactEmail]);

  // Load data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('auth_id', user.id)
            .single();

          if (userData) {
            setCurrentUserId(userData.id);
            if (internalAttendees.length === 0) {
              setInternalAttendees([{ user_id: userData.id, email: userData.email }]);
            }
          }
        }

        // Load companies
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        if (companiesData) {
          setCompanies(companiesData);

          // Pre-populate company if provided
          if (initialCompanyId) {
            const company = companiesData.find(c => c.id === initialCompanyId);
            if (company) {
              setCompanyId(company.id);
              setSelectedCompany(company);
              setCompanySearch(company.name);
            }
          }
        }

        // Load deals with company info
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id, name, company_id, company:companies(id, name)')
          .order('name');
        if (dealsData) {
          // Transform: Supabase returns company as array, flatten to single object
          const transformedDeals = dealsData.map(d => ({
            ...d,
            company: Array.isArray(d.company) ? d.company[0] || null : d.company
          }));
          setDeals(transformedDeals as Deal[]);
        }

        // Load users
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .order('name');
        if (usersData) setUsers(usersData);

        // Load contacts with company info
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, name, email, title, company_id, company:companies(id, name)')
          .order('name');
        if (contactsData) {
          // Transform: Supabase returns company as array, flatten to single object
          const transformedContacts = contactsData.map(c => ({
            ...c,
            company: Array.isArray(c.company) ? c.company[0] || null : c.company
          }));
          setContacts(transformedContacts as Contact[]);
        }

      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, initialCompanyId]);

  // Fetch company products when company changes
  useEffect(() => {
    async function fetchCompanyProducts() {
      if (!companyId) {
        setCompanyProducts([]);
        setCompanyProductId('');
        return;
      }

      const { data } = await supabase
        .from('company_products')
        .select(`
          id,
          status,
          product:products(id, name, slug)
        `)
        .eq('company_id', companyId)
        .in('status', ['in_sales', 'in_onboarding', 'active'])
        .order('updated_at', { ascending: false });

      // Transform Supabase array join result to single object
      const transformed = (data || []).map(cp => ({
        id: cp.id,
        status: cp.status,
        product: Array.isArray(cp.product) ? cp.product[0] || null : cp.product,
      }));
      setCompanyProducts(transformed);
    }

    fetchCompanyProducts();
  }, [companyId]);

  // Select contact and auto-populate company
  const selectContact = (contact: Contact) => {
    const exists = externalAttendees.some(a => a.contact_id === contact.id || a.email === contact.email);
    if (!exists) {
      setExternalAttendees([
        ...externalAttendees,
        {
          contact_id: contact.id,
          name: contact.name,
          email: contact.email,
          title: contact.title,
        },
      ]);
    }

    // Auto-populate company if available and not already set
    if (contact.company && !companyId) {
      setCompanyId(contact.company.id);
      setSelectedCompany(contact.company);
      setCompanySearch(contact.company.name);

      // Also check for deals with this company
      const companyDeals = deals.filter(d => d.company_id === contact.company!.id);
      if (companyDeals.length === 1 && !dealId) {
        setDealId(companyDeals[0].id);
        setSelectedDeal(companyDeals[0]);
        setDealSearch(companyDeals[0].name);
      }
    }

    setContactSearch('');
    setShowContactResults(false);
  };

  // Select company
  const selectCompany = (company: Company) => {
    setCompanyId(company.id);
    setSelectedCompany(company);
    setCompanySearch(company.name);
    setShowCompanyResults(false);

    // Check for deals with this company
    const companyDeals = deals.filter(d => d.company_id === company.id);
    if (companyDeals.length === 1 && !dealId) {
      setDealId(companyDeals[0].id);
      setSelectedDeal(companyDeals[0]);
      setDealSearch(companyDeals[0].name);
    }
  };

  // Select deal and auto-populate company
  const selectDeal = (deal: Deal) => {
    setDealId(deal.id);
    setSelectedDeal(deal);
    setDealSearch(deal.name);
    setShowDealResults(false);

    // Auto-populate company
    if (deal.company && !companyId) {
      setCompanyId(deal.company.id);
      setSelectedCompany(deal.company);
      setCompanySearch(deal.company.name);
    }
  };

  // Fetch available slots
  const fetchAvailability = useCallback(async (specificDate?: string, endDate?: string) => {
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);

    try {
      const internalEmails = internalAttendees.map(a => a.email).filter(Boolean);

      const body: Record<string, unknown> = {
        duration_minutes: duration,
        internal_emails: internalEmails,
        days_ahead: 15,
        max_slots: 24,
      };

      // If specific date requested, we'll filter client-side for now
      // Could add server-side date range in the future

      const res = await fetch('/api/scheduler/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch availability');
      }

      const { slots } = await res.json();
      setAvailableSlots(slots || []);

      if (!slots || slots.length === 0) {
        setSlotsError('No available time slots found in the next 3 weeks.');
      }
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : 'Failed to check availability');
    } finally {
      setLoadingSlots(false);
    }
  }, [duration, internalAttendees]);

  const handleCheckAvailability = async () => {
    if (externalAttendees.length === 0) {
      setError('Please add at least one external attendee');
      return;
    }
    if (internalAttendees.length === 0) {
      setError('Please add at least one internal attendee');
      return;
    }

    setError(null);
    setStep('availability');
    await fetchAvailability();
  };

  const handleBook = async () => {
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const meetingTitle = title || `${MEETING_TYPE_OPTIONS.find(m => m.value === meetingType)?.label || 'Meeting'} with ${selectedCompany?.name || externalAttendees[0]?.name || 'Prospect'}`;

      const res = await fetch('/api/scheduler/quick-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_type: meetingType,
          duration_minutes: duration,
          title: meetingTitle,
          meeting_platform: platform,
          meeting_location: location || undefined,
          scheduled_time: selectedSlot.start,
          deal_id: dealId || undefined,
          company_product_id: companyProductId || undefined,
          company_id: companyId || undefined,
          internal_attendees: internalAttendees.map(a => a.user_id),
          external_attendees: externalAttendees.map(a => ({
            email: a.email,
            name: a.name,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to book meeting');
      }

      onSuccess?.();
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addExternalAttendee = () => {
    setExternalAttendees([...externalAttendees, { name: '', email: '' }]);
  };

  const removeExternalAttendee = (index: number) => {
    setExternalAttendees(externalAttendees.filter((_, i) => i !== index));
  };

  const updateExternalAttendee = (index: number, updates: Partial<typeof externalAttendees[0]>) => {
    setExternalAttendees(
      externalAttendees.map((a, i) => i === index ? { ...a, ...updates } : a)
    );
  };

  const addInternalAttendee = (userId: string) => {
    if (internalAttendees.some(a => a.user_id === userId)) return;
    const user = users.find(u => u.id === userId);
    if (user) {
      setInternalAttendees([...internalAttendees, { user_id: userId, email: user.email }]);
    }
  };

  const removeInternalAttendee = (userId: string) => {
    if (internalAttendees.length <= 1) return;
    setInternalAttendees(internalAttendees.filter(a => a.user_id !== userId));
  };

  const handleClose = () => {
    setStep('details');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setError(null);
    setSlotsError(null);
    setFilterDate('');
    setFilterDateEnd('');
    onClose();
  };

  // Get unique dates from slots for quick navigation
  const availableDates = [...new Set(availableSlots.map(s => new Date(s.start).toISOString().split('T')[0]))].sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quick Book</h2>
              <p className="text-sm text-gray-500">
                Book a meeting while on a call
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
            step === 'details' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
          )}>
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>
            Details
          </div>
          <div className="h-px w-8 bg-gray-300" />
          <div className={cn(
            'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
            step === 'availability' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
          )}>
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>
            Select Time
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : step === 'details' ? (
            <div className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* External Attendees with Search */}
              <div ref={contactSearchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="h-4 w-4 inline mr-1" />
                  Who are you meeting with?
                </label>

                {externalAttendees.map((attendee, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) => updateExternalAttendee(index, { name: e.target.value })}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                    />
                    <input
                      type="email"
                      value={attendee.email}
                      onChange={(e) => updateExternalAttendee(index, { email: e.target.value })}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeExternalAttendee(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setShowContactResults(true);
                        }}
                        onFocus={() => setShowContactResults(true)}
                        placeholder="Search contacts..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addExternalAttendee}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-300"
                    >
                      <Plus className="h-4 w-4" />
                      Manual
                    </button>
                  </div>

                  {showContactResults && filteredContacts.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => selectContact(contact)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{contact.name}</div>
                            <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                          </div>
                          {contact.company && (
                            <div className="text-xs text-gray-400 truncate max-w-[120px]">
                              {contact.company.name}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Company Search */}
              <div ref={companySearchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="h-4 w-4 inline mr-1" />
                  Company
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      setShowCompanyResults(true);
                      if (!e.target.value) {
                        setCompanyId('');
                        setSelectedCompany(null);
                      }
                    }}
                    onFocus={() => setShowCompanyResults(true)}
                    placeholder="Search companies..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  />

                  {showCompanyResults && filteredCompanies.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {filteredCompanies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => selectCompany(company)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-900"
                        >
                          {company.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Deal Search */}
              <div ref={dealSearchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Briefcase className="h-4 w-4 inline mr-1" />
                  Deal (optional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={dealSearch}
                    onChange={(e) => {
                      setDealSearch(e.target.value);
                      setShowDealResults(true);
                      if (!e.target.value) {
                        setDealId('');
                        setSelectedDeal(null);
                      }
                    }}
                    onFocus={() => setShowDealResults(true)}
                    placeholder="Search deals..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  />

                  {showDealResults && filteredDeals.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {filteredDeals.map((deal) => (
                        <button
                          key={deal.id}
                          onClick={() => selectDeal(deal)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span className="text-sm text-gray-900">{deal.name}</span>
                          {deal.company && (
                            <span className="text-xs text-gray-400">{deal.company.name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Product Selection - shows when company has products */}
              {companyProducts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product (Optional)
                  </label>
                  <select
                    value={companyProductId}
                    onChange={(e) => setCompanyProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  >
                    <option value="">No specific product</option>
                    {companyProducts.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.product?.name || 'Unknown'} ({cp.status.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Meeting Type, Duration, Platform in a grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  >
                    {MEETING_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  >
                    {PLATFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Internal Attendees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Team (calendars to check)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {internalAttendees.map((attendee) => {
                    const user = users.find(u => u.id === attendee.user_id);
                    return (
                      <span
                        key={attendee.user_id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {user?.name || 'Unknown'}
                        {attendee.user_id === currentUserId && (
                          <span className="text-xs text-gray-500">(You)</span>
                        )}
                        {attendee.user_id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => removeInternalAttendee(attendee.user_id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>

                {users.filter(u => !internalAttendees.some(a => a.user_id === u.id)).length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) addInternalAttendee(e.target.value);
                      e.target.value = '';
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Add team member...</option>
                    {users
                      .filter(u => !internalAttendees.some(a => a.user_id === u.id))
                      .map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            /* Availability selection step */
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Date filter controls */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Filter by date:</span>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                  />
                  {(filterDate || filterDateEnd) && (
                    <button
                      onClick={() => { setFilterDate(''); setFilterDateEnd(''); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  onClick={() => fetchAvailability()}
                  disabled={loadingSlots}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <RefreshCw className={cn('h-4 w-4', loadingSlots && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {/* Quick date navigation */}
              {availableDates.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Jump to:</span>
                  {availableDates.slice(0, 7).map((date) => {
                    const d = new Date(date + 'T12:00:00');
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = d.getDate();
                    const isSelected = filterDate === date && !filterDateEnd;
                    return (
                      <button
                        key={date}
                        onClick={() => {
                          setFilterDate(date);
                          setFilterDateEnd('');
                        }}
                        className={cn(
                          'px-2 py-1 text-xs rounded border',
                          isSelected
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        {dayName} {dayNum}
                      </button>
                    );
                  })}
                </div>
              )}

              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Checking calendars...</p>
                  </div>
                </div>
              ) : slotsError ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                  {slotsError}
                </div>
              ) : filteredSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No available times for the selected date(s).</p>
                  <p className="text-xs">Try a different date range or clear the filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto">
                  {filteredSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        selectedSlot?.start === slot.start
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className={cn(
                        'text-sm font-medium',
                        selectedSlot?.start === slot.start ? 'text-green-700' : 'text-gray-900'
                      )}>
                        {slot.formatted}
                      </div>
                      {selectedSlot?.start === slot.start && (
                        <div className="flex items-center gap-1 mt-1 text-green-600 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          {step === 'details' ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckAvailability}
                disabled={loadingData}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Calendar className="h-4 w-4" />
                Check Availability
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('details')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleBook}
                disabled={loading || !selectedSlot}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Book & Send Invite
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
