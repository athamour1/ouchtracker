#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────────
REPO="athamour1/ouchtracker"
REGISTRY="ghcr.io"
BACKEND_IMAGE="${REGISTRY}/${REPO}/backend"
FRONTEND_IMAGE="${REGISTRY}/${REPO}/frontend"

# ─── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ ${NC}$1"; }
ok()    { echo -e "${GREEN}✔ ${NC}$1"; }
warn()  { echo -e "${YELLOW}⚠ ${NC}$1"; }
error() { echo -e "${RED}✖ ${NC}$1"; exit 1; }

# ─── Pre-flight checks ─────────────────────────────────────────────────────────
command -v gh     >/dev/null || error "gh CLI not found. Install: https://cli.github.com"
command -v docker >/dev/null || error "docker not found."
gh auth status    >/dev/null 2>&1 || error "Not logged in to GitHub CLI. Run: gh auth login"

# ─── Ask for version ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}       🩹 OuchTracker Release Script${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Show latest existing tags for context
LATEST_TAGS=$(git tag --sort=-v:refname 2>/dev/null | head -5)
if [ -n "$LATEST_TAGS" ]; then
  info "Latest tags:"
  echo "$LATEST_TAGS" | sed 's/^/   /'
  echo ""
fi

read -rp "$(echo -e "${YELLOW}Enter version to release (e.g. 1.0.0): ${NC}")" VERSION

# Validate semver-ish format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
  error "Invalid version format. Use semver (e.g. 1.0.0, 1.2.3-beta.1)"
fi

TAG="v${VERSION}"

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  error "Tag $TAG already exists! Choose a different version."
fi

# ─── Confirmation ───────────────────────────────────────────────────────────────
echo ""
info "This will:"
echo "   1. Build Docker images for backend & frontend"
echo "   2. Push images to ${REGISTRY}/${REPO}"
echo "   3. Create Git tag ${TAG}"
echo "   4. Create GitHub release ${TAG}"
echo ""
echo -e "   📦 ${BACKEND_IMAGE}:${TAG}"
echo -e "   📦 ${FRONTEND_IMAGE}:${TAG}"
echo ""

read -rp "$(echo -e "${YELLOW}Proceed? (y/N): ${NC}")" CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  warn "Aborted."
  exit 0
fi

echo ""

# ─── Bump version in package.json files & commit ───────────────────────────────
info "Bumping version to ${VERSION}..."
# Update frontend/package.json
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" frontend/package.json
ok "frontend/package.json → ${VERSION}"

git add frontend/package.json
git commit -m "chore(release): bump version to ${VERSION}"
ok "Version commit created"

# ─── Login to GHCR ─────────────────────────────────────────────────────────────
info "Logging in to ${REGISTRY}..."
gh auth token | docker login "$REGISTRY" -u "$(gh api user -q .login)" --password-stdin
ok "Logged in to ${REGISTRY}"

# ─── Build & push backend ──────────────────────────────────────────────────────
info "Building backend image..."
docker build -t "${BACKEND_IMAGE}:${TAG}" -t "${BACKEND_IMAGE}:latest" ./backend
ok "Backend image built"

info "Pushing backend image..."
docker push "${BACKEND_IMAGE}:${TAG}"
docker push "${BACKEND_IMAGE}:latest"
ok "Backend image pushed"

# ─── Build & push frontend ─────────────────────────────────────────────────────
info "Building frontend image..."
docker build -t "${FRONTEND_IMAGE}:${TAG}" -t "${FRONTEND_IMAGE}:latest" ./frontend
ok "Frontend image built"

info "Pushing frontend image..."
docker push "${FRONTEND_IMAGE}:${TAG}"
docker push "${FRONTEND_IMAGE}:latest"
ok "Frontend image pushed"

# ─── Create Git tag & GitHub release ────────────────────────────────────────────
info "Creating Git tag ${TAG}..."
git add .
git tag -a "$TAG" -m "Release ${TAG}"
git push origin "$TAG"
ok "Tag ${TAG} pushed"

info "Creating GitHub release..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "🩹 OuchTracker ${TAG}" \
  --generate-notes
ok "GitHub release created"

# ─── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 Release ${TAG} complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Images:"
echo "    docker pull ${BACKEND_IMAGE}:${TAG}"
echo "    docker pull ${FRONTEND_IMAGE}:${TAG}"
echo ""
echo "  Release:"
echo "    https://github.com/${REPO}/releases/tag/${TAG}"
echo ""
