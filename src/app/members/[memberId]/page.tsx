type MemberDetailPageProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export default async function MemberDetailPage({
  params,
}: MemberDetailPageProps) {
  const { memberId } = await params;

  return (
    <main>
      <h1>メンバー詳細</h1>
      <p>メンバーID: {memberId}</p>
    </main>
  );
}