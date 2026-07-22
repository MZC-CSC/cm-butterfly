# 1. Project structure
- folder structure
- store
# 2. Tech stack, libraries

- node — the version is defined by [`.nvmrc`](.nvmrc) (see *3. Setting up the development environment* below)
- vue 2.7
    - composition api
- pinia
- mirinae
    - https://github.com/cloudforet-io/mirinae
- postcss
- tailwind css
- vue-i18n
- vite.config

# 3. Setting up the development environment

The Node version is managed by a single file, [`.nvmrc`](.nvmrc). The image (`Dockerfile`) and CI use the same value, so **your local setup must match it too, or verification results will diverge.**

```bash
cd front
nvm install   # reads .nvmrc and installs that version (skips if already present)
nvm use       # switches the current shell to that version
npm ci        # installs exactly per package-lock.json (reproducible install)
```

Things to know:

- **Having a `.nvmrc` does not switch node automatically.** You must run `nvm use` yourself, and again every time you open a new shell. (To switch just by `cd`-ing, you need to set up a separate shell hook.)
- It generally works on higher versions too, but **it's safer to match the version the image is built with.** If only your local uses a different version, it's hard to claim that what passes locally will also pass in the image.
- When bumping the version, change `.nvmrc` and the `Dockerfile`'s `ARG NODE_VERSION` **together to the same value**. If they diverge, CI (Front E2E Gate) blocks it.

# 4. API integration
# 5. Shared libs, utils
# 6. Code style — Lint, Prettier configuration

# 7. Environment variables

# 8. Build
