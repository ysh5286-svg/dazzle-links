import Link from "next/link";

export default function NotFound() {
  return (
    <main className="w-full max-w-[480px] mx-auto px-5 py-20 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-3xl">🔍</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900">
        찾을 수 없는 페이지
      </h1>
      <p className="text-sm text-gray-500">
        요청하신 페이지가 존재하지 않습니다.
      </p>
      <Link
        href="https://dazzlepeople.com"
        className="mt-4 px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.98] transition-all duration-150"
      >
        다즐피플 홈으로 이동
      </Link>
    </main>
  );
}
