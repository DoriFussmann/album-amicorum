export type GalleryImage = { src: string; alt: string };

type GalleryState = {
  images: GalleryImage[];
  index: number;
  imageEl: HTMLImageElement;
  statusEl: HTMLElement | null;
  fadeTimer: number;
};

const states = new WeakMap<HTMLElement, GalleryState>();

function parseImages(root: HTMLElement): GalleryImage[] {
  const script = root.querySelector<HTMLScriptElement>('[data-gallery-images]');
  if (!script?.textContent) return [];
  try {
    const parsed = JSON.parse(script.textContent) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === 'string' && item) return { src: item, alt: '' };
        if (item && typeof item === 'object' && 'src' in item) {
          const src = String((item as { src: unknown }).src ?? '');
          const alt = String((item as { alt?: unknown }).alt ?? '');
          return src ? { src, alt } : null;
        }
        return null;
      })
      .filter((item): item is GalleryImage => Boolean(item));
  } catch {
    return [];
  }
}

function showImage(state: GalleryState, nextIndex: number) {
  if (!state.images.length) return;
  const total = state.images.length;
  state.index = ((nextIndex % total) + total) % total;
  const next = state.images[state.index];
  window.clearTimeout(state.fadeTimer);
  state.imageEl.style.opacity = '0';
  state.fadeTimer = window.setTimeout(() => {
    state.imageEl.src = next.src;
    state.imageEl.alt = next.alt;
    state.imageEl.style.opacity = '1';
  }, 120);
  if (state.statusEl) {
    state.statusEl.textContent = `${state.index + 1} / ${total}`;
  }
}

function syncNav(root: HTMLElement, length: number) {
  const hide = length <= 1;
  root.querySelectorAll('[data-gallery-prev], [data-gallery-next]').forEach((el) => {
    el.classList.toggle('hidden', hide);
  });
}

/** Replace the gallery's image set and show the first frame. */
export function setGalleryImages(root: HTMLElement, images: GalleryImage[]): void {
  const state = states.get(root);
  if (!state) return;
  state.images = images;
  const script = root.querySelector('[data-gallery-images]');
  if (script) script.textContent = JSON.stringify(images);
  syncNav(root, images.length);
  showImage(state, 0);
}

export function initBookGalleries(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('[data-book-gallery]').forEach((root) => {
    if (root.dataset.galleryReady === 'true') return;
    const imageEl = root.querySelector<HTMLImageElement>('[data-gallery-image]');
    if (!imageEl) return;

    const state: GalleryState = {
      images: parseImages(root),
      index: 0,
      imageEl,
      statusEl: root.querySelector('[data-gallery-status]'),
      fadeTimer: 0,
    };
    states.set(root, state);

    root.querySelector('[data-gallery-prev]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      showImage(state, state.index - 1);
    });
    root.querySelector('[data-gallery-next]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      showImage(state, state.index + 1);
    });

    let touchStartX = 0;
    root.addEventListener(
      'touchstart',
      (event) => {
        touchStartX = event.changedTouches[0]?.clientX ?? 0;
      },
      { passive: true },
    );
    root.addEventListener(
      'touchend',
      (event) => {
        const touchEndX = event.changedTouches[0]?.clientX ?? 0;
        const delta = touchEndX - touchStartX;
        if (Math.abs(delta) < 40) return;
        showImage(state, delta > 0 ? state.index - 1 : state.index + 1);
      },
      { passive: true },
    );

    const keyTarget: HTMLElement = root.closest('dialog') ?? root;
    if (keyTarget.dataset.galleryKeysBound !== 'true') {
      keyTarget.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          showImage(state, state.index - 1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          showImage(state, state.index + 1);
        }
      });
      keyTarget.dataset.galleryKeysBound = 'true';
    }

    (root as HTMLElement & { setImages?: (images: GalleryImage[]) => void }).setImages = (
      images,
    ) => setGalleryImages(root, images);

    root.dataset.galleryReady = 'true';
  });
}
