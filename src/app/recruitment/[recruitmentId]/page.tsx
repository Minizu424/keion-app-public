type RecruitmentDetailPageProps = {
  params: Promise<{
    recruitmentId: string;
  }>;
};

export default async function RecruitmentDetailPage({
  params,
}: RecruitmentDetailPageProps) {
  const { recruitmentId } = await params;

  return (
    <main>
      <h1>バンド募集詳細</h1>
      <p>募集ID: {recruitmentId}</p>
    </main>
  );
}