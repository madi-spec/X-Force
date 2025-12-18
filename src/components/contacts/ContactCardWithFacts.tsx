'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Mail,
  Phone,
  Pencil,
  Crown,
  Star,
  UserCheck,
  User,
  UserX,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageSquare,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Contact, RelationshipFact, ContactRole } from '@/types';
import { RelationshipIntelligencePanel } from './RelationshipIntelligencePanel';
import {
  ContextualComposeModal,
  type ComposeContextData,
} from '@/components/inbox/ContextualComposeModal';

interface ContactCardWithFactsProps {
  contact: Contact;
  showExpanded?: boolean;
  dealId?: string;
  companyName?: string;
}

const roleConfig: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  decision_maker: { label: 'Decision Maker', icon: Crown, color: 'text-amber-600 bg-amber-50' },
  champion: { label: 'Champion', icon: Star, color: 'text-green-600 bg-green-50' },
  influencer: { label: 'Influencer', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
  end_user: { label: 'End User', icon: User, color: 'text-gray-600 bg-gray-50' },
  blocker: { label: 'Blocker', icon: UserX, color: 'text-red-600 bg-red-50' },
};

const factTypeIcons: Record<string, typeof Heart> = {
  personal: Heart,
  family: Heart,
  interest: Lightbulb,
  preference: MessageSquare,
  communication: MessageSquare,
  concern: Lightbulb,
};

export function ContactCardWithFacts({ contact, showExpanded = false, dealId, companyName }: ContactCardWithFactsProps) {
  const [expanded, setExpanded] = useState(showExpanded);
  const [showCompose, setShowCompose] = useState(false);

  const role = contact.role ? roleConfig[contact.role] : null;
  const RoleIcon = role?.icon || User;

  const facts = (contact.relationship_facts || []) as RelationshipFact[];
  const previewFacts = facts.slice(0, 2);
  const isAiDetected = !!contact.ai_detected_at;

  return (
    <div className="rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
      {/* Main Card */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{contact.name}</p>
              {contact.is_primary && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
              {isAiDetected && (
                <span className="flex items-center gap-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                  <Sparkles className="h-3 w-3" />
                  AI
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{contact.title || 'No title'}</p>
            {role && (
              <span className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1',
                role.color
              )}>
                <RoleIcon className="h-3 w-3" />
                {role.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.email && (
            <button
              onClick={() => setShowCompose(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title={`Email ${contact.name}`}
            >
              <Mail className="h-4 w-4" />
            </button>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
              title={contact.phone}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <Link
            href={`/contacts/${contact.id}/edit`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            title="Edit contact"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Preview Facts */}
      {previewFacts.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-2">
            {previewFacts.map((fact, i) => {
              const FactIcon = factTypeIcons[fact.type] || Lightbulb;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full"
                >
                  <FactIcon className="h-3 w-3 text-gray-400" />
                  <span className="truncate max-w-[200px]">{fact.fact}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Show More Button */}
      {(facts.length > 0 || isAiDetected) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {facts.length > 0 ? `Show ${facts.length} fact${facts.length !== 1 ? 's' : ''}` : 'Show Details'}
            </>
          )}
        </button>
      )}

      {/* Expanded Panel */}
      {expanded && (
        <div className="border-t border-gray-100">
          <RelationshipIntelligencePanel contact={contact} />
        </div>
      )}

      {/* Compose Modal */}
      {contact.email && (
        <ContextualComposeModal
          isOpen={showCompose}
          onClose={() => setShowCompose(false)}
          context={{
            type: dealId ? 'deal_followup' : 'contact_outreach',
            dealId,
            contactId: contact.id,
            companyId: contact.company_id || undefined,
            recipients: [{
              email: contact.email,
              name: contact.name,
              role: contact.role || undefined,
              confidence: 95,
              source: 'contact_card',
            }],
            sourceLabel: companyName
              ? `Contact at ${companyName}`
              : contact.title
                ? `${contact.name} - ${contact.title}`
                : contact.name,
          }}
        />
      )}
    </div>
  );
}
