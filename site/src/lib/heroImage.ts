import heroJpg from '../assets/images/hero.jpg';
import { getLcpPreload } from './imagePreload';

export const heroImage = heroJpg;
export const HERO_WIDTHS = [640, 960, 1280, 1600, 1920] as const;
export const HERO_SIZES = '100vw';

export function getHeroLcpPreload() {
  return getLcpPreload(heroImage, HERO_WIDTHS, HERO_SIZES);
}
