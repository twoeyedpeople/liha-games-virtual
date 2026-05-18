(function () {
  const navItems = [
    { href: "/index.html", label: "Home" },
    { href: "/recruiterfocusfinder.html", label: "Focus Finder" },
    { href: "/ai-trust-test", label: "AI Trust Test" },
    { href: "/prompt-like-a-pro", label: "Prompt Like a Pro" },
    { href: "/hiring-assistant-demo", label: "Hiring Assistant Demo" },
    { href: "/human-skills-in-the-age-of-ai", label: "Human Skills" },
    { href: "/ai-adoption-plan", label: "AI Adoption Plan" },
    { href: "/resources", label: "Resources" },
  ];

  function createTopbar() {
    const header = document.createElement("header");
    header.className = "landing-topbar";

    const inner = document.createElement("div");
    inner.className = "landing-topbar-inner";

    const logoLink = document.createElement("a");
    logoLink.className = "landing-logo-link";
    logoLink.href = "/index.html";
    logoLink.setAttribute("aria-label", "AI Skills Sprint Virtual Hub home");

    const logo = document.createElement("img");
    logo.src = "/assets/images/linkedinLogo.svg";
    logo.alt = "LinkedIn";
    logo.className = "landing-logo";
    logoLink.appendChild(logo);

    const nav = document.createElement("nav");
    nav.className = "landing-nav";
    nav.setAttribute("aria-label", "Primary");

    navItems.forEach((item, index) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;

      nav.appendChild(link);
    });

    inner.append(logoLink, nav);
    header.appendChild(inner);

    return header;
  }

  document.querySelectorAll("[data-landing-topbar]").forEach((placeholder) => {
    placeholder.replaceWith(createTopbar());
  });
})();
