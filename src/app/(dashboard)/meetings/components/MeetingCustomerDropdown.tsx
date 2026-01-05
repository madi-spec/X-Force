'use client';

import { useState, useCallback } from 'react';
import { CustomerDropdown } from './CustomerDropdown';

interface Customer {
  id: string;
  name: string;
}

interface MeetingCustomerDropdownProps {
  meetingId: string;
  initialCustomerId: string | null;
  initialCustomerName: string | null;
  customers: Customer[];
}

export function MeetingCustomerDropdown({
  meetingId,
  initialCustomerId,
  initialCustomerName,
  customers,
}: MeetingCustomerDropdownProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [customerName, setCustomerName] = useState(initialCustomerName);

  const handleOptimisticUpdate = useCallback(
    (newCustomerId: string | null, newCustomerName: string | null) => {
      setCustomerId(newCustomerId);
      setCustomerName(newCustomerName);
    },
    []
  );

  return (
    <CustomerDropdown
      meetingId={meetingId}
      customerId={customerId}
      customerName={customerName}
      customers={customers}
      onOptimisticUpdate={handleOptimisticUpdate}
    />
  );
}
