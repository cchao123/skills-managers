import { useCallback, useEffect, useState } from 'react';
import { GITHUB_URLS } from '../constants/config';

const REPO_API_BASE = GITHUB_URLS.REPO.replace(
  'https://github.com/',
  'https://api.github.com/repos/',
);
const LATEST_RELEASE_API = `${REPO_API_BASE}/releases/latest`;
const TAGS_API = `${REPO_API_BASE}/tags?per_page=1`;

type VersionStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'no-release'
  | 'error';

interface VersionInfo {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  status: VersionStatus;
  error: string | null;
  releaseUrl: string | null;
  lastCheckedAt: number | null;
}

const stripV = (v: string) => v.trim().replace(/^v/i, '');

/**
 * 轻量级 semver 对比：仅支持 x.y.z[-pre] 形式。
 * a > b → 1，a < b → -1，否则 0。
 * 预发布版本（含 `-`）视为小于正式版。
 */
const compareSemver = (a: string, b: string): number => {
  const [aCore, aPre] = stripV(a).split('-');
  const [bCore, bPre] = stripV(b).split('-');

  const aParts = aCore.split('.').map((n) => parseInt(n, 10) || 0);
  const bParts = bCore.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const ai = aParts[i] ?? 0;
    const bi = bParts[i] ?? 0;
    if (ai !== bi) return ai > bi ? 1 : -1;
  }

  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre && bPre) return aPre.localeCompare(bPre);
  return 0;
};

const githubHeaders: HeadersInit = { Accept: 'application/vnd.github+json' };

/** 获取 latest release；404 时返回 null，其它错误抛出。 */
const fetchLatestRelease = async (): Promise<{
  tag: string;
  url: string;
} | null> => {
  const res = await fetch(LATEST_RELEASE_API, { headers: githubHeaders });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`releases/latest HTTP ${res.status}`);
  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  if (!data.tag_name) return null;
  return {
    tag: data.tag_name,
    url: data.html_url ?? GITHUB_URLS.RELEASES,
  };
};

/** 回退：没有 release 时看有没有 git tag。 */
const fetchLatestTag = async (): Promise<string | null> => {
  const res = await fetch(TAGS_API, { headers: githubHeaders });
  if (!res.ok) throw new Error(`tags HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ name?: string }>;
  return data[0]?.name ?? null;
};

export const useVersionCheck = (autoCheck = true) => {
  const current = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

  const [latest, setLatest] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VersionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const checkNow = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      const release = await fetchLatestRelease();

      let tag: string | null = null;
      let url: string = GITHUB_URLS.RELEASES;
      if (release) {
        tag = release.tag;
        url = release.url;
      } else {
        // 没有 release 时尝试回退查 tag
        tag = await fetchLatestTag();
      }

      setReleaseUrl(url);
      setLastCheckedAt(Date.now());

      if (!tag) {
        setLatest(null);
        setStatus('no-release');
        return;
      }

      setLatest(tag);
      setStatus(compareSemver(tag, current) > 0 ? 'update-available' : 'up-to-date');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      console.error('[useVersionCheck] failed:', e);
      setError(msg);
      setStatus('error');
    }
  }, [current]);

  useEffect(() => {
    if (autoCheck) {
      void checkNow();
    }
  }, [autoCheck, checkNow]);

  const info: VersionInfo & { checkNow: () => Promise<void> } = {
    current,
    latest,
    hasUpdate: status === 'update-available',
    status,
    error,
    releaseUrl,
    lastCheckedAt,
    checkNow,
  };
  return info;
};
