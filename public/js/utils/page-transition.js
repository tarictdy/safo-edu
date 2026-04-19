export function setupPageTransition() {
  document.body.classList.add('page-enter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('page-enter');
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('a[href]');
    if (!target) return;
    if (target.target === '_blank') return;

    const href = target.getAttribute('href') || '';
    if (!href.startsWith('/')) return;
    if (href.startsWith('/api/')) return;

    event.preventDefault();
    document.body.classList.add('page-leave');
    setTimeout(() => {
      window.location.href = href;
    }, 180);
  });
}
