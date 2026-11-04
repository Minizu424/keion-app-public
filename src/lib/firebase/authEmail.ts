export function studentIdToAuthEmail(studentId: string) {
  const normalizedStudentId = studentId.trim();

  return `${normalizedStudentId}@ed.tus.ac.jp`;
}