import OrderScreen from '@/features/order/OrderScreen';

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderScreen orderId={orderId} />;
}
