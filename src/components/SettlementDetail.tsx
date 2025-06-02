// src/components/SettlementDetail.tsx
'use client';

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { Payment } from '@/services/settlement';
import EditablePaymentItem from '@/components/EditablePaymentItem';
import { Button } from '@/components/ui/button';
import { PlusCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getGroupMembers, GroupMember, updateSettlementField } from '@/services/settlement';

interface SettlementDetailProps {
  payments: Payment[];
  participants: string[];
  onPaymentsChange: (updated: Payment[]) => Promise<void>;
  isCompleted: boolean;
  groupId: string;
}

export default function SettlementDetail({
  payments,
  participants,
  onPaymentsChange,
  isCompleted,
  groupId
}: SettlementDetailProps): ReactElement {
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  useEffect(() => {
    getGroupMembers(groupId).then(setMembers).catch(console.error);
  }, [groupId]);

  const getNickname = (id: string) => {
    const member = members.find(m => m.memberId.toString() === id);
    return member?.nickname || id;
  };

  const handleAddPayment = () => {
    if (isCompleted) return;

    const newPayment: Payment = {
      id: Date.now(),
      payer: participants[0] || '',
      target: [...participants],
      ratio: participants.length > 0 ? participants.map(() => 1 / participants.length) : [],
      constant: participants.length > 0 ? participants.map(() => 0) : [],
      amount: 0,
      item: '',
      imageUrl: '',
    };
    onPaymentsChange([...payments, newPayment]);
    setEditingItemId(newPayment.id);
  };

  const handleUpdatePayment = async (updatedPayment: Payment) => {
    if (isCompleted) return;
    try {
      const ratioArray = updatedPayment.ratio ?? updatedPayment.target.map(() => 1);
      const constants = JSON.parse(JSON.stringify(Object.fromEntries(
        updatedPayment.target.map((t, i) => [String(t), updatedPayment.constant?.[i] ?? 0])
      )));
      const ratios = JSON.parse(JSON.stringify(Object.fromEntries(
        updatedPayment.target.map((t, i) => [String(t), ratioArray[i]])
      )));

      await updateSettlementField({
        calculateId: Number(groupId),
        settlementId: Number(updatedPayment.id),
        field: 'update',
        newValue: {
          payer: Number(updatedPayment.payer),
          amount: updatedPayment.amount,
          item: updatedPayment.item,
          place: '없음',
          participants: updatedPayment.target.map(Number),
        },
        constants,
        ratios,
        sum: updatedPayment.amount,
      });

      const updatedPayments = payments.map(p =>
        p.id === updatedPayment.id ? updatedPayment : p
      );
      await onPaymentsChange(updatedPayments);
      setEditingItemId(null);
    } catch (err) {
      console.error('❌ 정산 항목 업데이트 실패:', err);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (isCompleted) return;
    try {
      await updateSettlementField({
        calculateId: Number(groupId),
        settlementId: Number(paymentId),
        field: 'delete',
        newValue: null,
        constants: null,
        ratios: null,
        sum: null,
      });
      const updatedPayments = payments.filter(p => p.id !== paymentId);
      await onPaymentsChange(updatedPayments);
    } catch (err) {
      console.error('정산 항목 삭제 실패:', err);
    }
  };

  const handleEditClick = (paymentId: number) => {
    if (isCompleted) return;
    setEditingItemId(paymentId);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  return (
    <Card className="shadow-sm rounded-lg w-full">
      <CardHeader>
        <CardDescription>
          {isCompleted
            ? '이 정산은 완료되어 수정할 수 없습니다.'
            : '각 항목을 클릭하여 수정 / 삭제를 할 수 있습니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-x-hidden min-w-0">
        <ScrollArea className="h-[400px] pr-4 w-full max-w-full overflow-x-hidden min-w-0">
          {payments.length > 0 ? (
            <ul className="space-y-4 w-full">
              {payments.map(payment => (
                <li key={payment.id} className="w-full">
                  <EditablePaymentItem
                    payment={payment}
                    participants={participants}
                    isEditing={editingItemId === payment.id}
                    onEditClick={handleEditClick}
                    onUpdate={handleUpdatePayment}
                    onDelete={handleDeletePayment}
                    onCancel={handleCancelEdit}
                    isCompleted={isCompleted}
                    getNickname={getNickname}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              추가된 정산 항목이 없습니다.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}