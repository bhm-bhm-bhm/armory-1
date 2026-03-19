#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# ARMORY — GitHub 푸시 스크립트
# 실행: bash push-to-github.sh
# ══════════════════════════════════════════════════════════════════

set -e

REPO_NAME="armory-tactical-skincare"
BRANCH="main"

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   ARMORY — GitHub Push Script         ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# ── GitHub 유저명 입력
read -p "  GitHub 유저명을 입력하세요: " GH_USER
if [ -z "$GH_USER" ]; then
  echo "  ✗ 유저명이 비어있습니다."
  exit 1
fi

# ── GitHub PAT 입력
echo ""
echo "  GitHub Personal Access Token (PAT)이 필요합니다."
echo "  없다면: github.com → Settings → Developer settings"
echo "          → Personal access tokens → Generate new token (repo 권한)"
echo ""
read -s -p "  PAT를 입력하세요 (입력 내용 숨김): " GH_TOKEN
echo ""
if [ -z "$GH_TOKEN" ]; then
  echo "  ✗ PAT가 비어있습니다."
  exit 1
fi

# ── GitHub CLI 확인 (있으면 사용, 없으면 curl)
if command -v gh &>/dev/null; then
  echo ""
  echo "  ◈ GitHub CLI 감지됨. gh 명령어로 진행합니다."
  echo ""
  echo "$GH_TOKEN" | gh auth login --with-token
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
  echo ""
  echo "  ✓ 푸시 완료!"
  echo "  → https://github.com/$GH_USER/$REPO_NAME"
  exit 0
fi

# ── curl로 레포 생성
echo ""
echo "  ◈ GitHub API로 레포지토리 생성 중..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"ARMORY Tactical Skincare System — AI 피부 관리 모바일 앱\",\"private\":false}" \
  https://api.github.com/user/repos)

if [ "$RESPONSE" = "201" ]; then
  echo "  ✓ 레포지토리 생성됨: github.com/$GH_USER/$REPO_NAME"
elif [ "$RESPONSE" = "422" ]; then
  echo "  ℹ 레포지토리가 이미 존재합니다. 기존 레포에 푸시합니다."
else
  echo "  ✗ 레포 생성 실패 (HTTP $RESPONSE). PAT 권한을 확인하세요."
  exit 1
fi

# ── remote 설정 및 push
REMOTE_URL="https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo ""
echo "  ◈ 푸시 중..."
git push -u origin "$BRANCH"

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║  ✓ 푸시 완료!                         ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  레포지토리: https://github.com/$GH_USER/$REPO_NAME"
echo "  브랜치    : $BRANCH"
echo ""
echo "  다음 단계:"
echo "  1. cd armory-tactical-skincare"
echo "  2. cp .env.example .env.local"
echo "  3. .env.local에 OAuth 키 입력"
echo "  4. npm install && npm run dev"
echo ""
