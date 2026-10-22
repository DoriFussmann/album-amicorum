import { abs, breadcrumbNode, faqPageNode, orgNode, websiteNode } from "seo-core";
import { SITE_IDENTITY, SITE_URL } from "../config/site";

interface PageData {
  route: string;
  sections: { type: string; h1?: string; items?: unknown }[];
}

export function pageJsonLd(data: PageData) {
  const site = SITE_IDENTITY;
  const pageUrl = abs(data.route, SITE_URL);
  const graph: unknown[] = [orgNode(site), websiteNode(site)];
  if (data.route !== "/") {
    const name = data.sections[0]?.h1 || "Page";
    graph.push(
      breadcrumbNode(
        [
          { name: "Home", href: abs("/", SITE_URL) },
          { name, href: pageUrl },
        ],
        SITE_URL,
      ),
    );
  }
  const faq = data.sections.find((section) => section.type === "faq");
  if (faq && Array.isArray(faq.items)) {
    const items = faq.items as { q: string; a: string }[];
    graph.push(
      faqPageNode(
        items.map((item) => ({ question: item.q, answer: item.a })),
        pageUrl,
      ),
    );
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function pageCrumbs(data: PageData) {
  if (data.route === "/") return [];
  const name = data.sections[0]?.h1 || "Page";
  return [
    { name: "Home", href: abs("/", SITE_URL) },
    { name, href: abs(data.route, SITE_URL) },
  ];
}
