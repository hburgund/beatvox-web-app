// The how-to video: open or not, shared by every page (the welcome card and
// About open it). Opening it tells the page, through HOWTO_EVENT, to quiet
// whatever it's playing, so the video isn't heard over a beat.

export const HOWTO_EVENT = 'beatvox:howto';

/** The full how-to video in each shape, made by the howto-video project. */
export const HOWTO_VIDEOS = {
  tall: { src: '/video/beatvox-howto-tall.mp4', poster: '/video/beatvox-howto-tall.jpg', w: 720, h: 1280 },
  square: { src: '/video/beatvox-howto-square.mp4', poster: '/video/beatvox-howto-square.jpg', w: 720, h: 720 },
  wide: { src: '/video/beatvox-howto-wide.mp4', poster: '/video/beatvox-howto-wide.jpg', w: 1280, h: 720 },
} as const;
export type HowtoShape = keyof typeof HOWTO_VIDEOS;

/** The shape that fills a screen best: tall on a phone held upright, wide on a laptop. */
export function howtoShape(width: number, height: number): HowtoShape {
  const r = height / width;
  return r > 1.25 ? 'tall' : r < 0.8 ? 'wide' : 'square';
}

class Howto {
  open = $state(false);

  show() {
    this.open = true;
    dispatchEvent(new Event(HOWTO_EVENT));
  }

  hide() {
    this.open = false;
  }
}

export const howto = new Howto();
