type ApplicationEditPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function ApplicationEditPage({
  params,
}: ApplicationEditPageProps) {
  const { applicationId } = await params;

  return (
    <main>
      <h1>申請編集</h1>
      <p>申請ID: {applicationId}</p>
    </main>
  );
}