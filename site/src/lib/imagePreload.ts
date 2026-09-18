import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

export type LcpPreload = {
  src: string;
  srcSet: string;
  sizes: string;
  type: 'image/avif';
};

export async function getLcpPreload(
  src: ImageMetadata,
  widths: readonly number[],
  sizes: string,
): Promise<LcpPreload> {
  const image = await getImage({
    src,
    widths: [...widths],
    format: 'avif',
  });

  const srcSet =
    typeof image.srcSet === 'string' ? image.srcSet : image.srcSet.attribute;

  return {
    src: image.src,
    srcSet,
    sizes,
    type: 'image/avif',
  };
}
