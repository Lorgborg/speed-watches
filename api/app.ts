import express from "express"
import bodyParser from "body-parser"
import routes from "./routes/index.ts"
import cors from "cors"

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./documentation.yaml');

const app = express()
const port = 3000
app.use(cors())
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use('/api', routes)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})