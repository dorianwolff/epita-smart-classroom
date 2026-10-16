export function lockBodyScroll(body = document.body, viewport = window) {
  const scrollY = viewport.scrollY;
  const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
  body.style.overflow = "hidden";
  return () => {
    Object.assign(body.style, previous);
    viewport.scrollTo(0, scrollY);
  };
}
