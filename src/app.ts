import express from "express"
import bodyParser from "body-parser"
import routes from "./api/routes/index.ts"
import cors from "cors"
import path from "path"

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { requestLogger } from "./api/middleware/requestLogging.ts";
import { apiKeyAuth } from "./api/middleware/apiKeyAuth.ts";

const swaggerDocument = YAML.load(path.join(__dirname, "../documentation.yaml"));

const app = express()
const port = 3000
app.use(cors())
app.use(requestLogger)
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use('/api', apiKeyAuth)
app.use('/api', routes)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
  console.log(`speed-watches API listening on port ${port}`)
})

app.get('/', function(req, res) {
  res.redirect('/docs')
});