FROM node:21

WORKDIR ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 6858

CMD [ "node", "dist/src/main.js" ]
