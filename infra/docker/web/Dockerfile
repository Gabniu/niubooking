FROM node:24-alpine AS build
WORKDIR /workspace
COPY . .
RUN find . -name 'tsconfig.tsbuildinfo' -delete && find . -type d -name dist -prune -exec rm -rf {} + && npm ci --ignore-scripts --no-audit --no-fund && npm run build

FROM node:24-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=4173
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public
COPY --from=build /workspace/apps/web/*.html ./legacy-web/
COPY --from=build /workspace/apps/web/src ./legacy-web/src
COPY --from=build /workspace/apps/web/dist ./legacy-web/dist
COPY --from=build /workspace/apps/web/assets ./legacy-web/assets
COPY --from=build /workspace/apps/web/vendor ./legacy-web/vendor
COPY --from=build /workspace/packages/contracts ./packages/contracts
COPY --from=build /workspace/scripts/serve-web.mjs ./scripts/serve-web.mjs
COPY --from=build /workspace/scripts/serve-web-production.mjs ./scripts/serve-web-production.mjs
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve-web-production.mjs"]
