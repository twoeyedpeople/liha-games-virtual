(function bindDisplayLaunches() {
  const links = document.querySelectorAll("[data-display-launch]");
  if (!links.length) return;

  function launchDisplay(link) {
    const href = link.getAttribute("href");
    if (!href) return;
    window.location.assign(href);
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      launchDisplay(link);
    });
  });
})();
