const studioMenu = document.querySelector('.studio-menu');
const menuButton = studioMenu.querySelector('summary');

studioMenu.addEventListener('click', event => {
  if (event.target.closest('nav a')) studioMenu.open = false;
});
studioMenu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && studioMenu.open) {
    studioMenu.open = false;
    menuButton.focus();
  }
});
