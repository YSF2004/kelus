/** Preserve the share fragment before Next hydrates; it is never sent to the server. */
export const CHALLENGE_LINK_BOOT = `try {
  if (window.location.pathname.replace(/\\/+$/, "").endsWith("/challenge")) {
    var fragment = window.location.hash;
    if (fragment) window.sessionStorage.setItem("kelus-challenge-fragment", fragment);
  }
} catch (error) {}`;
