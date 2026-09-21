/**
 * 행 단위 필드 저장 추적기 — "낙관적 갱신 + 실패 시 되돌림" 을 요청 순서·필드 단위로 정확하게 처리한다 (감사 12번 보완).
 *
 * 문제: 같은 행에 A(금액) 요청이 대기 중일 때 B(금액) 가 먼저 성공하고 A 가 나중에 실패하면,
 *       단순한 "요청 전 값으로 되돌리기"는 B 의 성공한 값을 지운다. 서로 다른 필드를 행 전체로 되돌려도 마찬가지다.
 *
 * 규칙:
 *  - 행마다 요청을 **직렬화**한다(앞 요청이 끝난 뒤 다음 전송) → 서버 반영 순서 = 사용자 입력 순서. 옛 요청이 늦게 도착해 최신을 덮는 일이 없다.
 *  - `confirmed[id][field]` = 서버가 마지막으로 확인해 준 값. 성공한 요청의 필드만 갱신한다.
 *  - 실패한 요청은 **그 필드에 더 새로운 요청이 없을 때만** 화면을 `confirmed` 값으로 되돌린다. 더 새로운 요청이 있으면 그 결과가 화면을 결정한다.
 *  - 그래서 "A 실패 → B 성공" 은 B 값, "B 성공 → A 실패(역순 응답은 직렬화로 불가)" 도 B 값, "둘 다 실패" 는 서버 확인값(입력 전 값)으로 돌아간다.
 *  - 다른 필드의 성공/대기 값은 건드리지 않는다(필드 단위 되돌림).
 *
 * 순수 로직(React·fetch 의존 없음). 화면 반영은 applyView 콜백으로 위임한다.
 */
export type FieldSaveResult = { ok: true } | { ok: false; error: string };

export type FieldSaveTrackerOptions<Row extends { id: string }> = {
  /** 실제 저장 요청 (한 행에 대해 순서대로 호출됨). throw 해도 실패로 처리된다. */
  send: (id: string, patch: Partial<Row>) => Promise<FieldSaveResult>;
  /** 화면 상태에 patch 적용. reason: 'optimistic'(입력 반영) | 'revert'(실패 후 서버 확인값으로 되돌림 — 비제어 입력은 이때 다시 그려야 함) */
  applyView: (id: string, patch: Partial<Row>, reason: 'optimistic' | 'revert') => void;
  /** 실패 알림: 되돌린 필드(restored: 서버 확인값)와 반영되지 않은 입력(failed) */
  onError?: (info: { id: string; error: string; failed: Partial<Row>; restored: Partial<Row> }) => void;
  /** 성공 알림 (되돌리기 스택 등록 등) — 이 요청 전 서버 확인값(before)과 반영값(patch) */
  onSuccess?: (info: { id: string; patch: Partial<Row>; before: Partial<Row> }) => void;
};

export type FieldSaveTracker<Row extends { id: string }> = {
  /** 서버에서 읽어 온 행으로 확인값을 (재)설정한다. 재조회 후 반드시 호출. */
  confirm(rows: Row[]): void;
  /** 행 제거 (삭제 성공 후) */
  forget(id: string): void;
  /** 낙관적 갱신 + 순서 보장 저장. 성공 여부를 돌려준다. */
  save(id: string, patch: Partial<Row>): Promise<boolean>;
  /** 서버가 마지막으로 확인해 준 값 (없으면 undefined) */
  confirmedValue<K extends keyof Row>(id: string, field: K): Row[K] | undefined;
  /** 이 행에 아직 끝나지 않은 요청이 있는가 */
  isPending(id: string): boolean;
};

export function createFieldSaveTracker<Row extends { id: string }>(opts: FieldSaveTrackerOptions<Row>): FieldSaveTracker<Row> {
  const confirmed = new Map<string, Partial<Row>>();
  const latestSeq = new Map<string, Map<keyof Row, number>>(); // 필드별 가장 최근 요청 번호
  const chains = new Map<string, Promise<unknown>>();            // 행별 직렬화 체인
  const pendingCount = new Map<string, number>();
  let seq = 0;

  const fieldSeqs = (id: string) => {
    let m = latestSeq.get(id);
    if (!m) { m = new Map(); latestSeq.set(id, m); }
    return m;
  };

  return {
    confirm(rows) {
      for (const r of rows) confirmed.set(r.id, { ...r });
    },
    forget(id) { confirmed.delete(id); latestSeq.delete(id); chains.delete(id); pendingCount.delete(id); },
    confirmedValue(id, field) { return confirmed.get(id)?.[field]; },
    isPending(id) { return (pendingCount.get(id) ?? 0) > 0; },
    save(id, patch) {
      const mySeq = ++seq;
      const fields = Object.keys(patch) as (keyof Row)[];
      const fs = fieldSeqs(id);
      for (const f of fields) fs.set(f, mySeq);
      opts.applyView(id, patch, 'optimistic'); // 낙관적 갱신: 화면은 항상 최신 입력
      pendingCount.set(id, (pendingCount.get(id) ?? 0) + 1);

      const prev = chains.get(id) ?? Promise.resolve();
      const mine: Promise<boolean> = prev.then(async () => {
        let result: FieldSaveResult;
        try { result = await opts.send(id, patch); }
        catch (e) { result = { ok: false, error: e instanceof Error && e.message ? e.message : '네트워크 오류' }; }
        const before: Partial<Row> = {};
        const cur = confirmed.get(id) ?? {};
        for (const f of fields) (before as Record<string, unknown>)[f as string] = (cur as Record<string, unknown>)[f as string];
        if (result.ok) {
          confirmed.set(id, { ...cur, ...patch }); // 직렬화 덕분에 이 값이 서버의 최신 상태
          opts.onSuccess?.({ id, patch, before });
          return true;
        }
        // 실패: 이 요청이 해당 필드의 마지막 요청일 때만 되돌린다 (더 새 요청이 있으면 그쪽 결과가 화면을 정한다)
        const restored: Partial<Row> = {};
        const failed: Partial<Row> = {};
        for (const f of fields) {
          (failed as Record<string, unknown>)[f as string] = (patch as Record<string, unknown>)[f as string];
          if (fs.get(f) === mySeq) {
            (restored as Record<string, unknown>)[f as string] = (cur as Record<string, unknown>)[f as string];
            fs.delete(f);
          }
        }
        if (Object.keys(restored).length > 0) opts.applyView(id, restored, 'revert');
        opts.onError?.({ id, error: result.error, failed, restored });
        return false;
      }).finally(() => {
        pendingCount.set(id, Math.max(0, (pendingCount.get(id) ?? 1) - 1));
      });
      chains.set(id, mine.catch(() => undefined));
      return mine;
    },
  };
}
