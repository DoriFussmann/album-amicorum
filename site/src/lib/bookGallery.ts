type GalleryState = {
  slides: HTMLElement[];
  index: number;
  statusEl: HTMLElement | null;
};

function showImage(state: GalleryState, nextIndex: number) {
  if (!state.slides.length) return;
  const total = state.slides.length;
  state.index = ((nextIndex % total) + total) % total;
  state.slides.forEach((slide, i) => {
    const active = i === state.index;
    slide.classList.toggle('opacity-0', !active);
    slide.classList.toggle('opacity-100', active);
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  if (state.statusEl) {
    state.statusEl.textContent = `${state.index + 1} / ${total}`;
  }
}

export function initBookGalleries(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('[data-book-gallery]').forEach((root) => {
    if (root.dataset.galleryReady === 'true') return;
    const slides = [...root.querySelectorAll<HTMLElement>('[data-gallery-slide]')];
    if (!slides.length) return;

    const state: GalleryState = {
      slides,
      index: 0,
      statusEl: root.querySelector('[data-gallery-status]'),
    };

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

    root.dataset.galleryReady = 'true';
  });
}
