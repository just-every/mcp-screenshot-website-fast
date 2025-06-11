# Deployment Guide

## NPM Publishing Setup

### 1. NPM Token Configuration

The GitHub Actions workflow requires an NPM token with publish permissions.

1. Go to [npmjs.com](https://www.npmjs.com/) and sign in
2. Click your avatar → Access Tokens
3. Generate New Token → Classic Token
4. Select "Publish" permission
5. Copy the token

### 2. Disable OTP for Automation (Recommended)

To allow GitHub Actions to publish without OTP:

1. Go to npmjs.com → Account Settings
2. Under "Two-Factor Authentication"
3. Change "Require two-factor authentication for" to "Authorization only"
4. This allows automation tokens to publish without OTP

**Alternative**: If you must keep OTP for publishing:
- Use `npm publish --otp=123456` locally
- GitHub Actions automation won't work with OTP enabled for publishing

### 3. Add Token to GitHub

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret
4. Name: `NPM_TOKEN`
5. Value: Your npm token

## Manual Publishing

If you need to publish manually:

```bash
# With OTP disabled for automation
npm publish --access public

# With OTP enabled
npm publish --access public --otp=123456
```

## Deployment Process

### Option 1: Automatic (Requires GH_PAT)

1. Add a Personal Access Token with `repo` scope to repository secrets as `GH_PAT`
2. Push to main branch
3. GitHub Actions will automatically:
   - Build and test
   - Bump version
   - Publish to npm
   - Create git tag

### Option 2: Manual Workflow Dispatch

1. Go to Actions → Simple Release → Run workflow
2. Select version type (patch/minor/major)
3. GitHub Actions will:
   - Build and test
   - Publish to npm with new version
   - Create GitHub release

### Option 3: Local Publishing

```bash
# Bump version locally
npm version patch

# Build
npm run build

# Publish
npm publish --access public

# Push tags
git push --follow-tags
```

The package will be available at:
```
npm install @just-every/mcp-screenshot-website-fast
```