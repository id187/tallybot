// src/components/SettlementDetail.tsx
'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { useEffect } from 'react';
import type { Payment } from '@/services/settlement';
import EditablePaymentItem from '@/components/EditablePaymentItem';
import { Button } from '@/components/ui/button';
import { PlusCircle, Lock } from 'lucide-react'; // Lock 아이콘 임포트
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area'; // 스크롤 가능한 영역 컴포넌트
import { getGroupMembers, GroupMember } from '@/services/settlement';
import { updateSettlementField } from '@/services/settlement'; 


/**
 * SettlementDetail 컴포넌트의 Props 정의
 */
interface SettlementDetailProps {
  payments: Payment[];
  participants: string[];
  onPaymentsChange: (updated: Payment[]) => Promise<void>;
  isCompleted: boolean;
  groupId: string; 
}



/**
 * 정산 상세 내역을 표시하고 관리하는 컴포넌트.
 * 개별 정산 항목(`EditablePaymentItem`)을 리스트 형태로 보여주며,
 * 항목 추가, 수정 시작, 수정 완료, 삭제 기능을 관리합니다.
 * 정산이 완료된 경우 수정/추가/삭제 기능을 비활성화합니다.
 */
export default function SettlementDetail({ payments, participants, onPaymentsChange, isCompleted, groupId}: SettlementDetailProps): ReactElement {
  // 현재 수정 중인 항목의 ID를 관리하는 상태. null이면 수정 중인 항목 없음.
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  useEffect(() => {
    getGroupMembers(groupId).then(setMembers).catch(console.error);
  },[groupId]);

  const getNickname = (id: string) => {
    const member = members.find(m => m.memberId.toString() === id);
    return member?.nickname || id;
  };

  /**
   * 새 정산 항목 추가 핸들러.
   * '항목 추가' 버튼 클릭 시 호출됩니다. 정산 완료 시 비활성화됩니다.
   */
  const handleAddPayment = () => {
    if (isCompleted) return; // 완료된 정산이면 추가 불가

    // 새 결제 항목 객체 생성 (기본값 설정)
    const newPayment: Payment = {
      id: Date.now(), // 임시 ID (실제 앱에서는 백엔드에서 생성하거나 UUID 사용 권장)
      payer: participants[0] || '', // 참여자 목록의 첫 번째 사람을 기본 결제자로 설정 (없으면 빈 문자열)
      target: [...participants], // 기본적으로 모든 참여자를 정산 대상으로 설정
      ratio: participants.length > 0 ? participants.map(() => 1 / participants.length) : [], // 균등 분배 비율 기본값
      constant: participants.length > 0 ? participants.map(() => 0) : [],
      amount: 0, // 금액 기본값 0
      item: '', // 항목명 기본값 빈 문자열
      imageUrl: '', // 이미지 URL 기본값 빈 문자열
    };
    // 변경된 결제 목록 (새 항목 추가)을 부모 컴포넌트로 전달
    onPaymentsChange([...payments, newPayment]);
    // 새로 추가된 항목을 바로 수정 모드로 전환하여 사용자 입력 유도
    setEditingItemId(newPayment.id);
  };

  /**
   * 정산 항목 수정 완료 핸들러.
   * EditablePaymentItem 컴포넌트에서 '저장' 시 호출됩니다. 정산 완료 시 비활성화됩니다.
   * @param updatedPayment - 수정된 결제 항목 데이터
   */
  const handleUpdatePayment = async (updatedPayment: Payment) => {
    if (isCompleted) return;
  
    try {
      const ratioArray = updatedPayment.ratio ?? updatedPayment.target.map(() => 1);
  
      // constants & ratios 키를 문자열로 변환
      const constants = JSON.parse(JSON.stringify(Object.fromEntries(
        updatedPayment.target.map((t, i) => [
          String(t), // 확실하게 문자열 키
          updatedPayment.constant?.[i] ?? 0,
        ])
      )));
      
      const ratios = JSON.parse(JSON.stringify(Object.fromEntries(
        updatedPayment.target.map((t, i) => [
          String(t), // 확실하게 문자열 키
          ratioArray[i],
        ])
      )));
  
      // 디버깅용 로그
      console.log("🧾 Payload to updateSettlementField:", {
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
  
      // 서버 호출
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
  
      // 상태 업데이트
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
  
      // 프론트 상태에서 제거
      const updatedPayments = payments.filter(p => p.id !== paymentId);
      await onPaymentsChange(updatedPayments);
    } catch (err) {
      console.error('정산 항목 삭제 실패:', err);
    }
  };

  /**
   * 항목 수정 모드 시작 핸들러.
   * EditablePaymentItem 컴포넌트에서 '수정' 아이콘 또는 항목 클릭 시 호출됩니다. 정산 완료 시 비활성화됩니다.
   * @param paymentId - 수정할 결제 항목의 ID
   */
  const handleEditClick = (paymentId: number) => {
    if (isCompleted) return; // 완료된 정산이면 수정 모드 진입 불가
    setEditingItemId(paymentId); // 수정할 항목의 ID를 상태에 저장
  };

  /**
   * 항목 수정 취소 핸들러.
   * EditablePaymentItem 컴포넌트에서 '취소' 버튼 클릭 시 호출됩니다.
   */
   const handleCancelEdit = () => {
     setEditingItemId(null); // 수정 모드 해제
     // TODO: 필요하다면 수정 전 상태로 되돌리는 로직 추가 (현재는 취소 시 변경사항 유지됨)
   };
   

  // --- 렌더링 ---
  return (
    <Card className="shadow-sm rounded-lg">
      <CardHeader>
        {/* 헤더 제목 및 항목 추가 버튼 */}
        {/*
        <div className="flex justify-between items-center">
           <CardTitle className="text-lg font-semibold">상세 정산 내역</CardTitle>
           {!isCompleted ? ( // 완료되지 않았을 때만 항목 추가 버튼 활성화
             <Button onClick={handleAddPayment} size="sm" variant="outline">
               <PlusCircle className="mr-2 h-4 w-4" />
               항목 추가
             </Button>
            ) : ( // 완료되었을 때는 비활성화된 버튼 표시 (또는 숨김 처리)
              <Button size="sm" variant="outline" disabled title="완료된 정산은 수정할 수 없습니다.">
                 <Lock className="mr-2 h-4 w-4" />
                 항목 추가 (잠김)
              </Button>
           )}
        </div>
        */}
        {/* 설명 */}
        <CardDescription>
            {isCompleted
                ? "이 정산은 완료되어 수정할 수 없습니다."
                : "각 항목을 클릭하여 수정 / 삭제를 할 수 있습니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-x-hidden">
        {/* 결제 항목 리스트 (스크롤 가능) */}
        <ScrollArea className="h-[400px] pr-4 w-full max-w-full overflow-x-hidden"> {/* 높이 고정 및 스크롤 적용 */}
          {payments.length > 0 ? ( // 항목이 있을 경우
            <ul className="space-y-4 w-full">
              {payments.map((payment) => (
                <li key={payment.id} className="w-full"> 
                  <EditablePaymentItem
                    payment={payment}
                    participants={participants}
                    isEditing={editingItemId === payment.id} // 현재 항목이 수정 모드인지 전달
                    onEditClick={handleEditClick} // 수정 시작 핸들러 전달
                    onUpdate={handleUpdatePayment} // 수정 완료 핸들러 전달
                    onDelete={handleDeletePayment} // 삭제 핸들러 전달
                    onCancel={handleCancelEdit} // 수정 취소 핸들러 전달
                    isCompleted={isCompleted} // 완료 상태 전달
                    getNickname={getNickname}
                  />
                </li>
              ))}
            </ul>
          ) : ( // 항목이 없을 경우
            <p className="text-center text-muted-foreground py-8">추가된 정산 항목이 없습니다.</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
