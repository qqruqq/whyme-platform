import type { Metadata } from 'next'
import { Gowun_Batang, Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
    subsets: ['latin'],
    variable: '--font-body',
})

const gowunBatang = Gowun_Batang({
    subsets: ['latin'],
    weight: ['400', '700'],
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
            <body className={`${notoSansKr.variable} ${gowunBatang.variable}`}>{children}</body>
        </html>
    )
}
