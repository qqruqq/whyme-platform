import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: '와이미 소그룹 예약',
    description: '와이미 소그룹 오프라인 교육 예약 플랫폼',
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
