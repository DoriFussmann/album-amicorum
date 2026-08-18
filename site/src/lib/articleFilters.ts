/** Title-case a keyword for filter chip labels. */
export function titleCaseKeyword(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export type ArticleFilterOption = {
  value: string;
  label: string;
  kind: 'pillar' | 'cluster';
};

type ArticleKeywordFields = {
  pillarKeyword?: string | undefined;
  supportingKeyword?: string | undefined;
};

/** Pillar keywords with their supporting clusters grouped under each pillar. */
export function buildArticleFilterOptions(
  articles: ArticleKeywordFields[]
): ArticleFilterOption[] {
  const pillars = [
    ...new Set(
      articles
        .map((a) => a.pillarKeyword?.trim())
        .filter((k): k is string => Boolean(k))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const options: ArticleFilterOption[] = [];
  const seenClusters = new Set<string>();

  for (const pillar of pillars) {
    options.push({
      value: pillar,
      label: titleCaseKeyword(pillar),
      kind: 'pillar',
    });

    const clusters = [
      ...new Set(
        articles
          .filter((a) => a.pillarKeyword?.trim() === pillar)
          .map((a) => a.supportingKeyword?.trim())
          .filter((k): k is string => Boolean(k) && k !== pillar)
      ),
    ].sort((a, b) => a.localeCompare(b));

    for (const cluster of clusters) {
      if (seenClusters.has(cluster)) continue;
      seenClusters.add(cluster);
      options.push({
        value: cluster,
        label: titleCaseKeyword(cluster),
        kind: 'cluster',
      });
    }
  }

  return options;
}
