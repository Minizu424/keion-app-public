type PaymentDetailPageProps = {
  params: Promise<{
    paymentId: string;
  }>;
};

export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { paymentId } = await params;

  return (
    <main>
      <h1>支払い詳細</h1>
      <p>支払いID: {paymentId}</p>
    </main>
  );
}