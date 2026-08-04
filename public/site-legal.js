(function () {
  const CONSENT_KEY = "lihaCookieConsent";
  const GA_ID = "G-TYWTZBGTQH";

  // TODO(terms-of-use-url): waiting on the real Terms of Use URL from the
  // client — this placeholder must be replaced before launch.
  const LINKS = {
    privacyPolicy: "https://www.linkedin.com/legal/privacy-policy",
    termsOfUse: "#terms-of-use-url-pending",
    userAgreement: "https://www.linkedin.com/legal/user-agreement",
    cookieTable: "/cookie-table",
  };

  function getConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (_) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (_) {
      // If storage is unavailable, treat as a session-only choice.
    }
  }

  function loadGoogleAnalytics() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
  }

  function applyConsent(choice) {
    if (choice === "accepted") {
      loadGoogleAnalytics();
      if (window.Analytics && typeof window.Analytics.enable === "function") {
        window.Analytics.enable();
      }
    }
  }

  let bannerEl = null;

  function closeBanner() {
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
    }
  }

  function showBanner() {
    if (bannerEl) return;

    bannerEl = document.createElement("div");
    bannerEl.className = "cookie-banner";
    bannerEl.setAttribute("role", "region");
    bannerEl.setAttribute("aria-label", "Cookie consent");

    const inner = document.createElement("div");
    inner.className = "cookie-banner-inner";

    const copy = document.createElement("div");
    copy.className = "cookie-banner-copy";
    copy.innerHTML =
      'This site uses cookies and similar local storage to run the activities and remember your progress, plus Google Analytics to help us improve the experience. See the <a href="' +
      LINKS.cookieTable +
      '">Cookie Table</a> for details.' +
      '<span class="cookie-banner-warning">If you select Reject, we won’t be able to save or track your score and progress during this session, since that is stored locally in your browser and requires your acceptance.</span>';

    const actions = document.createElement("div");
    actions.className = "cookie-banner-actions";

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.className = "cookie-banner-reject";
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", function () {
      setConsent("rejected");
      applyConsent("rejected");
      closeBanner();
    });

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "cookie-banner-accept";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", function () {
      setConsent("accepted");
      applyConsent("accepted");
      closeBanner();
    });

    actions.append(rejectBtn, acceptBtn);
    inner.append(copy, actions);
    bannerEl.appendChild(inner);
    document.body.appendChild(bannerEl);
  }

  function createFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";

    const inner = document.createElement("div");
    inner.className = "site-footer-inner";

    const brand = document.createElement("div");
    brand.className = "site-footer-brand";
    brand.innerHTML =
      '<img class="site-footer-logo" src="/assets/images/linkedinLogo.svg" alt="LinkedIn" />' +
      '<span class="site-footer-copyright">© ' +
      new Date().getFullYear() +
      " AI Skills Sprint</span>";

    const links = document.createElement("div");
    links.className = "site-footer-links";

    const linkItems = [
      { label: "Privacy Policy", href: LINKS.privacyPolicy },
      { label: "Terms of Use", href: LINKS.termsOfUse },
      { label: "User Agreement", href: LINKS.userAgreement },
      { label: "Cookie Table", href: LINKS.cookieTable },
    ];

    linkItems.forEach(function (item) {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (/^https?:\/\//.test(item.href)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      links.appendChild(a);
    });

    const manageBtn = document.createElement("button");
    manageBtn.type = "button";
    manageBtn.className = "site-footer-manage";
    manageBtn.textContent = "Manage Cookie Preferences";
    manageBtn.addEventListener("click", showBanner);
    links.appendChild(manageBtn);

    inner.append(brand, links);
    footer.appendChild(inner);
    return footer;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(createFooter());

    const consent = getConsent();
    if (consent === "accepted" || consent === "rejected") {
      applyConsent(consent);
    } else {
      showBanner();
    }
  });

  window.CookieConsent = {
    open: showBanner,
    getConsent: getConsent,
  };
})();
