/**
 * useFormDraft — Auto-save any form to IndexedDB
 *
 * Usage:
 *   const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft('production-log-new');
 *
 * On mount: restores last saved draft (if any).
 * On every change: call saveDraft(formData) — debounced 500ms.
 * On submit: call clearDraft().
 * If browser crashes mid-form: next mount shows "Continue draft?" prompt.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';

interface UseFormDraftResult<T> {
  draft: T | null;       // the restored draft (null if none)
  hasDraft: boolean;
  savedAt: number | null;
  saveDraft: (data: T) => void;
  clearDraft: () => Promise<void>;
}

export function useFormDraft<T>(key: string): UseFormDraftResult<T> {
  const [draft, setDraft] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    db.formDrafts.get(key).then(entry => {
      if (entry) {
        setDraft(entry.data as T);
        setSavedAt(entry.savedAt);
      }
    });
  }, [key]);

  const saveDraft = useCallback((data: T) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const now = Date.now();
      await db.formDrafts.put({ key, data, savedAt: now });
      setSavedAt(now);
    }, 500);
  }, [key]);

  const clearDraft = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await db.formDrafts.delete(key);
    setDraft(null);
    setSavedAt(null);
  }, [key]);

  return {
    draft,
    hasDraft: draft !== null,
    savedAt,
    saveDraft,
    clearDraft,
  };
}
