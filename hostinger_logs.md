> shadcn-ui-template@0.0.1 postinstall
> cd backend && npm install

npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 178 packages, and audited 179 packages in 7s

31 packages are looking for funding
  run `npm fund` for details

5 vulnerabilities (2 moderate, 3 high)

To address issues that do not require attention, run:
  npm audit fix

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

added 476 packages, and audited 477 packages in 15s

95 packages are looking for funding
  run `npm fund` for details

8 vulnerabilities (4 moderate, 2 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

> shadcn-ui-template@0.0.1 build
> tsc -b && vite build && cd backend && npm run build

vite v7.3.1 building client environment for production...
transforming...
✓ 2706 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        1.04 kB │ gzip:   0.52 kB
dist/assets/socia-image-CCFYh_--.jpg               3,334.86 kB
dist/assets/index-D6yqS1SC.css                       137.81 kB │ gzip:  21.09 kB
dist/assets/index-BdQq_4o_.js                          0.06 kB │ gzip:   0.08 kB
dist/assets/plus-CwysG6UP.js                           0.15 kB │ gzip:   0.15 kB
dist/assets/clock-CazMIp4s.js                          0.17 kB │ gzip:   0.16 kB
dist/assets/search-D9LawDyk.js                         0.17 kB │ gzip:   0.17 kB
dist/assets/chevron-right-Dc1o1MNP.js                  0.21 kB │ gzip:   0.18 kB
dist/assets/log-out-9C0P7GqU.js                        0.23 kB │ gzip:   0.19 kB
dist/assets/log-in-BxJL32Lr.js                         0.23 kB │ gzip:   0.19 kB
dist/assets/index-DG1R7pOh.js                          0.23 kB │ gzip:   0.17 kB
dist/assets/download-DtN61uyZ.js                       0.23 kB │ gzip:   0.19 kB
dist/assets/user-check-CSd2OPac.js                     0.24 kB │ gzip:   0.20 kB
dist/assets/circle-alert-Cae3sU_6.js                   0.25 kB │ gzip:   0.19 kB
dist/assets/refresh-cw-CkG1sD44.js                     0.32 kB │ gzip:   0.22 kB
dist/assets/use-vietnam-clock-vpuYxWts.js              0.32 kB │ gzip:   0.24 kB
dist/assets/layers-B-wNek6k.js                         0.42 kB │ gzip:   0.24 kB
dist/assets/star-Ca-W58D6.js                           0.47 kB │ gzip:   0.29 kB
dist/assets/calendar-days-CdKbNT8D.js                  0.50 kB │ gzip:   0.26 kB
dist/assets/label-DgnDQuRx.js                          0.61 kB │ gzip:   0.40 kB
dist/assets/textarea-DVmvyA27.js                       0.62 kB │ gzip:   0.38 kB
dist/assets/input-CHUTp3mW.js                          0.80 kB │ gzip:   0.44 kB
dist/assets/skeleton-CvyiRFe4.js                       0.88 kB │ gzip:   0.45 kB
dist/assets/room-status-Bjazxltv.js                    0.92 kB │ gzip:   0.44 kB
dist/assets/native-select-U02__T99.js                  1.11 kB │ gzip:   0.57 kB
dist/assets/table-CFUOtx2y.js                          1.19 kB │ gzip:   0.47 kB
dist/assets/badge-CMyfvtry.js                          1.27 kB │ gzip:   0.60 kB
dist/assets/vietnam-time-D0EhHpkr.js                   1.50 kB │ gzip:   0.75 kB
dist/assets/use-dashboard-data-B78a5gql.js             2.02 kB │ gzip:   0.91 kB
dist/assets/useMutation-BmMF4Scd.js                    2.21 kB │ gzip:   0.91 kB
dist/assets/dialog-8WWSqKWE.js                         2.55 kB │ gzip:   0.99 kB
dist/assets/switch-B2lYgTsI.js                         2.75 kB │ gzip:   1.32 kB
dist/assets/tabs-BJmwJulR.js                           4.93 kB │ gzip:   1.78 kB
dist/assets/use-page-data-B9EyYbNO.js                  5.72 kB │ gzip:   2.02 kB
dist/assets/card-ukIynguW.js                           5.89 kB │ gzip:   1.73 kB
dist/assets/channel-distribution-page-CSKuqoil.js      6.37 kB │ gzip:   1.73 kB
dist/assets/room-types-page-Dl6vyxv8.js                6.89 kB │ gzip:   2.05 kB
dist/assets/dining-events-page-CydIMWIu.js             7.04 kB │ gzip:   2.06 kB
dist/assets/rate-manager-page-BpeIAA4N.js              7.37 kB │ gzip:   2.27 kB
dist/assets/security-access-page-AfOWRa-v.js           7.41 kB │ gzip:   2.24 kB
dist/assets/staff-roles-page-Dk1aVXq5.js               7.61 kB │ gzip:   2.32 kB
dist/assets/housekeeping-page-BGwfBnqd.js              7.83 kB │ gzip:   2.27 kB
dist/assets/rooms-page-DvHJIZ12.js                     8.58 kB │ gzip:   2.57 kB
dist/assets/useQuery-PMpcZVDb.js                       8.90 kB │ gzip:   3.25 kB
dist/assets/availability-page-Chp-hHxV.js              8.92 kB │ gzip:   2.71 kB
dist/assets/vip-guests-page-CyELPDAP.js                9.48 kB │ gzip:   2.93 kB
dist/assets/check-in-out-page-CgG_K90h.js              9.74 kB │ gzip:   2.64 kB
dist/assets/billing-invoices-page-J1hQx7ZU.js         10.40 kB │ gzip:   3.24 kB
dist/assets/guests-page-D2YI_KOn.js                   12.86 kB │ gzip:   3.91 kB
dist/assets/maintenance-page-Ck6NKT9L.js              14.19 kB │ gzip:   3.99 kB
dist/assets/integrations-page-Dmjm5FJU.js             18.28 kB │ gzip:   5.89 kB
dist/assets/reservations-page-DcnsOaoy.js             20.48 kB │ gzip:   5.70 kB
dist/assets/select-BEm-6j7M.js                        21.49 kB │ gzip:   7.48 kB
dist/assets/tax-export-page-CCCOrDcG.js               26.12 kB │ gzip:   6.51 kB
dist/assets/index-DoaACnXc.js                         50.53 kB │ gzip:  13.54 kB
dist/assets/dashboard-page-Bnne4you.js               406.72 kB │ gzip: 119.83 kB
dist/assets/index-BvktdLNr.js                        499.99 kB │ gzip: 155.73 kB
✓ built in 5.85s

> m-management-track-b@1.0.0 build
> prisma generate && tsc

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 186ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints