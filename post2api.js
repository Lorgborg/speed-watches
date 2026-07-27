const test = require("./response.json"); // any Postman collection JSON file
const { transpile } = require("postman2openapi");

const openapi = transpile(test)
console.log(openapi)