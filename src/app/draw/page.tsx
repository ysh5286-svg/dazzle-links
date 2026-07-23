import type { Metadata } from "next";
import MarbleRace from "./marble-race";

export const metadata: Metadata = {
  title: "다즐 마블 추첨기",
  description: "다즐피플 댓글 이벤트 랜덤 추첨 — 마블 레이스로 공정하고 재미있게!",
  robots: { index: false },
};

export default function DrawPage() {
  return <MarbleRace />;
}
