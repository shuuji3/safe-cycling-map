import React, { useEffect, useRef, useState } from "react";
import { BIKE_CLASSES } from "./bike";

interface Props {
  visible: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}

// Sidebar with per-category checkboxes and a hover/click-pin popover that
// explains the OSM tags each layer uses.
export function BikeLegend({ visible, onToggle }: Props) {
  // Which row's OSM-tag popover is open (anchored at the ⓘ button) and whether
  // it was pinned by a click (stays until clicked outside or toggled).
  const [note, setNote] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [pinned, setPinned] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const placeNote = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    setNote({ id, x: rect.right + 8, y: rect.top });
  };

  // Hover shows the popover without pinning.
  const openOnHover = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    placeNote(e, id);
    setPinned(false);
    window.clearTimeout(closeTimer.current);
  };

  // Click pins (or unpins) it. preventDefault stops the nested button from
  // also toggling the containing label's checkbox.
  const togglePin = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    if (pinned && note && note.id === id) {
      setNote(null);
      setPinned(false);
      return;
    }
    placeNote(e, id);
    setPinned(true);
  };

  // A short delay lets the cursor move into the popover before it closes.
  const scheduleClose = () => {
    if (pinned) {
      return;
    }
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setNote(null), 150);
  };

  const cancelClose = () => window.clearTimeout(closeTimer.current);

  // Clicking anywhere outside the popover closes it (and unpins).
  useEffect(() => {
    if (!note) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (noteRef.current && noteRef.current.contains(target)) {
        return;
      }
      if ((target as Element).closest?.(".note-toggle")) {
        return;
      }
      setNote(null);
      setPinned(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [note]);

  const openDef = note ? BIKE_CLASSES.find((d) => d.id === note.id) : null;

  return (
    <>
      <div className="sidebar bike-sidebar">
        <h2>自転車道のカテゴリー</h2>
        {BIKE_CLASSES.map((def) => (
          <div key={def.id} className="bike-row">
            <input
              id={`cb-${def.id}`}
              type="checkbox"
              className="bike-chk"
              checked={!!visible[def.id]}
              onChange={(e) => onToggle(def.id, e.target.checked)}
            />
            <label className="bike-toggle" htmlFor={`cb-${def.id}`}>
              <div className="bike-head">
                <span className="bike-check" aria-hidden="true">
                  {!!visible[def.id] && (
                    <svg viewBox="0 0 24 24" className="bike-check-mark">
                      <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" />
                    </svg>
                  )}
                </span>
                <span
                  className="bike-swatch"
                  style={{ background: def.color }}
                  aria-hidden="true"
                />
                <span className="bike-name">{def.name}</span>
                <button
                  type="button"
                  className="note-toggle"
                  aria-label={`${def.name}が表示しているOSMタグ`}
                  onMouseEnter={(e) => openOnHover(e, def.id)}
                  onMouseLeave={scheduleClose}
                  onClick={(e) => togglePin(e, def.id)}
                >
                  ⓘ
                </button>
              </div>
              <div className="bike-toggle-summary">{def.summary}</div>
            </label>
          </div>
        ))}
        <br />
        <label>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/shuuji3/japan-safe-cycling-map"
            className="source-link"
          >
            <svg viewBox="0 0 16 16" className="github-icon" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            Source code
          </a>
        </label>
      </div>
      {openDef && (
        <div
          ref={noteRef}
          className="note-popover"
          style={{ left: note!.x, top: note!.y }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="note-heading">このレイヤーが表示しているOSMタグ</div>
          {openDef.attrs.map((a) => (
            <div key={a.tag} className="note-attr">
              <code className="bike-toggle-tag">{a.tag}</code>
              <span className="note-attr-meaning">{a.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
