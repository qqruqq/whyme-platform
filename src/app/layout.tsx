import type { Metadata } from 'next'
import { Gowun_Dodum, IBM_Plex_Sans_KR } from 'next/font/google'
import './globals.css'

const ibmPlexSansKr = IBM_Plex_Sans_KR({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-body',
})

const gowunDodum = Gowun_Dodum({
    subsets: ['latin'],
    weight: ['400'],
    variable: '--font-display',
})

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
            <body className={`${ibmPlexSansKr.variable} ${gowunDodum.variable}`}>{children}</body>
        </html>
    )
}
