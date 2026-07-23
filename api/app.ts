import express from "express"
import bodyParser from "body-parser"
import routes from "./routes/index.ts"
import cors from "cors"

const app = express()
const port = 3000
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use('/api', routes)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})