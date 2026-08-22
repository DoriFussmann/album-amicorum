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
};

type ArticleKeywordFields = {
  pillarKeyword?: string | undefined;
  category?: string | undefined;
};

/** Company pillar keyword for an article (frontmatter, with category fallback). */
export function articlePillarKeyword(
  article: ArticleKeywordFields
): string | undefined {
  const pillar = article.pillarKeyword?.trim();
  const category = article.category?.trim();
  return pillar || category || undefined;
}

/** Unique pillar keywords from published articles, sorted alphabetically. */
export function buildArticleFilterOptions(
  articles: ArticleKeywordFields[]
): ArticleFilterOption[] {
  const pillars = [
    ...new Set(
      articles.map(articlePillarKeyword).filter((k): k is string => Boolean(k))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return pillars.map((pillar) => ({
    value: pillar,
    label: titleCaseKeyword(pillar),
  }));
}
