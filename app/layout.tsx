import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Адаптация новичков — обзор команды",
  description:
    "Разбор адаптации сотрудников: рабочие препятствия, записи наставников и решения руководителя. Демонстрация на вымышленных данных.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
