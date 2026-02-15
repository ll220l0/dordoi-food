import AdminOrderScreen from "@/features/admin/AdminOrderScreen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderScreen orderId={id} />;
}
