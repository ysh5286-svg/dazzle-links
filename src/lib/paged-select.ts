/**
 * 누락 없는 전체 조회 (감사 15번): PostgREST 는 한 요청당 최대 행 수(Supabase 기본 1,000, 프로젝트 설정으로 변경 가능)를 넘는 결과를
 * **조용히 잘라서** 돌려준다. `.limit(5000)` 처럼 숫자만 키우는 것은 상한이 더 낮으면 여전히 잘리고, 데이터가 더 많아지면 또 잘린다.
 *
 * 이 헬퍼는 안정된 정렬(마지막에 **고유 키**를 반드시 포함)로 `.range()` 페이지를 순회해 전체 행을 모은다.
 *  - 첫 페이지에서 `count: 'exact'` 로 총 건수를 받아 "몇 건까지 모아야 끝인지" 를 안다 → 서버 상한이 페이지 크기보다 작아도 끝까지 간다
 *    (offset 은 실제로 받은 행 수만큼만 전진). 총 건수를 받지 못하면 짧은 페이지가 '끝'인지 '상한에 잘린 것'인지 구분할 수 없으므로 실패로 처리한다.
 *  - 총 건수에 못 미친 채 빈 페이지가 오거나(순회 중 삭제 등) data 가 null 이면 부분 결과를 돌려주지 않고 예외를 던진다.
 *  - 중간 페이지 오류도 예외 — 합계가 조용히 작아지는 일이 없다 (호출부는 500 으로 응답).
 *  - 정렬 컬럼이 테이블에 없으면(42703) 폴백하지 않고 예외 — 고유 키 없는 offset 순회는 동일 정렬값 행의 순서가 페이지마다 달라져
 *    정적 데이터에서도 중복/누락이 생길 수 있으므로 '불안정한 성공' 대신 중단한다.
 *  - maxRows(기본 200,000) 를 넘으면 예외 — 무한 순회·메모리 폭주 방지.
 *
 * 한계: 순회 도중 다른 사용자가 행을 삽입/삭제하면 offset 기반 페이지 경계에서 1건이 중복/누락될 수 있다(스냅샷이 아님).
 *       삽입은 보통 정렬 끝(created_at 최신)에 붙으므로 오름차순 순회에서는 영향이 거의 없고, 삭제로 총 건수에 못 미치면 위 규칙대로 실패한다.
 *       정확한 스냅샷이 필요하면 DB 집계 함수를 쓴다.
 */
export type PagedOrder = { column: string; ascending?: boolean };

export type PageResult<T> = { data: T[] | null; error: { message?: string; code?: string } | null; count?: number | null };

/**
 * 페이지 한 장을 요청하는 함수. 호출부가 매번 **새 빌더**를 만들어 필터를 적용하고, 전달받은 order 와 range 를 붙인다.
 * wantCount 가 true 인 페이지(첫 페이지)에서는 select 에 `{ count: 'exact' }` 를 넣어야 한다.
 */
export type PageQuery<T> = (args: { from: number; to: number; order: PagedOrder[]; wantCount: boolean }) => PromiseLike<PageResult<T>>;

export type FetchAllOptions = {
  /** 안정된 정렬 — 마지막에 고유 키(id 등)를 두어 같은 정렬값이 여러 행이어도 페이지 경계가 흔들리지 않게 한다 (필수) */
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
  if (!opts.order.length) throw new PagedSelectError('정렬 기준(고유 키 포함)이 필요합니다', 0);
  const order = opts.order.slice();
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
    if (res.error) throw new PagedSelectError(res.error.message || '조회 실패', page, res.error.code);
    if (!Array.isArray(res.data)) throw new PagedSelectError('응답에 데이터가 없습니다', page);
    if (page === 1) {
      if (typeof res.count !== 'number') throw new PagedSelectError('총 건수(count)를 받지 못해 누락 여부를 판단할 수 없습니다', page);
      total = res.count;
    }
    const rows = res.data;
    for (const r of rows) all.push(r);
    offset += rows.length;
    if (all.length > maxRows) throw new PagedSelectError(`조회 상한(${maxRows}행) 초과`, page);
    if (offset >= (total as number)) break;                        // 총 건수까지 모음 (총 건수가 0 이면 즉시 종료)
    if (rows.length === 0) throw new PagedSelectError(`총 ${total}건 중 ${offset}건만 받은 채 빈 페이지가 왔습니다 (순회 중 삭제 또는 상한 문제)`, page);
  }
  return all;
}
