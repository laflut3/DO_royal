FROM node:20-alpine

WORKDIR /app
COPY . .
EXPOSE 5000
RUN npm install && npm run build
CMD ["npm", "run", "serve"]
