FROM node:24-alpine AS build
WORKDIR /workspace
COPY . .
RUN find . -name 'tsconfig.tsbuildinfo' -delete && find . -type d -name dist -prune -exec rm -rf {} + && npm ci --ignore-scripts --no-audit --no-fund && npm run build

FROM node:24-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/package-lock.json ./package-lock.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/worker ./apps/worker
COPY --from=build /workspace/packages ./packages
USER node
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3200/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/worker/dist/main.js"]
