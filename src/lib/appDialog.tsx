'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * 앱 안 팝업(2026-10-20) — 브라우저 기본 alert/confirm/prompt 대신.
 * 왜: 기본 창은 휴대폰에서 prompt 기본값(예: 상호명)이 비어 나오는 브라우저가 있고, 화면 모양이 앱과 달라 헷갈리며,
 *     자동화 도구(브라우저 확인용)가 읽거나 누를 수 없음.
 * 사용: `await appConfirm('삭제할까요?')` → true/false · `await appPrompt('이름', '기본값')` → 문자열/null · `await appAlert('완료')`.
 * 화면 맨 위(레이아웃)에 <AppDialogHost /> 가 있어야 앱 팝업으로 뜬다 — 없으면(테스트 등) 브라우저 기본 창으로 대신.
 * 여러 개가 겹치면 차례로(먼저 부른 것부터). Enter = 확인, Esc = 취소(입력 창 포함). 뒤 화면의 '바깥 누르면 닫기'·Esc 는 막음.
 * 팝업은 body 끝의 따로 된 React 뿌리에 그림 — 팝업 안 클릭이 document 로 올라가지 않아, 뒤에 열린 창의
 * "바깥 누르면 닫기"(document mousedown 등)가 확인 버튼 누름을 바깥 클릭으로 잘못 알고 닫히지 않게.
 */
export type DialogOptions = {
  title?: string;
  okText?: string;
  cancelText?: string;
  /** 지우기처럼 되돌리기 어려운 확인 — 확인 버튼을 빨갛게 */
  danger?: boolean;
  /** 입력 창 안내 글자 */
  placeholder?: string;
  /** 비밀번호·PIN 입력 — 글자를 가리고 저장된 비밀번호 자동 채움 안 함 */
  password?: boolean;
};
type Kind = 'alert' | 'confirm' | 'prompt';
type Req = { id: number; kind: Kind; message: string; defaultValue: string; opts: DialogOptions; resolve: (v: unknown) => void };

let queue: Req[] = [];
let seq = 0;
let hosts = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const head = () => queue[0] ?? null;

function open<T>(kind: Kind, message: unknown, defaultValue: string, opts: DialogOptions, fallback: () => T): Promise<T> {
  const text = message == null ? '' : String(message);
  if (typeof window === 'undefined' || hosts === 0) return Promise.resolve(fallback());
  return new Promise<T>((resolve) => {
    queue = [...queue, { id: ++seq, kind, message: text, defaultValue, opts, resolve: resolve as (v: unknown) => void }];
    emit();
  });
}

export function appAlert(message: unknown, opts: DialogOptions = {}): Promise<void> {
  return open<void>('alert', message, '', opts, () => { window.alert(message == null ? '' : String(message)); });
}
export function appConfirm(message: unknown, opts: DialogOptions = {}): Promise<boolean> {
  return open<boolean>('confirm', message, '', opts, () => window.confirm(message == null ? '' : String(message)));
}
export function appPrompt(message: unknown, defaultValue: string | null | undefined = '', opts: DialogOptions = {}): Promise<string | null> {
  const dv = defaultValue == null ? '' : String(defaultValue);
  return open<string | null>('prompt', message, dv, opts, () => window.prompt(message == null ? '' : String(message), dv));
}

function close(req: Req, value: unknown) {
  queue = queue.filter((r) => r.id !== req.id);
  emit();
  req.resolve(value);
}

/** 팝업 안에서 시작한 누름·클릭은 여기서 멈춤(뒤 화면 document 리스너로 안 감) */
const SHIELD_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu'] as const;

/** 레이아웃 맨 아래에 한 번 — 앱 팝업을 그리는 자리(화면에는 아무것도 안 그리고 body 끝에 따로 된 뿌리를 만듦) */
export function AppDialogHost() {
  useEffect(() => {
    hosts++;
    const el = document.createElement('div');
    el.setAttribute('data-app-dialog-root', '');
    document.body.appendChild(el);
    const shield = (e: Event) => e.stopPropagation();
    for (const t of SHIELD_EVENTS) el.addEventListener(t, shield);
    const root = createRoot(el);
    const render = () => {
      const req = head();
      root.render(req ? <DialogBox key={req.id} req={req} /> : null);
    };
    render();
    const unsub = subscribe(render);
    return () => {
      hosts--;
      unsub();
      for (const t of SHIELD_EVENTS) el.removeEventListener(t, shield);
      // 다른 뿌리가 그리는 중에 바로 내리면 React 경고 — 한 박자 뒤 정리
      setTimeout(() => { root.unmount(); el.remove(); }, 0);
    };
  }, []);
  return null;
}

function DialogBox({ req }: { req: Req }) {
  const [value, setValue] = useState(req.defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelValue = req.kind === 'confirm' ? false : req.kind === 'prompt' ? null : undefined;
  const ok = () => close(req, req.kind === 'confirm' ? true : req.kind === 'prompt' ? value : undefined);
  const cancel = () => close(req, cancelValue);

  useEffect(() => {
    // 입력 창은 기본값을 모두 선택(바로 고쳐 쓰기), 그 밖에는 확인 버튼에 포커스
    const t = setTimeout(() => { if (req.kind === 'prompt') { inputRef.current?.focus(); inputRef.current?.select(); } else okRef.current?.focus(); }, 0);
    // Esc·Enter 는 이 팝업이 먼저 받고 뒤 화면(모달 닫기 등)으로 넘기지 않음
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
      else if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); ok(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); };
  });

  const okText = req.opts.okText || '확인';
  const cancelText = req.opts.cancelText || '취소';
  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/45 p-4"
      role="alertdialog" aria-modal="true" aria-label={req.opts.title || req.message.slice(0, 60)} data-testid="app-dialog" data-kind={req.kind}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-800 dark:text-slate-100">
        <div className="px-5 pt-5 pb-4">
          {req.opts.title && <h2 className="mb-1.5 text-[15px] font-bold">{req.opts.title}</h2>}
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed max-h-[55vh] overflow-y-auto" data-testid="app-dialog-message">{req.message}</p>
          {req.kind === 'prompt' && (
            <input
              ref={inputRef}
              type={req.opts.password ? 'password' : 'text'}
              autoComplete={req.opts.password ? 'new-password' : 'off'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={req.opts.placeholder}
              data-testid="app-dialog-input"
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {req.kind !== 'alert' && (
            <button type="button" onClick={cancel} data-testid="app-dialog-cancel"
              className="rounded-lg px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">{cancelText}</button>
          )}
          <button type="button" ref={okRef} onClick={ok} data-testid="app-dialog-ok"
            className={`rounded-lg px-4 py-2 text-[14px] font-bold text-white ${req.opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{okText}</button>
        </div>
      </div>
    </div>
  );
}
