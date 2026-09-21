/**
 * 누락 없는 전체 조회 (감사 15번): PostgREST 는 한 요청당 최대 행 수(Supabase 기본 1,000, 프로젝트 설정으로 변경 가능)를 넘는 결과를
 * **조용히 잘라서** 돌려준다. `.limit(5000)` 처럼 숫자만 키우는 것은 상한이 더 낮으면 여전히 잘리고, 데이터가 더 많아지면 또 잘린다.
 *
 * 이 헬퍼는 안정된 정렬(고유 컬럼을 tiebreak 로 포함)로 `.range()` 페이지를 순회해 전체 행을 모은다.
 *  - 첫 페이지에서 `count: 'exact'` 로 총 건수를 받아 "몇 건까지 모아야 끝인지" 를 안다 → 서버 상한이 페이지 크기보다 작아도 끝까지 간다
 *    (offset 은 실제로 받은 행 수만큼만 전진).
 *  - 중간 페이지가 실패하면 부분 결과를 돌려주지 않고 예외를 던진다 (합계가 조용히 작아지는 것을 막는다 — 호출부는 500 으로 응답).
 *  - tiebreak 컬럼이 없는 테이블(42703)이면 그 컬럼만 빼고 같은 페이지를 다시 요청한다(`optional: true` 인 경우) → 기존과 같은 수준의 정렬로 계속.
 *  - maxRows(기본 200,000) 를 넘으면 예외 — 무한 순회·메모리 폭주 방지.
 *
 * 한계: 순회 도중 다른 사용자가 행을 삽입/삭제하면 offset 기반 페이지 경계에서 1건이 중복/누락될 수 있다(스냅샷이 아님).
 *       삽입은 보통 정렬 끝(created_at 최신)에 붙으므로 오름차순 순회에서는 영향이 거의 없다. 정확한 스냅샷이 필요하면 DB 집계 함수를 쓴다.
 */
export type PagedOrder = { column: string; ascending?: boolean; optional?: boolean };

export type PageResult<T> = { data: T[] | null; error: { message?: string; code?: string } | null; count?: number | null };

/**
 * 페이지 한 장을 요청하는 함수. 호출부가 매번 **새 빌더**를 만들어 필터를 적용하고, 전달받은 order 와 range 를 붙인다.
 * wantCount 가 true 인 페이지(첫 페이지)에서는 select 에 `{ count: 'exact' }` 를 넣어야 한다.
 */
export type PageQuery<T> = (args: { from: number; to: number; order: PagedOrder[]; wantCount: boolean }) => PromiseLike<PageResult<T>>;

export type FetchAllOptions = {
  /** 안정된 정렬 — 마지막에 고유 컬럼(id 등)을 두어 같은 정렬값이 여러 행이어도 페이지 경계가 흔들리지 않게 한다 */
  order: PagedOrder[];
  /** 페이지 크기 (서버 상한보다 커도 됨 — 받은 만큼만 전진) */
  pageSize?: number;
  /** 안전 상한 — 넘으면 예외 */
  maxRows?: number;
};

export class PagedSelectError extends Error {
  constructor(message: string, public readonly page: number, public readonly code?: string) {
    super(message);
    this.name = 'PagedSelectError';
  }
}

export async function fetchAllRows<T>(query: PageQuery<T>, opts: FetchAllOptions): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const maxRows = opts.maxRows ?? 200_000;
  let order = opts.order.slice();
  const all: T[] = [];
  let offset = 0;
  let total: number | null = null;
  let page = 0;

  while (true) {
    page += 1;
    let res: PageResult<T>;
    try {
      res = await query({ from: offset, to: offset + pageSize - 1, order, wantCount: page === 1 });
    } catch (e) {
      throw new PagedSelectError(e instanceof Error ? e.message : '조회 실패', page);
    }
    if (res.error) {
      // tiebreak 컬럼이 없는 테이블: 선택적 정렬 컬럼을 빼고 같은 페이지를 한 번 더
      const optionalIdx = order.findIndex(o => o.optional);
      if (res.error.code === '42703' && optionalIdx >= 0) {
        order = order.filter(o => !o.optional);
        page -= 1;
        continue;
      }
      throw new PagedSelectError(res.error.message || '조회 실패', page, res.error.code);
    }
    const rows = res.data ?? [];
    if (page === 1 && typeof res.count === 'number') total = res.count;
    for (const r of rows) all.push(r);
    offset += rows.length;
    if (all.length > maxRows) throw new PagedSelectError(`조회 상한(${maxRows}행) 초과`, page);
    if (rows.length === 0) break;                                   // 더 없음
    if (total !== null && offset >= total) break;                   // 총 건수까지 모음
    if (total === null && rows.length < pageSize) break;            // 총 건수를 모르면 짧은 페이지가 마지막
  }
  return all;
}
