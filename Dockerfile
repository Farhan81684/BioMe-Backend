FROM node:18-alpine 
WORKDIR /app 
COPY package*.json ./ 
RUN npm install 
COPY . . 
RUN mkdir -p uploads
ENV PORT=3000  
EXPOSE 3000 
CMD ["node", "index.js"] 

