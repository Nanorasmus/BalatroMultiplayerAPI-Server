FROM node:21

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 6858

CMD [ "node", "dist/src/main.js" ]
