const REPO = "legitminh/BigRedHacksProject";
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

const PLATFORMS = [
  { id: "mac", label: "Mac" },
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
];

function platformOf(name) {
  const file = name.toLowerCase();
  if (
    file.endsWith(".dmg") ||
    file.endsWith(".pkg") ||
    file.endsWith(".app.tar.gz") ||
    file.includes("darwin") ||
    file.includes("macos")
  ) {
    return "mac";
  }
  if (file.endsWith(".exe") || file.endsWith(".msi")) return "windows";
  if (
    file.endsWith(".appimage") ||
    file.endsWith(".deb") ||
    file.endsWith(".rpm") ||
    file.includes("linux")
  ) {
    return "linux";
  }
  return null;
}

function rank(name) {
  const file = name.toLowerCase();
  if (file.endsWith(".dmg")) return 0;
  if (file.endsWith(".pkg")) return 1;
  if (file.endsWith(".app.tar.gz")) return 2;
  if (file.includes("setup") && file.endsWith(".exe")) return 0;
  if (file.endsWith(".msi")) return 1;
  if (file.endsWith(".exe")) return 2;
  if (file.endsWith(".deb")) return 0;
  if (file.endsWith(".appimage")) return 1;
  if (file.endsWith(".rpm")) return 2;
  return 9;
}

function archOf(platform, name) {
  const file = name.toLowerCase();
  const apple = file.includes("aarch64") || file.includes("arm64");
  const intel = file.includes("x86_64") || file.includes("x64") || file.includes("amd64");
  if (platform === "mac") {
    if (apple) return "Apple silicon";
    if (intel) return "Intel";
    if (file.includes("universal")) return "Universal";
    return "";
  }
  if (apple) return "ARM64";
  if (intel) return "64-bit";
  return "";
}

function isInstaller(name) {
  const file = name.toLowerCase();
  if (file.endsWith(".sig") || file.endsWith(".json")) return false;
  return platformOf(name) !== null;
}

function pickInstallers(assets) {
  const best = new Map();
  for (const asset of assets) {
    if (!asset.name || !asset.browser_download_url || !isInstaller(asset.name)) continue;
    const platform = platformOf(asset.name);
    const arch = archOf(platform, asset.name);
    const key = `${platform}:${arch}`;
    const current = best.get(key);
    if (!current || rank(asset.name) < rank(current.name)) {
      best.set(key, {
        platform,
        arch,
        name: asset.name,
        url: asset.browser_download_url,
      });
    }
  }
  const items = [...best.values()].filter((item) => {
    if (item.arch) return true;
    return ![...best.values()].some(
      (other) => other.platform === item.platform && other.arch,
    );
  });
  return items.sort((a, b) => {
    const platformOrder = PLATFORMS.findIndex((item) => item.id === a.platform)
      - PLATFORMS.findIndex((item) => item.id === b.platform);
    if (platformOrder !== 0) return platformOrder;
    return a.arch.localeCompare(b.arch);
  });
}

function button(className, href, title, detail) {
  const link = document.createElement("a");
  link.className = `dl-button ${className}`;
  link.href = href;
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = detail;
  link.append(strong, small);
  return link;
}

function render(release, error) {
  const hosts = document.querySelectorAll("[data-downloads]");
  hosts.forEach((host) => {
    host.replaceChildren();
    const row = document.createElement("div");
    row.className = "dl-row";
    const note = document.createElement("p");
    note.className = "release-note";

    if (error || !release) {
      for (const platform of PLATFORMS) {
        row.append(
          button(
            "secondary",
            RELEASES_PAGE,
            platform.label,
            "See releases",
          ),
        );
      }
      note.textContent = error
        ? "Release list could not be loaded. Open GitHub releases for Mac, Windows, and Linux builds."
        : "No release is published yet. Mac, Windows, and Linux installers will appear here with the first GitHub release.";
      const fallback = document.createElement("a");
      fallback.href = RELEASES_PAGE;
      fallback.textContent = "Open releases";
      note.append(" ", fallback, ".");
    } else {
      const chosen = pickInstallers(release.assets || []);
      for (const platform of PLATFORMS) {
        const matches = chosen.filter((item) => item.platform === platform.id);
        if (matches.length === 0) {
          row.append(
            button(
              "secondary",
              release.html_url || RELEASES_PAGE,
              platform.label,
              "Not in this release",
            ),
          );
          continue;
        }
        for (const item of matches) {
          const detail = item.arch ? item.arch : "Installer";
          row.append(button("primary", item.url, platform.label, detail));
        }
      }
      const label = release.tag_name || release.name || "latest";
      note.append("Latest release ");
      const releaseLink = document.createElement("a");
      releaseLink.href = release.html_url || RELEASES_PAGE;
      releaseLink.textContent = label;
      note.append(releaseLink, ". ");
      const all = document.createElement("a");
      all.href = RELEASES_PAGE;
      all.textContent = "All releases";
      note.append(all, ".");
    }

    host.append(row, note);
  });
}

function placeholders() {
  document.querySelectorAll("[data-downloads]").forEach((host) => {
    const row = document.createElement("div");
    row.className = "dl-row";
    for (const platform of PLATFORMS) {
      const span = document.createElement("span");
      span.className = "dl-button waiting";
      const strong = document.createElement("strong");
      strong.textContent = platform.label;
      const small = document.createElement("small");
      small.textContent = "Checking releases";
      span.append(strong, small);
      row.append(span);
    }
    host.replaceChildren(row);
  });
}

placeholders();

fetch(LATEST_API, {
  headers: { Accept: "application/vnd.github+json" },
})
  .then(async (response) => {
    if (response.status === 404) {
      render(null, false);
      return;
    }
    if (!response.ok) throw new Error(String(response.status));
    render(await response.json(), false);
  })
  .catch(() => render(null, true));
