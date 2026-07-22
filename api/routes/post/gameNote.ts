import { Router } from "express"
import { sql, riot } from "../../util/services.ts"
const router = Router()

// post game notes
router.get('post/gameNote', async (req, res) => {
    const {  } = req.body
})

export default router