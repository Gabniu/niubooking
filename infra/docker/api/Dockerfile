FROM node:24-alpine AS build
WORKDIR /workspace
COPY . .
RUN find . -name 'tsconfig.tsbuildinfo' -delete && find . -type d -name dist -prune -exec rm -rf {} + && npm ci --ignore-scripts --no-audit --no-fund && npm run build

FROM node:24-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/package-lock.json ./package-lock.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api ./apps/api
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
USER node
EXPOSE 3100
CMD ["node", "apps/api/dist/main.js"]
