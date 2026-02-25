import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: '소그룹 성교육 (남학생)',
    description: '와이미 소그룹 성교육 (남학생) 예약 플랫폼',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
