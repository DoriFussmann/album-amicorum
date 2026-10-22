/** Edition-specific alt text for My Friends Book product photographs. */

export function bookCoverAlt(editionTitle: string): string {
  return `My Friends Book, ${editionTitle} edition — illustrated cover`;
}

export function bookInteriorAlt(editionTitle: string): string {
  return `Open interior spread of the ${editionTitle} edition with fill-in prompts`;
}

/** Describe a gallery still from its filename and edition title. */
export function bookGalleryAlt(editionTitle: string, src: string): string {
  const file = (src.split('/').pop() ?? '').toLowerCase();
  const stem = file.replace(/\.[a-z0-9]+$/i, '');

  if (stem.includes('front-alt') || stem.endsWith('-alt')) {
    return `My Friends Book, ${editionTitle} edition — alternate cover view`;
  }
  if (stem.includes('front') || stem.includes('cover')) {
    return bookCoverAlt(editionTitle);
  }
  if (stem.includes('back')) {
    return `My Friends Book, ${editionTitle} edition — illustrated back cover`;
  }
  if (stem.includes('open') || stem.includes('page') || stem.includes('interior')) {
    return bookInteriorAlt(editionTitle);
  }
  if (stem.includes('postcard')) {
    return `Illustrated postcard from the ${editionTitle} edition of My Friends Book`;
  }
  if (stem.includes('bookmark')) {
    return `Illustrated bookmark from the ${editionTitle} edition of My Friends Book`;
  }
  if (stem.includes('use')) {
    return `A child using the ${editionTitle} edition of My Friends Book`;
  }
  if (stem.includes('kids')) {
    return `Children with the ${editionTitle} edition of My Friends Book`;
  }
  if (stem.includes('kid')) {
    return `A child with the ${editionTitle} edition of My Friends Book`;
  }
  if (stem.includes('lifestyle') || stem.includes('staged')) {
    return `The ${editionTitle} edition of My Friends Book in a lifestyle setting`;
  }
  return `The ${editionTitle} edition of My Friends Book`;
}
