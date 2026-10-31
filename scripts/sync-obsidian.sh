#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="Vocab Buddy"
VAULT_PROJECT="/home/zeto/Documents/Obsidian Vault/Projects/Vocab Buddy"
REPO_DOCS="/home/zeto/Desktop/projects/Vocab Buddy/docs"

mkdir -p "${VAULT_PROJECT}/01 - Requirements (PRD)"
mkdir -p "${VAULT_PROJECT}/02 - Specifications"
mkdir -p "${VAULT_PROJECT}/03 - Decisions (ADR)"
mkdir -p "${REPO_DOCS}/prd"
mkdir -p "${REPO_DOCS}/spec"
mkdir -p "${REPO_DOCS}/adr"

# Synchronize PRDs
rsync -avu --update "${REPO_DOCS}/prd/" "${VAULT_PROJECT}/01 - Requirements (PRD)/"
rsync -avu --update "${VAULT_PROJECT}/01 - Requirements (PRD)/" "${REPO_DOCS}/prd/"

# Synchronize Specs
rsync -avu --update "${REPO_DOCS}/spec/" "${VAULT_PROJECT}/02 - Specifications/"
rsync -avu --update "${VAULT_PROJECT}/02 - Specifications/" "${REPO_DOCS}/spec/"

# Synchronize ADRs
rsync -avu --update "${REPO_DOCS}/adr/" "${VAULT_PROJECT}/03 - Decisions (ADR)/"
rsync -avu --update "${VAULT_PROJECT}/03 - Decisions (ADR)/" "${REPO_DOCS}/adr/"

echo "✅ Knowledge synced between Obsidian and ${PROJECT_NAME} repository."
