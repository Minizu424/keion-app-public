type TimetableDetailPageProps = {
  params: Promise<{
    timetableId: string;
  }>;
};

export default async function TimetableDetailPage({
  params,
}: TimetableDetailPageProps) {
  const { timetableId } = await params;

  return (
    <main>
      <h1>タイムテーブル詳細</h1>
      <p>タイムテーブルID: {timetableId}</p>
    </main>
  );
}