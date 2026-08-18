/**
 * Structured image briefs from Website Specification v1.0.
 * Not rendered in the public UI — used when replacing placeholders with final assets.
 */

export type ImageBrief = {
  id: string;
  purpose: string;
  composition: string;
  lighting: string;
  environment: string;
  mood: string;
  aspectRatio: string;
  prompt: string;
};

export const imageBriefs = {
  hero: {
    id: 'hero',
    purpose: 'Introduce the emotional world of Album Amicorum.',
    composition:
      'A child sitting alone in tall summer meadow grass, quietly reading My Friends Book. The child should not be looking toward the camera. The moment should feel naturally observed rather than staged.',
    lighting: 'Golden evening sunlight. Soft shadows. Warm. Calm.',
    environment: 'Late afternoon. Wild grasses. Soft breeze. Hints of wildflowers. Natural landscape.',
    mood: 'Quiet. Curious. Peaceful. Wonder.',
    aspectRatio: '16:9',
    prompt:
      'A cinematic photograph of a young child sitting in tall wild meadow grass reading a beautifully illustrated cloth-bound children\'s book, golden evening light, muted earthy color palette, Scandinavian minimalism, Waldorf-inspired, soft natural lighting, linen clothing, peaceful atmosphere, shallow depth of field, premium editorial photography, timeless childhood, no electronics, no toys, no camera eye contact.',
  },
  whatIs: {
    id: 'what-is',
    purpose: 'Demonstrate the product naturally in use.',
    composition:
      'Two children sitting together at a wooden table. One child is handing My Friends Book to another. Colored pencils scattered naturally. Pressed flowers nearby. The book is open to a completed page. No one is looking at camera.',
    lighting: 'Morning window light.',
    environment: 'Quiet home. Wooden furniture. Natural textures.',
    mood: 'Calm. Editorial. Warm.',
    aspectRatio: '4:5',
    prompt:
      'Two children exchanging a beautifully illustrated Friend Book across a wooden table, open pages with handwritten memories, colored pencils, pressed flowers, soft natural window light, Scandinavian home, calm atmosphere, editorial lifestyle photography, Waldorf-inspired, muted earth tones.',
  },
  story: {
    id: 'story',
    purpose: 'Connect the historical Album Amicorum tradition to My Friends Book.',
    composition:
      'Antique Renaissance friendship album beside a modern beautifully illustrated children\'s Friend Book, linen fabric, botanical elements.',
    lighting: 'Warm natural window light.',
    environment: 'Editorial still life surface.',
    mood: 'Timeless. Quiet. Editorial.',
    aspectRatio: '4:3',
    prompt:
      'Antique Renaissance friendship album beside a modern beautifully illustrated children\'s Friend Book, linen fabric, botanical elements, warm natural window light, editorial still life, timeless aesthetic.',
  },
  whyParents: {
    id: 'why-parents',
    purpose:
      'No approved image brief in Website Specification v1.0 for this section. Placeholder only until a brief is approved.',
    composition: 'Not specified.',
    lighting: 'Not specified.',
    environment: 'Not specified.',
    mood: 'Not specified.',
    aspectRatio: '4:5',
    prompt: 'No approved prompt in Website Specification v1.0.',
  },
  bookCoverBase: {
    id: 'book-cover',
    purpose: 'Edition cover artwork for My Friends Book.',
    composition: 'Beautifully illustrated cloth-bound Friend Book cover for the named edition world.',
    lighting: 'Soft natural light.',
    environment: 'Clean editorial product presentation.',
    mood: 'Quiet. Wonder. Timeless.',
    aspectRatio: '400:520',
    prompt:
      'Premium children\'s keepsake book cover photographed editorial style, watercolor illustrations, cream paper, soft natural light, muted earthy palette, cloth-bound.',
  },
  bookInteriorBase: {
    id: 'book-interior',
    purpose: 'Interior spread for My Friends Book edition.',
    composition: 'Open interior pages with watercolor illustrations and space for handwritten memories.',
    lighting: 'Soft natural light.',
    environment: 'Clean editorial product presentation.',
    mood: 'Quiet. Personal. Keepsake.',
    aspectRatio: '400:520',
    prompt:
      'Premium children\'s keepsake book interior pages photographed editorial style, handwritten entry spaces, watercolor illustrations, cream paper, soft natural light.',
  },
} as const satisfies Record<string, ImageBrief>;

export const bookEditionPrompts: Record<
  string,
  { coverPrompt: string; interiorPrompt: string }
> = {
  forest: {
    coverPrompt:
      'My Friends Book Forest edition cover, quiet woodland trees and woodland friends, watercolor illustration, cloth-bound children\'s keepsake book, muted sage and cream, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Forest edition interior spread, woodland watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  dinosaurs: {
    coverPrompt:
      'My Friends Book Dinosaurs edition cover, gentle prehistoric adventure world, watercolor illustration, cloth-bound children\'s keepsake book, muted earth tones, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Dinosaurs edition interior spread, soft dinosaur watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  mermaids: {
    coverPrompt:
      'My Friends Book Mermaids edition cover, ocean stories beneath gentle waves, watercolor illustration, cloth-bound children\'s keepsake book, dusty blue and cream, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Mermaids edition interior spread, ocean watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  animals: {
    coverPrompt:
      'My Friends Book Animals edition cover, friendly companions from nature, watercolor illustration, cloth-bound children\'s keepsake book, muted earthy palette, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Animals edition interior spread, animal watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  flowers: {
    coverPrompt:
      'My Friends Book Flowers edition cover, garden filled with color and kindness, watercolor illustration, cloth-bound children\'s keepsake book, soft blush and sage, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Flowers edition interior spread, floral watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  space: {
    coverPrompt:
      'My Friends Book Space edition cover, big dreams beneath an endless sky, watercolor illustration, cloth-bound children\'s keepsake book, muted teal and cream, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Space edition interior spread, soft celestial watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
  fairies: {
    coverPrompt:
      'My Friends Book Fairies edition cover, tiny wonders among leaves and flowers, watercolor illustration, cloth-bound children\'s keepsake book, soft sage and blush, soft natural light, premium editorial photography.',
    interiorPrompt:
      'My Friends Book Fairies edition interior spread, fairy-garden watercolor illustrations, pages for handwritten memories, cream paper, soft natural light, premium editorial photography.',
  },
};
