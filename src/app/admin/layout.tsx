import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '와이미 관리자페이지',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
