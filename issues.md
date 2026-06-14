The build fails because @testing-library/react is missing exports for screen, within, fireEvent, and waitFor in multiple test files. This indicates the package is either not properly installed, has an incompatible version, or is missing from dependencies entirely.

Solution

Update dependencies: Add or update @testing-library/react to version ^14.0.0 and ensure @testing-library/dom is installed as a peer dependency (version ^9.0.0 or higher)
Modify frontend/package.json: Ensure the devDependencies section includes both packages with compatible versions that export the required utilities
Clear and reinstall: Delete frontend/node_modules and frontend/package-lock.json, then run npm install in the frontend workspace to fetch the correct versions

## Build log
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

> just-management-monorepo@0.0.1 preinstall
> node scripts/clean-stale-esbuild.mjs


added 621 packages, and audited 624 packages in 11s

120 packages are looking for funding
  run `npm fund` for details

6 vulnerabilities (1 moderate, 3 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

> just-management-monorepo@0.0.1 build
> node scripts/ensure-build-deps.mjs && npm run build:app


> just-management-monorepo@0.0.1 build:app
> npm run build -w frontend && npm run build -w backend && npm run sync:dist


> frontend@0.0.1 build
> tsc -b && vite build

src/test/floor-plan-derived-status.test.tsx(2,18): error TS2305: Module '"@testing-library/react"' has no exported member 'screen'.
src/test/floor-plan-derived-status.test.tsx(2,26): error TS2305: Module '"@testing-library/react"' has no exported member 'within'.
src/test/repository-backed-page-data.test.tsx(2,18): error TS2305: Module '"@testing-library/react"' has no exported member 'screen'.
src/test/reservation-derived-room-pages.test.tsx(2,18): error TS2305: Module '"@testing-library/react"' has no exported member 'screen'.
src/test/tax-export-page.test.tsx(2,18): error TS2305: Module '"@testing-library/react"' has no exported member 'screen'.
src/test/tax-export-page.test.tsx(2,26): error TS2305: Module '"@testing-library/react"' has no exported member 'fireEvent'.
src/test/tax-export-page.test.tsx(2,37): error TS2305: Module '"@testing-library/react"' has no exported member 'waitFor'.
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error path /home/u247402862/domains/manage.mujosaigon.com/public_html/.builds/source/repository/frontend
npm error workspace frontend@0.0.1
npm error location /home/u247402862/domains/manage.mujosaigon.com/public_html/.builds/source/repository/frontend
npm error command failed
npm error command sh -c tsc -b && vite build
[31mERROR: Failed to build the application[0m
