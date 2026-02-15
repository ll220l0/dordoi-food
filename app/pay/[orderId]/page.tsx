import PayScreen from '@/features/pay/PayScreen';

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PayScreen orderId={orderId} />;
}
