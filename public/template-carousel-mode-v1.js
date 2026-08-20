(() => {
  'use strict';
  const root = document.documentElement;
  const editor = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  root.classList.toggle('asteryon-editor-surface', editor);
  root.classList.toggle('asteryon-public-surface', !editor);
})();
