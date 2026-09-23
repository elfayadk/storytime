import { useState } from 'react';
import { ALL_PLATFORMS, PLATFORM_META, type Platform } from '../types';
import type { BuildParams } from '../api';

export function SearchBar({
  onSubmit,
  loading,
  aiAvailable,
  compact,
}: {
  onSubmit: (p: BuildParams) => void;
  loading: boolean;
  aiAvailable: boolean;
  compact?: boolean;
}) {
  const [target, setTarget] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([
    'github',
    'mastodon',
    'bluesky',
    'hackernews',
  ]);
  const [ai, setAi] = useState(false);

  const toggle = (p: Platform) =>
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = () => {
    if (!target.trim() || loading) return;
    onSubmit({ target: target.trim(), platforms, limit: 50, ai });
  };

  return (
    <div>
      <div className="field">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={compact ? 'Another account or handle' : 'A username, @handle, or user@instance'}
          aria-label="Account to trace"
          autoFocus={!compact}
        />
        <button className="btn btn-primary" onClick={submit} disabled={loading || !target.trim()}>
          {loading ? 'Tracing' : 'Trace'}
        </button>
      </div>

      <div className="pills">
        {ALL_PLATFORMS.map((p) => (
          <button
            key={p}
            className="pill"
            data-on={platforms.includes(p)}
            onClick={() => toggle(p)}
            type="button"
          >
            <span className="dotmark" />
            {PLATFORM_META[p].label}
          </button>
        ))}
        <button
          className="pill"
          data-on={ai}
          aria-disabled={!aiAvailable}
          onClick={() => aiAvailable && setAi((v) => !v)}
          title={aiAvailable ? 'Local model detected' : 'Start Ollama to use local AI'}
          type="button"
        >
          <span className="dotmark" />
          Local AI
        </button>
      </div>
    </div>
  );
}
